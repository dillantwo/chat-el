import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { requireMathToolApi } from "@/lib/toolbox-access";
import { recordTokenUsage } from "@/lib/token-usage";
import { applyReplyLanguage } from "@/lib/i18n/ai";
import { defineCopy } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

/** Feedback the route writes itself, without the model. */
const COPY = defineCopy({
  "zh-Hant": {
    empty: "請先寫下你對這一段行程的描述。",
    failed: "暫時未能連接 AI 判斷，請稍後再試。",
  },
  en: {
    empty: "Please write your description of this part of the journey first.",
    failed: "The AI checker is not available right now. Please try again later.",
  },
});

const schema = z.object({
  isCorrect: z.boolean().describe("學生答案是否能準確描述該段行程"),
  score: z.number().min(0).max(100).describe("0 至 100 分"),
  feedback: z.string().describe("給學生的繁體中文簡短回饋，不直接透露其他段答案"),
});

export async function POST(req: Request) {
  const locale = await getLocale();
  const copy = COPY[locale];

  try {
    const denied = await requireMathToolApi("journey-graph");
    if (denied) return denied;

    const body = (await req.json()) as {
      levelTitle?: string;
      segmentLabel?: string;
      studentAnswer?: string;
      expectedDescription?: string;
      mustInclude?: string[];
    };

    const studentAnswer = body.studentAnswer?.trim() ?? "";
    if (!studentAnswer) {
      return Response.json({
        isCorrect: false,
        score: 0,
        feedback: copy.empty,
      });
    }

    const session = await getSession().catch(() => null);
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";

    const result = await generateObject({
      model: azure(deploymentName),
      schema,
      system: applyReplyLanguage(`你是一位小學數學老師，正在批改學生對「距離-時間行程圖」每一段的描述。

判斷規則：
- 只評核目前這一段，不要評核其他段。
- 學生不需要逐字相同；只要意思正確即可。
- 可接受口語、繁體中文、簡體中文，或夾雜少量英文。
- 答案應說明物件在該時間段的移動狀態，例如：遠離/返回/停留/速度較快或較慢/兩者是否相交。
- 如缺少關鍵意思，isCorrect 為 false，feedback 用一句提示引導學生補充。
- 如大致正確但不完整，score 可給 60-79，isCorrect 為 false。
- 如準確表達主要意思，score 給 80-100，isCorrect 為 true。
- feedback 必須使用繁體中文，最多兩句，語氣鼓勵。`, locale, "structured"),
      prompt: `關卡：${body.levelTitle ?? "行程圖"}
段落：${body.segmentLabel ?? "目前段落"}
標準描述：${body.expectedDescription ?? ""}
必須包含的重點：${(body.mustInclude ?? []).join("、")}
學生答案：${studentAnswer}`,
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "math",
        topic: "journey-graph",
        modelName: deploymentName,
        endpoint: "/api/journey-check",
        usage: result.usage,
      });
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("[journey-check] Error:", error);
    return Response.json(
      {
        isCorrect: false,
        score: 0,
        feedback: copy.failed,
      },
      { status: 500 }
    );
  }
}
