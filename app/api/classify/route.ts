import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { after } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ToolboxConfig } from "@/models/ToolboxConfig";
import { getSession } from "@/lib/session";
import { getSubjectAccess, requireTopicApi } from "@/lib/subject-access";
import { isSchoolInScope } from "@/lib/toolbox-access";
import { recordTokenUsage } from "@/lib/token-usage";

/**
 * Fix LaTeX commands broken by JSON parsing.
 * When the model outputs e.g. \frac in a JSON string value,
 * the JSON parser interprets \f as a form-feed char (0x0C),
 * \t as tab, \b as backspace, etc., destroying the LaTeX.
 */
function fixBrokenLatex(text: string): string {
  return text
    .replace(/\f/g, "\\f")             // fixes \frac, \flat …
    .replace(/\t(?=[a-zA-Z])/g, "\\t") // fixes \times, \theta, \text …
    .replace(/\x08(?=[a-zA-Z])/g, "\\b") // fixes \bar, \binom …
    .replace(/\r(?=[a-zA-Z])/g, "\\r") // fixes \right, \rangle …
    .replace(/\n(?=[a-zA-Z])/g, "\\n"); // fixes \ne, \nu …
}

/**
 * Wrap orphan LaTeX commands (not already inside $..$ or $$..$$) in
 * inline math delimiters so remark-math / rehype-katex can render them.
 */
function ensureLatexDelimiters(text: string): string {
  const segments: string[] = [];
  const mathRegex = /\$\$[\s\S]*?\$\$|\$(?:[^$\\]|\\.)*?\$/g;
  let lastIndex = 0;
  let m;
  while ((m = mathRegex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push(wrapOrphanLatex(text.slice(lastIndex, m.index)));
    }
    segments.push(m[0]);
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(wrapOrphanLatex(text.slice(lastIndex)));
  }
  return segments.join("");
}

function wrapOrphanLatex(text: string): string {
  // Commands that consume one or more {…} brace groups
  const braceRe =
    /^\\(?:frac|dfrac|tfrac|binom|text|textbf|textit|texttt|textrm|mathrm|mathbf|mathcal|mathbb|sqrt|overline|underline|bar|hat|vec|tilde|boxed|rule|phantom|hspace|vspace)(?![a-zA-Z])/;
  // Standalone symbol commands (no braces)
  const simpleRe =
    /^\\(?:times|div|cdot|pm|mp|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|sum|prod|int|lim|log|sin|cos|tan|to|rightarrow|leftarrow)(?![a-zA-Z])/;

  const out: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Leading digits for mixed fractions like 3\frac{5}{8}
    if (/\d/.test(text[i])) {
      let k = i;
      while (k < text.length && /\d/.test(text[k])) k++;
      if (k < text.length && text[k] === "\\" && braceRe.test(text.slice(k))) {
        const end = consumeLatexCommand(text, k, braceRe);
        out.push("$", text.slice(i, end), "$");
        i = end;
        continue;
      }
    }

    if (text[i] === "\\") {
      const rest = text.slice(i);
      if (braceRe.test(rest)) {
        const end = consumeLatexCommand(text, i, braceRe);
        out.push("$", text.slice(i, end), "$");
        i = end;
        continue;
      }
      const sm = rest.match(simpleRe);
      if (sm) {
        out.push("$", sm[0], "$");
        i += sm[0].length;
        continue;
      }
    }

    out.push(text[i]);
    i++;
  }

  // Merge adjacent inline math groups: $a$$b$ → $a b$
  return out.join("").replace(/\$\$/g, "$ $");
}

/** Consume a brace-command starting at `pos` and return the index after the last brace group. */
function consumeLatexCommand(text: string, pos: number, re: RegExp): number {
  const cmdMatch = text.slice(pos).match(re)!;
  let j = pos + cmdMatch[0].length;

  // Eat successive {…} groups (skip spaces between them)
  while (j < text.length) {
    let s = j;
    while (s < text.length && text[s] === " ") s++;
    if (s < text.length && text[s] === "{") {
      const close = matchBrace(text, s);
      if (close === -1) break;
      j = close + 1;
    } else {
      break;
    }
  }
  return j;
}

