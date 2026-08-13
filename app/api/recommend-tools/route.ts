import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { requireTopicApi } from "@/lib/subject-access";

export async function POST(req: Request) {
  const denied = await requireTopicApi("math", "ai-problem-solving");
  if (denied) return denied;

  const { question, tools } = await req.json();

  if (!question || !tools || tools.length === 0) {
    return Response.json({ recommendedKeys: [] });
  }

  const toolDescriptions = (tools as { key: string; label: string; sub: string }[])
    .map((t) => `- ${t.key}：${t.label}（${t.sub}）`)
    .join("\n");

  const result = await generateObject({
    model: azure(process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o"),
    system: `你是一位數學教育專家。根據學生的題目，從可用工具列表中推薦最適合的工具。只推薦與題目核心運算直接相關的工具，通常只推薦 1-2 個。`,
    messages: [
      {
        role: "user",
        content: `題目：${question}\n\n可用工具：\n${toolDescriptions}\n\n請推薦最適合解這道題的工具。`,
      },
    ],
    schema: z.object({
      recommendedKeys: z
        .array(z.string())
        .describe("推薦的工具 key 列表"),
    }),
  });

  return Response.json(result.object);
}
