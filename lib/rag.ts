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
type RagSource = { index: string; namespace?: string };

const RAG_SOURCES: Record<string, RagSource> = {
  // Science — 電力及電路. Data lives in the "science" index, default namespace.
  circuit: { index: "science" },
};

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
};

/**
 * Retrieve the most relevant knowledge-base chunks for a query within one
 * topic. Never throws: returns empty chunks (and 0 ragTokens) when RAG is
 * disabled, the topic has no configured source, or on any retrieval error, so
 * chat stays available.
 */
export async function retrieveContext(
  topic: string,
  query: string,
  topK = 6
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

    const chunks = (result.matches ?? []).map((match) => ({
      id: match.id,
      score: match.score ?? 0,
      text: extractText(match.metadata),
      source: match.metadata?.source
        ? String(match.metadata.source)
        : undefined,
    }));
    return { chunks, ragTokens: tokens };
  } catch (err) {
    console.error(`[rag] retrieveContext failed for topic "${topic}":`, err);
    return { chunks: [], ragTokens: 0 };
  }
}

// The chunk text may have been stored under a few common metadata keys
// depending on how it was upserted. Try the usual suspects.
function extractText(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return "";
  const candidates = ["text", "content", "chunk", "page_content", "body"];
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
  chunks: RetrievedChunk[]
): string {
  if (chunks.length === 0) {
    return basePrompt;
  }

  const knowledge = chunks
    .map((c, i) => `[${i + 1}]${c.source ? ` (${c.source})` : ""}\n${c.text}`)
    .join("\n\n");

  // This block is the real "knowledge (document stores)" the persona prompts
  // keep referring to. Answer ONLY from it.
  return `${basePrompt}

# knowledge (document stores)
以下是本次提問專屬的資料庫內容。你必須只根據以下內容回答；若以下內容不足以回答，請按角色設定中「超出資料庫範圍」的規則處理，切勿自行編造。
The following are the retrieved knowledge (document stores) for this question. You must answer ONLY based on the content below.

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
