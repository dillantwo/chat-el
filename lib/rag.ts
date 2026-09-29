// Retrieval-Augmented Generation (RAG) helpers backed by Pinecone.
//
// The Humanities / Science chatbots must answer strictly from a curated
// "knowledge (document stores)". This module turns a student question into an
// embedding, queries Pinecone for the most relevant curriculum chunks, and
// formats them so the topic routes can inject them into the system prompt.
//
// Design goals:
// - Graceful degradation: if PINECONE_API_KEY is unset, or a topic has no
//   configured source, retrieval is skipped and the caller keeps its old
//   behaviour instead of throwing.
// - Explicit per-topic mapping to a Pinecone index + namespace, so we only
//   turn RAG on for topics whose data has actually been upserted.

import { Pinecone } from "@pinecone-database/pinecone";
import { embed } from "ai";
import { createAzure } from "@ai-sdk/azure";

// Dedicated Azure provider for embeddings. @ai-sdk/azure v3 serves requests via
// the /openai/v1 endpoint, which only accepts api-version=preview (dated
// versions like 2024-12-01-preview are rejected with "API version not
// supported"). Mirrors the note in generate-html.
const embeddingProvider = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiKey: process.env.AZURE_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_RAG_API_VERSION ?? "preview",
});

// Deployment name of your Azure OpenAI *embedding* model (NOT the chat model).
// Its output dimension must match the Pinecone index dimension
// (text-embedding-3-small = 1536, text-embedding-3-large = 3072).
const EMBEDDING_DEPLOYMENT =
  process.env.AZURE_OPENAI_RAG_DEPLOYMENT ??
  process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ??
  "text-embedding-3-small";

// Maps a topic slug (the [topic] segment of the route) to the Pinecone index
// and namespace that hold its knowledge base. Omit `namespace` to use the
// index's default namespace ("__default__"). A topic that is not listed here
// has RAG disabled and falls back to prompt-only behaviour.
//
// `description` states what the store covers. It is prepended to the retrieved
// chunks so the model knows the scope it is allowed to answer from, which the
// persona prompts rely on when they say "only answer from the knowledge".
type RagSource = { index: string; namespace?: string; description?: string };

// 電力及電路 (circuit) — supplied by the content author alongside the index.
const CIRCUIT_DESCRIPTION =
  "此資訊適用於學習及遵守電力安全守則，以預防觸電、火災及其他電力相關事故，保障人身及設備安全。";

// 航天科技 (aerospace) — supplied by the content author alongside the index.
const AEROSPACE_DESCRIPTION = `此信息適用於了解航天技術，包括：
1. 不同類型衛星及其日常應用
2. 日常用品中運用太空科技的例子
3. 其他日常用品中運用太空科技的例子
4. 國家航天員的事跡及貢獻
5. 航天員在太空生活的情況
6. 航天員在太空生活的挑戰
7. 航天員在太空生活的工作
8. 成為國家航天員的條件
9. 航天員在太空生活的危機
10. 國家航天科技發展
11. 香港在中國航天科技的付出及貢獻
12. 國家航天科技發展時序及重要成就
13. 太空探索帶來的問題
14. 太空探索的爭議
15. micro:bit的基本結構及功能
16. STOP:bit的基本結構及功能
17. 以makecode編程的方法
18. 手作空氣火箭
19. 手作降落傘模型
20. 關於太空的相關知識
21. 人類探索太空的目的
22. 古人與現今科學家進行天文探測
23. 人類進行太空探索的歷程

以及相關資訊，包括地圖應用程式、公平實驗等。`;

// 水資源 (water resources) — 人文科「4.2 地球是我家」→「4.2.1 地球與國家資源」。
// Scope of the "water" index, mirroring the topics the persona prompt lists.
// Kept for when the "water-resources" entry in RAG_SOURCES is re-enabled.
const WATER_DESCRIPTION = `此資訊適用於小學人文科「水資源」及「國家安全」課題，包括：
1. 人與水的關係
2. 水的用途
3. 水的三態
4. 水循環的過程
5. 地球的水資源及蘊藏量
6. 珍貴的食水
7. 全球水資源分佈
8. 氣候變化對水資源的影響
9. 水污染的原因及影響
10. 香港主要水資源（本地集水、水塘、地下水、雨水收集系統）
11. 香港 1963 年旱災及制水
12. 飲水思源—東江水（東深供水工程）及其對香港的重要性
13. 其他地區（如新加坡）的水資源管理及新生水、海水淡化等技術
14. 節約用水及保護水資源的日常行動
15. 水資源與國家安全（資源安全）的關係`;

