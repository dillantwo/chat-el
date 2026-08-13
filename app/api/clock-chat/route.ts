import { azure } from "@ai-sdk/azure";
import { streamText, type UIMessage } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { canUseMathTool, mathToolDenied } from "@/lib/toolbox-access";
import { recordTokenUsage } from "@/lib/token-usage";

type Clock24HoursState = {
  tool: "clock-24hrs";
  currentTime: number;
  displayTime: string;
  periodLabel: string;
  is24HDisplay: boolean;
  show24Numbers: boolean;
  snapTo5Min: boolean;
  showAngle: boolean;
  angleDegrees: number;
  isDayTime: boolean;
};

type ClockTimeDifferenceState = {
  tool: "clock-time-difference";
  startTime: number;
  endTime: number;
  startLabel: string;
  endLabel: string;
  is24H: boolean;
  diffMinutes: number;
  expectedHours: number;
  expectedMinutes: number;
  quizTargetDiff: number | null;
  feedbackKind: "idle" | "correct" | "wrong";
  showSteps: boolean;
};

type ClockToolState = Clock24HoursState | ClockTimeDifferenceState;

function uiMessagesToModelMessages(messages: UIMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role === "assistant") {
      return {
        role: "assistant" as const,
        content: msg.parts
          .filter((part) => part.type === "text")
          .map((part) => ({ type: "text" as const, text: (part as { text: string }).text })),
      };
    }

    if (msg.role === "user") {
      const content: Array<
        | { type: "text"; text: string }
        | { type: "file"; data: string; mediaType: string }
      > = [];

      for (const part of msg.parts) {
        if (part.type === "text") {
          content.push({ type: "text", text: part.text });
        } else if (part.type === "file") {
          const url = part.url;
          if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              content.push({ type: "file", mediaType: match[1], data: match[2] });
            }
          } else {
            content.push({ type: "file", mediaType: part.mediaType, data: url });
          }
        }
      }

      return { role: "user" as const, content };
    }

    return {
      role: "system" as const,
      content: msg.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join(""),
    };
  });
}

function buildSystemPrompt(clockState: ClockToolState | null) {
  const base = `你是一位專門教學生理解時鐘概念的數學老師，正在配合互動時鐘工具即時指導學生。

教學原則：
1. 使用繁體中文，語氣簡潔、友善、像老師一步一步提示學生。
2. 永遠不要直接說出最終答案；只可以提示、提問、拆步驟、幫學生檢查方向。
3. 每次最多推進一小步，讓學生自己觀察、自己回答。
4. 盡量根據工具的即時狀態說話，例如目前時間、時針分鐘位置、24 小時制、AM/PM、時間差、是否要借位。
5. 如果學生回答錯，只指出最可能忽略的位置，不要直接公布答案。
6. 可以用 Markdown，但保持簡短，不要長篇大論。
7. 行內數學用 $...$，獨立算式用 $$...$$。
8. 你可以使用系統提供的即時數據做內部判斷，但不要以「系統說」或「資料顯示」這種方式回答。要自然地轉成教學提示。`;

  if (!clockState) {
    return `${base}

目前還沒有同步到時鐘工具狀態。先請學生操作時鐘，再根據學生提問做一般性的時鐘概念引導。`;
  }

  if (clockState.tool === "clock-24hrs") {
    return `${base}

目前工具狀態（僅供你內部參考，不可逐字搬出）：
- 工具：24 小時制時鐘
- 目前時間：${clockState.displayTime} ${clockState.periodLabel}
- 目前以 ${clockState.is24HDisplay ? "24 小時制" : "12 小時制"} 顯示
- 外圈 24 小時數字：${clockState.show24Numbers ? "顯示中" : "未顯示"}
- 吸附到 5 分鐘：${clockState.snapTo5Min ? "開啟" : "關閉"}
- 夾角顯示：${clockState.showAngle ? `開啟，目前約 ${clockState.angleDegrees.toFixed(1)} 度` : "關閉"}
- 目前屬於：${clockState.isDayTime ? "白天時段" : "夜晚時段"}

教學重點：
- 如果學生問「現在幾點」，先引導他看長針代表分鐘、短針代表小時，再請他自己讀。
- 如果學生問 12 小時制和 24 小時制，先引導他觀察上午/下午對應，再請他自己轉換。
- 如果學生問夾角，先引導他找出兩枝針各自的位置，再思考較小的夾角。`;
  }

  return `${base}

目前工具狀態（僅供你內部參考，不可逐字搬出）：
- 工具：時間差時鐘
- Time 1：${clockState.startLabel}
- Time 2：${clockState.endLabel}
- 模式：${clockState.is24H ? "24 小時制" : "AM/PM"}
- 真實時間差：${clockState.expectedHours} 小時 ${clockState.expectedMinutes} 分鐘
- 總分鐘差：${clockState.diffMinutes} 分鐘
- 隨機挑戰目標：${clockState.quizTargetDiff === null ? "目前沒有" : `${Math.floor(clockState.quizTargetDiff / 60)} 小時 ${clockState.quizTargetDiff % 60} 分鐘`}
- 學生最近一次檢查結果：${clockState.feedbackKind}
- 詳解面板：${clockState.showSteps ? "已打開" : "未打開"}

教學重點：
- 如果學生問怎樣算時間差，先引導他確認先後順序，再把小時和分鐘分開看。
- 如果分鐘不夠減，提醒他用「借 1 小時就是 60 分鐘」去想，但不要直接代算到底。
- 如果學生懷疑是否跨日，只提示他比較前後時間的先後，不要直接宣布答案。`;
}

export async function POST(req: Request) {
  try {
    const { messages, clockState } = (await req.json()) as {
      messages: UIMessage[];
      clockState?: ClockToolState;
    };

    // Two tools share this endpoint and each has its own switches, so the check
    // follows the clock the request is about. `clockState` is client-supplied, so
    // the tool name is matched against this endpoint's own two tools rather than
    // trusted: otherwise naming any tool the school happens to hold would buy
    // clock tutoring. Anything else falls back to "must hold a clock", which is
    // also what a request without state gets.
    const requestedClock =
      clockState?.tool === "clock-24hrs" || clockState?.tool === "clock-time-difference"
        ? clockState.tool
        : null;

    const allowed = requestedClock
      ? await canUseMathTool(requestedClock)
      : (await canUseMathTool("clock-24hrs")) || (await canUseMathTool("clock-time-difference"));

    if (!allowed) return mathToolDenied();

    const session = await getSession().catch(() => null);
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";

    const result = streamText({
      model: azure(deploymentName),
      system: buildSystemPrompt(clockState ?? null),
      messages: uiMessagesToModelMessages(messages),
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "math",
        topic: "clock",
        modelName: deploymentName,
        endpoint: "/api/clock-chat",
        usage: await result.usage,
      });
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[clock-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}