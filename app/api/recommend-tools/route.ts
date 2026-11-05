import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { requireTopicApi } from "@/lib/subject-access";
import { sanitizeSteps, stepToolTakesNumbers } from "@/lib/math-tool-steps";

const numberSchema = z
  .object({
    whole: z.number().int().describe("整數部分；真分數為 0；純整數就是該整數"),
    num: z.number().int().describe("分子；純整數時為 0"),
    den: z.number().int().describe("分母；純整數時為 1，或是要化成的分母"),
  })
  .nullable();

const planSchema = z.object({
  analysis: z.string().describe("先用一兩句說明題目問甚麼、要怎樣一步一步算（純文字）"),
  steps: z
    .array(
      z.object({
        toolKey: z.string().describe("這一步用的工具 key，必須來自可用工具列表"),
        title: z.string().describe("這一步要做甚麼，簡短一句，例如「紅豆和綠豆共佔全部的幾分之幾？」"),
        operand1: numberSchema.describe(
          "四則運算的第一個數；整數與分數互換時是要轉換的數；相等分數（擴分約分）時是這一步要擴分或約分的分數；其他工具為 null"
        ),
        operand2: numberSchema.describe("四則運算的第二個數；其他工具為 null"),
        convertMode: z
          .enum(["whole", "fraction", "mixed"])
          .nullable()
          .describe("只用於整數與分數互換：operand1 原本的型態；其他工具為 null"),
        equivalentMode: z
          .enum(["expand", "simplify"])
          .nullable()
          .describe("只用於相等分數（擴分約分）：expand = 擴分，simplify = 約分；其他工具為 null"),
        context: z
          .string()
          .nullable()
          .describe("只用於四則運算：這一步的題目文字（純文字），兩個數的位置寫 [FRAC1]、[FRAC2]；其他工具為 null"),
      })
    )
    .describe("依解題順序排列的步驟"),
});

const SYSTEM_PROMPT = `你是一位小學數學老師。先理解整道題目，再把解題過程拆成步驟，每一步配一個最適合的工具，讓學生跟着步驟用工具解題。

規則：
- 先想清楚題目真正問甚麼，只拆出解答需要的運算。與答案無關的數字不要用（例如題目問「佔全部的幾分之幾」，總重量「2 公斤」就與答案無關）。
- 四則運算工具（fraction-addition / fraction-subtraction / fraction-multiplication / fraction-division）一次只算兩個數：operand1 運算 operand2。
- 四則運算的 operand1、operand2 要用分數（真分數、假分數或帶分數），不要直接用純整數。
- 運算中需要用到整數時（例如「全部」= 1、或「2 公斤」），先加一步 fraction-converting（整數與分數互換），把整數化成分數，分母用下一步需要的分母；下一步再用化好的分數運算。
  - 整數與分數互換的參數：operand1 = { whole: 該整數, num: 0, den: 要化成的分母 }，convertMode = "whole"
- 後面的步驟可以用前面步驟的結果（例如第 1 步得 5/8，第 3 步用 5/8）。
- 相等分數（fraction-expanding-simplifying，擴分約分）一次只處理一個分數：operand1 = 這一步要擴分或約分的真分數，equivalentMode = "expand"（擴分）或 "simplify"（約分）。題目有幾個分數，就拆成幾步，每個分數只用一步、帶自己的分數（例如先 4/6，再 5/10），不要每一步都用同一個分數。
  - 學生在同一個工具裏調整倍數（×2、×3、×4……）就能看到這個分數所有的擴分結果，所以不要按倍數或擴分次數拆步驟。例如「觀察 4/6 和 5/10 的首 5 個擴分」只有兩步：4/6 一步、5/10 一步。
  - title 寫這一步觀察哪個分數，例如「用工具觀察 4/6 的擴分」，不要寫「擴分 5 次」、「乘 5 次」等字眼。
- 其他概念題（比較大小、帶分數與假分數互換等），就只推薦一個對應的工具，operand 等欄位設為 null。
- context 是給學生看的這一步題目，保留題目的情境和單位，兩個數的位置分別寫 [FRAC1]、[FRAC2]，不要寫出答案，不可用 LaTeX。
- 步驟通常 1–4 個，不要超過 6 個。toolKey 只能用可用工具列表裏的 key。

例子：
題目：現有雜豆 2 公斤，紅豆佔全部的 1/4，綠豆佔全部的 3/8，餘下的是黃豆，黃豆佔全部的幾分之幾？
steps:
1. fraction-addition，title「紅豆和綠豆共佔全部的幾分之幾？」，operand1={0,1,4}，operand2={0,3,8}，context「紅豆佔全部的 [FRAC1]，綠豆佔全部的 [FRAC2]，紅豆和綠豆共佔全部的幾分之幾？」
2. fraction-converting，title「把全部（1）化成分母是 8 的分數」，operand1={1,0,8}，convertMode="whole"
3. fraction-subtraction，title「黃豆佔全部的幾分之幾？」，operand1={0,8,8}，operand2={0,5,8}，context「全部是 [FRAC1]，紅豆和綠豆共佔 [FRAC2]，黃豆佔全部的幾分之幾？」`;

export async function POST(req: Request) {
  const denied = await requireTopicApi("math", "ai-problem-solving");
  if (denied) return denied;

  let body: { question?: unknown; tools?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const tools = (Array.isArray(body.tools) ? body.tools : []).filter(
    (t): t is { key: string; label: string; sub: string } =>
      !!t && typeof t === "object" && typeof (t as { key?: unknown }).key === "string"
  );

  if (!question || tools.length === 0) {
    return Response.json({ steps: [], recommendedKeys: [] });
  }

  const toolDescriptions = tools
    .map((t) => {
      const note = stepToolTakesNumbers(t.key) ? "（可帶入這一步的數字）" : "";
      return `- ${t.key}：${t.label ?? ""}（${t.sub ?? ""}）${note}`;
    })
    .join("\n");

  try {
    const result = await generateObject({
      model: azure(process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o"),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `題目：${question}\n\n可用工具：\n${toolDescriptions}\n\n請拆解解題步驟並為每一步推薦工具。`,
        },
      ],
      schema: planSchema,
    });

    const allowedKeys = new Set(tools.map((t) => t.key));
    const steps = sanitizeSteps(result.object.steps, allowedKeys);
    const recommendedKeys = [...new Set(steps.map((s) => s.toolKey))];

    return Response.json({ steps, recommendedKeys });
  } catch (err) {
    console.error("[recommend-tools] planning failed", err);
    return Response.json({ steps: [], recommendedKeys: [] });
  }
}