// 抗日戰爭 (War of Resistance) — 「中國人民抗日戰爭」及「香港保衛戰」。
// Mirrors the 11 topic groups actually present in the "jap-war" index
// (metadata field `topic_zh`), so the model knows the scope it may answer from.
const JAP_WAR_DESCRIPTION = `此資訊適用於小學人文科「中國人民抗日戰爭」及「香港保衛戰」課題，包括：
1. 概覽：為甚麼要學習香港抗戰歷史、香港抗日戰爭概覽
2. 國家背景：九一八事變、七七事變與全面抗戰、抗戰勝利、9月3日抗戰勝利紀念日
3. 戰前香港：香港支援內地抗戰、保衛中國同盟與一碗飯運動、八路軍駐香港辦事處、難民湧入香港、戰前的備戰工作、保衛香港的軍隊
4. 香港保衛戰：香港保衛戰開始、城門碉堡失守、撤出九龍、日軍登陸香港島、黃泥涌峽激戰、黑色聖誕、陳策將軍突圍，以及奧士本准尉、鄭志平、加拿大士兵等人物
5. 日佔時期生活：日本怎樣管治香港、區役所與居住證、米票配給、日本軍票、歸鄉政策、街道改名與日本化、日佔時期的學校、交通和燃料、戰俘營及赤柱拘留營、醫院在戰火中堅持
6. 抗日與營救：東江縱隊港九大隊及其行動、秘密大營救及三條路線、營救國際友人、英軍服務團，以及烏蛟騰村民、沙頭角羅家、西貢村民、李石、鄧德安、楊竹南等人物事跡
7. 香港重光：香港重光、港九大隊與日本投降、戰後重建與戰犯審判、重光紀念日假期的變化
8. 時間線：戰爭前（1937至1941年）、香港保衛戰18天（1941年12月）、日佔至重光（1942至1945年）
9. 歷史遺跡與考察：香港抗戰及海防博物館、香港歷史博物館、黃泥涌峽軍事遺址、城門碉堡、西灣國殤紀念墳場、烏蛟騰及西貢斬竹灣抗日英烈紀念碑、沙頭角抗戰紀念館（羅家大屋）、適廬與玫瑰小堂、東江縱隊文物徑（香港段）、和平紀念碑與大會堂紀念花園
10. 關鍵詞解釋（如「三年零八個月」、「六兩四」、「軍票」等）
11. 教學建議（教師參考）：課堂討論問題、延伸學習活動、處理敏感內容的建議、兒童讀物與延伸閱讀

注意：部分內容標明「（教師參考）」，是給老師備課用的資料。回答學生時，這些資料只可用作背景理解，並須按角色設定中的安全規則處理，不可向學生描述血腥或殘酷的細節。`;

const RAG_SOURCES: Record<string, RagSource> = {
  // Science — 電力及電路. Data lives in the "science" index, default namespace.
  circuit: { index: "science", description: CIRCUIT_DESCRIPTION },
  // Science — 航天科技. Its own index, default namespace.
  aerospace: { index: "aerospace26", description: AEROSPACE_DESCRIPTION },
  // Humanities — 水資源. Temporarily disabled: the persona prompt now carries
  // the 教師用書 reference answers inline, so retrieval added little beyond
  // contradicting them (the index says 海水沖廁 where the handbook says
  // 海水化淡). Uncomment to point the topic back at the "water" index.
  // "water-resources": { index: "water", description: WATER_DESCRIPTION },
  // Humanities — 抗日戰爭. The "jap-war" index, default namespace (82 chunks,
  // text under `chunk_text`). The persona in lib/humanities-prompts.ts keeps
  // referring to the knowledge (document stores) of "Victory of the War of
  // Resistance"; this is that store.
  "anti-japanese-war": { index: "jap-war", description: JAP_WAR_DESCRIPTION },
};

// ---------------------------------------------------------------------------
// Retrieval budget
//
// The knowledge block is appended to the system prompt and changes with every
// question, so unlike the persona prompt it is never served from Azure's prompt
// cache — every chunk is billed at full price on every turn. Before these caps
// the water-resources block alone was 3.4k-5.5k tokens per request, on top of a
// ~5.8k persona prompt.
//
// Measured score distributions (text-embedding-3-small, cosine) across the
// water / science / aerospace26 indexes, which is where the defaults come from:
//   - on-topic questions:  top match 0.51-0.74
//   - greetings, "開始學習!", off-subject asks:  top match 0.19-0.35
// So an absolute floor separates "the store has nothing for this" from a real
// lookup, and a ratio relative to the best match drops the long tail that a
// fixed topK would otherwise drag in. Env-overridable so a topic whose answers
// regress can be loosened without a code change.
// ---------------------------------------------------------------------------

function numFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** How many matches to ask Pinecone for. */
const DEFAULT_TOP_K = numFromEnv("RAG_TOP_K", 4);

/**
 * Matches below this score are treated as "not in the store". When the best
 * match fails it, retrieval returns nothing and the persona prompt's
 * "超出資料庫範圍" rules take over — which is the correct answer for a greeting,
 * and saves the entire block.
 */
const MIN_SCORE = numFromEnv("RAG_MIN_SCORE", 0.3);

/**
 * Keep only matches scoring at least this fraction of the best match. A spiky
 * result (one chunk clearly answers the question) then costs one chunk instead
 * of topK. 0.7 was checked against the on-topic probes above: it leaves every
 * water-resources result untouched and only trims genuine outliers.
 */
const SCORE_RATIO = numFromEnv("RAG_SCORE_RATIO", 0.7);

/**
 * Per-chunk character cap. The knowledge bases are chunked and upserted outside
 * this repo (in the Pinecone console), so chunk sizes vary per store — the
 * aerospace26 index holds chunks over 3,000 characters. This cap keeps one
 * coarse chunk from dominating the prompt budget.
 */
const MAX_CHUNK_CHARS = numFromEnv("RAG_MAX_CHUNK_CHARS", 800);

/**
 * Trim an over-long chunk at the cleanest break in the last quarter of the
 * budget.
 *
 * A paragraph break is tried first, and not only for tidiness: the circuit store
 * is written as blank-line-separated Q/A pairs and the water store as
 * blank-line-separated headings, so cutting at a sentence terminator instead
 * leaves the model holding a question with no answer, or a heading with no body.
 * Sentence terminators (full-width and ASCII, since the material is bilingual)
 * are the fallback, and a hard cut marked with an ellipsis the last resort.
 */
function truncateChunk(text: string): string {
  if (text.length <= MAX_CHUNK_CHARS) return text;

  const window = text.slice(0, MAX_CHUNK_CHARS).trimEnd();
  const floor = Math.floor(MAX_CHUNK_CHARS * 0.75);

  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= floor) {
    return dropDanglingLabels(window.slice(0, paragraph));
  }

  let cut = -1;
  for (const terminator of ["。", "！", "？", "\n", "；", ".", "!", "?", ";"]) {
    const at = window.lastIndexOf(terminator);
    if (at >= floor && at > cut) cut = at;
  }

  return cut === -1
    ? `${window}…`
    : dropDanglingLabels(window.slice(0, cut + 1));
}

/**
 * Cutting at a paragraph break can still land right after a heading, leaving
 * something like "- **径流 (Runoff)：**" with the body that explained it on the
 * far side of the cut. Peel those off: a heading with nothing under it is pure
 * cost, and it invites the model to answer from a section it cannot see.
 *
 * Only labels are peeled, never prose — a line qualifies if it is blank, a
 * horizontal rule, a markdown heading, or short and ends with a colon or bold
 * marker. A trailing full sentence is left alone.
 */
function dropDanglingLabels(text: string): string {
  const lines = text.split("\n");

  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    const isLabel =
      last === "" ||
      /^[-*_]{3,}$/.test(last) ||
      last.startsWith("#") ||
      (last.length < 40 && /([:：]|\*\*)$/.test(last));
    if (!isLabel) break;
    lines.pop();
  }

  return lines.join("\n").trimEnd();
}

/**
 * Apply the relevance floor, the relative cut-off and the per-chunk cap.
 * Chunks arrive sorted by score, but the best score is computed rather than
 * assumed so the ratio cannot be thrown off by an unsorted response.
 */
function selectChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const scored = chunks.filter((c) => c.text.trim() && c.score >= MIN_SCORE);
  if (scored.length === 0) return [];

  const best = Math.max(...scored.map((c) => c.score));
  return scored
    .filter((c) => c.score >= best * SCORE_RATIO)
    .map((c) => ({ ...c, text: truncateChunk(c.text) }));
}

// A single shared client. `Pinecone` is safe to construct once per process.
let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) {
    return null;
  }
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