/** Return the index of the `}` that balances the `{` at `pos`, or -1. */
function matchBrace(text: string, pos: number): number {
  if (text[pos] !== "{") return -1;
  let depth = 1;
  for (let i = pos + 1; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export async function POST(req: Request) {
  const denied = await requireTopicApi("math", "ai-problem-solving");
  if (denied) return denied;

  const { question, imageData } = await req.json();

  const access = await getSubjectAccess();

  // Fetch active toolbox types from DB, narrowed to the groups this school may
  // actually use. Classifying into a group the school cannot open would leave the
  // dashboard unable to match it, falling back to an unrelated toolbox.
  await connectDB();
  const allConfigs = await ToolboxConfig.find({ isActive: true }).lean();
  const configs =
    access.ok && access.role !== "admin"
      ? allConfigs.filter((c) => isSchoolInScope(c, access.schoolId))
      : allConfigs;
  const validTypes = configs.map((c) => c.type);

  // Hardcoded fallback descriptions in case DB is empty or missing entries
  const fallbackDescriptions: Record<string, string> = {
    "fraction-operations": "分數四則運算題目（分數加減乘除、通分、約分、帶分數運算、分數應用題等）",
    "fraction-concept": "分數概念題目（分數比較大小、相等分數/擴分約分、整數與分數互換、整數的因數排列等）",
    algebra: "代數相關題目（方程式、未知數、代數運算等）",
    journey: "行程圖相關題目（距離-時間圖、描述每段旅程、停留、折返、平行與相交路線等）",
  };

  // The hardcoded list is a safety net for an empty database only. Merging it in
  // unconditionally would let a group this school is scoped out of back into the
  // classifier's choices, and the dashboard would then fail to match it.
  const allTypeSet = new Set(
    validTypes.length > 0
      ? [...validTypes, "other"]
      : [...Object.keys(fallbackDescriptions), "other"],
  );
  const allTypes = [...allTypeSet] as [string, ...string[]];

  const typeDescriptions = allTypes
    .filter((t) => t !== "other")
    .map((t) => {
      const fromDB = configs.find((c) => c.type === t);
      const desc = fromDB?.description ?? fallbackDescriptions[t] ?? t;
      return `- ${t}：${desc}`;
    })
    .join("\n");

  const messages: Array<{ role: "user"; content: string | Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> }> = [];

  if (imageData) {
    // Strip the data URL prefix to get raw base64 + extract mime type
    const match = (imageData as string).match(/^data:(image\/\w+);base64,(.+)$/);
    const mimeType = match ? match[1] : "image/png";
    const base64 = match ? match[2] : imageData;

    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `請判斷以下數學題目屬於什麼題型。題目文字：${question || "（見圖片）"}`,
        },
        {
          type: "image",
          image: base64,
          mimeType,
        },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: `請判斷以下數學題目屬於什麼題型。題目：${question}`,
    });
  }

  const result = await generateObject({
    model: azure(process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o"),
    system: `你是一位數學題型分類專家。根據學生輸入的題目，判斷它屬於哪個題型。

分類原則（非常重要）：
- 根據題目所需的**核心數學運算**來分類，而非題目的表面情境或故事背景
- 例如：「把 3⅝ L 橙汁倒進 ¼ L 的杯子」雖然是應用題，但核心運算是分數除法，應分類為 fraction
- 只有當題目的核心運算確實不屬於任何已定義的題型時，才分類為 other

可選題型：
${typeDescriptions}
- other：其他題型（核心運算不屬於以上任何題型）

同時提取題目的文字描述。如果是圖片題目，請描述圖片中的數學題目內容。

重要：在 question 欄位中，數學表達式使用 LaTeX 指令，但**不要**加 $ 符號：
- 分數用 \\frac{分子}{分母}，例如 \\frac{5}{6}
- 帶分數用 整數\\frac{分子}{分母}，例如 2\\frac{5}{6}
- 乘號用 \\times，除號用 \\div
- 單位用 \\text{單位}，例如 \\text{L}
- 填空位置留空即可，例如 \\frac{}{12} 表示分子待填
- 不要使用 $ 或 $$ 符號

範例輸出：店員把 3\\frac{5}{8} \\text{L} 橙汁倒進一些玻璃杯裏，每隻玻璃杯的容量是 \\frac{1}{4} \\text{L}，最多可倒滿 隻玻璃杯。`,
    schema: z.object({
      type: z
        .enum(allTypes)
        .describe("題型分類"),
      question: z
        .string()
        .describe("題目的文字描述，使用 LaTeX 數學格式"),
    }),
    messages,
  });

  const obj = result.object;

  // Record token usage after response is sent
  after(async () => {
    try {
      const session = await getSession().catch(() => null);
      await recordTokenUsage({
        session,
        subject: "math",
        topic: "question-classify",
        modelName: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
        endpoint: "/api/classify",
        usage: result.usage,
      });
    } catch (err) {
      console.error("[classify] Failed to record token usage:", err);
    }
  });

  // 1. Fix JSON-broken escapes  2. Strip stray $ delimiters  3. Re-wrap properly
  let q = fixBrokenLatex(obj.question);
  q = q.replace(/\$\$/g, " ").replace(/\$/g, "");
  q = ensureLatexDelimiters(q);
  return Response.json({ ...obj, question: q });
}
