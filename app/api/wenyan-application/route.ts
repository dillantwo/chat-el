import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { CHINESE_WENYAN_APPLICATION_SYSTEM_PROMPT } from "@/lib/chinese-prompts";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { recordTokenUsage } from "@/lib/token-usage";

const schema = z.object({
  understandingScore: z
    .number()
    .min(0)
    .max(50)
    .describe("主旨理解得分（0–50）：學生的例子是否反映正確理解了文章主旨"),
  applicationScore: z
    .number()
    .min(0)
    .max(50)
    .describe("應用場景得分（0–50）：學生舉出的生活情境是否恰當、具體、合理"),
  understandingComment: z
    .string()
    .describe("解釋主旨理解得分的原因，40 字以內"),
  applicationComment: z
    .string()
    .describe("解釋應用場景得分的原因，40 字以內"),
  suggestion: z
    .string()
    .describe("一句具體、可操作的改進建議，40 字以內"),
  exemplar: z
    .string()
    .describe("示範一個生活中貼切的例子（隱喻／情境），供學生參考"),
});

export async function POST(req: Request) {
  const endpoint = "/api/wenyan-application";

  try {
    const denied = await requireTopicApi("chinese", "wenyan");
    if (denied) return denied;

    const { title, source, original, translation, mainIdea, userInput } =
      (await req.json()) as {
        title?: string;
        source?: string;
        original?: string;
        translation?: string;
        mainIdea?: string;
        userInput?: string;
      };

    if (!original || !mainIdea || !userInput || !userInput.trim()) {
      return Response.json({ error: "請先寫出你的生活例子" }, { status: 400 });
    }

    const session = await getSession().catch(() => null);
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1";

    const result = await generateObject({
      model: azure(deploymentName),
      schema,
      system: CHINESE_WENYAN_APPLICATION_SYSTEM_PROMPT,
      prompt: `文章標題：「${title ?? ""}」${source ? `（${source}）` : ""}

原文：「${original}」

白話翻譯：「${translation ?? ""}」

這篇文章隱含的主旨（道理）：「${mainIdea}」

學生想出的生活例子（隱喻／情境）：「${userInput.trim()}」

請從「主旨理解」和「應用場景」兩部分為學生評分，並給出鼓勵、改進建議和一個示範例子。`,
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "chinese",
        topic: "wenyan-application",
        modelName: deploymentName,
        endpoint,
        usage: result.usage,
      });
    });

    const obj = result.object;
    const understandingScore = Math.round(
      Math.max(0, Math.min(50, obj.understandingScore))
    );
    const applicationScore = Math.round(
      Math.max(0, Math.min(50, obj.applicationScore))
    );

    return Response.json({
      ...obj,
      understandingScore,
      applicationScore,
      total: understandingScore + applicationScore,
    });
  } catch (error) {
    console.error("[wenyan-application] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