/** Returns true when Pinecone retrieval is configured for this environment. */
export function isRagEnabled(): boolean {
  return Boolean(process.env.PINECONE_API_KEY);
}

/**
 * Turn a piece of text into an embedding vector using Azure OpenAI, returning
 * both the vector and the number of tokens the embedding call consumed.
 */
export async function embedText(
  text: string
): Promise<{ embedding: number[]; tokens: number }> {
  const { embedding, usage } = await embed({
    model: embeddingProvider.embedding(EMBEDDING_DEPLOYMENT),
    value: text,
  });
  return { embedding, tokens: usage?.tokens ?? 0 };
}

export type RetrievedChunk = {
  id: string;
  score: number;
  text: string;
  source?: string;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  /** Embedding tokens consumed by this retrieval (0 when RAG was skipped). */
  ragTokens: number;
  /** What the topic's knowledge base covers, when the source declares it. */
  description?: string;
};

/**
 * Retrieve the most relevant knowledge-base chunks for a query within one
 * topic. Never throws: returns empty chunks (and 0 ragTokens) when RAG is
 * disabled, the topic has no configured source, or on any retrieval error, so
 * chat stays available.
 *
 * The matches are then put through `selectChunks`, so fewer than `topK` chunks
 * come back whenever the store has nothing relevant (a greeting returns none at
 * all) and each chunk is capped at MAX_CHUNK_CHARS. `ragTokens` still reports
 * the embedding cost even when every match is filtered out — the lookup
 * happened either way.
 */
export async function retrieveContext(
  topic: string,
  query: string,
  topK = DEFAULT_TOP_K
): Promise<RetrievalResult> {
  const client = getPinecone();
  const src = RAG_SOURCES[topic];
  if (!client || !src || !query.trim()) {
    return { chunks: [], ragTokens: 0 };
  }

  try {
    const { embedding: vector, tokens } = await embedText(query);
    const base = client.index(src.index);
    // Target the configured namespace, or the index's default namespace.
    const target = src.namespace ? base.namespace(src.namespace) : base;
    const result = await target.query({
      topK,
      vector,
      includeMetadata: true,
    });

    const matches = (result.matches ?? []).map((match) => ({
      id: match.id,
      score: match.score ?? 0,
      text: extractText(match.metadata),
      source: match.metadata?.source
        ? String(match.metadata.source)
        : undefined,
    }));
    const chunks = selectChunks(matches);
    return { chunks, ragTokens: tokens, description: src.description };
  } catch (err) {
    console.error(`[rag] retrieveContext failed for topic "${topic}":`, err);
    return { chunks: [], ragTokens: 0 };
  }
}

// The chunk text may have been stored under a few common metadata keys
// depending on how it was upserted. Try the usual suspects.
//
// A key that is missing from this list is a silent failure: the query still
// returns its matches, every one of them extracts to "", `selectChunks` drops
// them all, and the topic quietly falls back to prompt-only answers. The
// "jap-war" index uses `chunk_text`, which is how that was found.
function extractText(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return "";
  const candidates = [
    "text",
    "chunk_text",
    "content",
    "chunk",
    "page_content",
    "body",
  ];
  for (const key of candidates) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

/**
 * Build the augmented system prompt: the topic's base persona prompt followed
 * by the retrieved knowledge chunks. When nothing is retrieved, the base
 * prompt is returned unchanged.
 */
export function buildAugmentedPrompt(
  basePrompt: string,
  chunks: RetrievedChunk[],
  description?: string
): string {
  if (chunks.length === 0) {
    return basePrompt;
  }

  const knowledge = chunks
    .map((c, i) => `[${i + 1}]${c.source ? ` (${c.source})` : ""}\n${c.text}`)
    .join("\n\n");

  const scope = description ? `\n${description}\n` : "";

  // This block is the real "knowledge (document stores)" the persona prompts
  // keep referring to. Answer ONLY from it.
  return `${basePrompt}

# knowledge (document stores)
以下是本次提問專屬的資料庫內容。你必須只根據以下內容回答；若以下內容不足以回答，請按角色設定中「超出資料庫範圍」的規則處理，切勿自行編造。
The following are the retrieved knowledge (document stores) for this question. You must answer ONLY based on the content below.
${scope}
<knowledge>
${knowledge}
</knowledge>`;
}

/** Pull the latest user message text from an array of chat messages. */
export function latestUserText(
  messages: Array<{ role: string; text?: string }>
): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.text ?? "";
}
