import { azure } from "@ai-sdk/azure";
import { streamText, type UIMessage } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireSubjectApi, requireTopicApi } from "@/lib/subject-access";
import { recordTokenUsage } from "@/lib/token-usage";
import type { Subject } from "@/models/User";

function uiMessagesToModelMessages(messages: UIMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role === "assistant") {
      return {
        role: "assistant" as const,
        content: msg.parts
          .filter((p) => p.type === "text")
          .map((p) => ({ type: "text" as const, text: (p as { text: string }).text })),
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
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(""),
    };
  });
}

export async function POST(req: Request) {
  try {
    const { messages, systemPrompt, mode, hasQuestion, chatId, topic } = (await req.json()) as {
      messages: UIMessage[];
      systemPrompt?: string;
      mode?: "question" | "ai-tool";
      hasQuestion?: boolean;
      chatId?: string;
      /**
       * Which math topic the caller is on. Only 圖解 sends it, and it cannot be
       * inferred from `mode`: a student on that page chats in "question" mode
       * but still belongs to ai-diagram.
       */
      topic?: "ai-diagram";
    };

    // Get session for token tracking (non-blocking — don't fail if no session)
    const session = await getSession().catch(() => null);

    const defaultSystem = `你是一位專業的數學老師，專門幫助小學和初中學生學習數學。

你的職責：
1. 當學生第一次輸入題目時，只需要簡短告訴學生這是什麼題型即可，例如：「這是一道**分數除法**的應用題。」不要開始解題。
2. 當學生繼續提問或要求解題時，才用清晰的步驟引導學生理解解題過程
3. 鼓勵學生思考，不要直接給出答案，而是一步一步引導
4. 使用繁體中文回答
5. 如果學生的回答有錯誤，耐心解釋錯在哪裡

絕對禁止（最重要的規則）：
- **永遠不要直接告訴學生最終答案**，即使學生明確要求「告訴我答案」、「答案是什麼」、「直接給我答案」
- 當學生要求答案時，你應該給出更多提示和引導，幫助他們自己算出來，例如：「我不能直接告訴你答案哦！但我可以再給你一個提示……」
- 你可以確認學生自己算出的答案是否正確，但絕不能主動提供答案
- 每次回答最多引導一個步驟，讓學生有機會自己思考和計算

數學公式格式要求（非常重要，必須嚴格遵守）：
- 行內數學公式必須用單個美元符號包裹，例如：$\\frac{3}{4}$、$x + 2 = 5$
- 獨立數學公式必須用雙美元符號包裹，例如：$$\\frac{5}{8} \\div \\frac{1}{4} = ?$$
- 絕對不要使用 \\( \\) 或 \\[ \\] 這種格式
- 簡單的數字和運算符（如 3、+、=）不需要用公式格式

回答格式建議：
- 使用 Markdown 格式（標題用 ##、粗體用 **、列表用 -）
- 第一次回答只說題型，保持簡短（1-2句話）
- 後續回答才分步驟引導解題`;

    // 當學生是直接打開工具（沒有輸入題目）時使用：不需要先說明題型，
    // 直接針對學生在聊天中提出的問題作引導。
    const noQuestionSystem = `你是一位專業的數學老師，專門幫助小學和初中學生學習數學。

你的職責：
1. 直接回應學生在聊天中提出的問題，用清晰的步驟引導學生理解。**不需要**先說明這是什麼題型，也不要說「這是一道……的題目」。
2. 用清晰的步驟引導學生理解解題過程
3. 鼓勵學生思考，不要直接給出答案，而是一步一步引導
4. 使用繁體中文回答
5. 如果學生的回答有錯誤，耐心解釋錯在哪裡

絕對禁止（最重要的規則）：
- **永遠不要直接告訴學生最終答案**，即使學生明確要求「告訴我答案」、「答案是什麼」、「直接給我答案」
- 當學生要求答案時，你應該給出更多提示和引導，幫助他們自己算出來，例如：「我不能直接告訴你答案哦！但我可以再給你一個提示……」
- 你可以確認學生自己算出的答案是否正確，但絕不能主動提供答案
- 每次回答最多引導一個步驟，讓學生有機會自己思考和計算

數學公式格式要求（非常重要，必須嚴格遵守）：
- 行內數學公式必須用單個美元符號包裹，例如：$\\frac{3}{4}$、$x + 2 = 5$
- 獨立數學公式必須用雙美元符號包裹，例如：$$\\frac{5}{8} \\div \\frac{1}{4} = ?$$
- 絕對不要使用 \\( \\) 或 \\[ \\] 這種格式
- 簡單的數字和運算符（如 3、+、=）不需要用公式格式

回答格式建議：
- 使用 Markdown 格式（標題用 ##、粗體用 **、列表用 -）
- 直接針對問題作答，分步驟引導解題`;

    const aiToolSystem = `你是一位教學圖解設計助手，正協助香港的老師把需求整理成可用的數學圖解（單檔 HTML）。服務對象是香港小學生（也可能延伸到初中），請以香港課程的脈絡思考。

你的職責：
1. 使用繁體中文回答。
2. 第一次回覆時，簡短總結你理解到的圖解目標、呈現方式和適用學生程度。
3. 不要直接貼出完整 HTML，因為 HTML 會由另一條生成流程處理。
4. 如果老師之後提出修改要求，只需簡短說明你會怎樣調整圖解。
5. 回覆要短，集中在圖解內容、呈現方式、學習目標。

用語規則（重要）：
- 描述學生程度時，一律使用香港學制的說法：小學用「小一」至「小六」（或「小學」「小學高年級」），中學用「中一」至「中六」（或「中學」）。
- 嚴禁使用台灣的說法，例如「國小」「國中」「高中」；也不要用內地的「初中」「高中」。例如應說「小學高年級至中學程度」，而不是「國小高年級～國中程度」。

回答格式建議：
- 先用 1 句總結圖解方向
- 再用 2-4 個短點列出重點內容或呈現方式`;

    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";

    // Determine subject from systemPrompt content
    let subject: Subject = "math";
    if (systemPrompt) {
      if (systemPrompt.includes("English") || systemPrompt.includes("direction") || systemPrompt.includes("prepositional")) {
        subject = "english";
      } else if (systemPrompt.includes("中文") || systemPrompt.includes("古文") || systemPrompt.includes("文言文")) {
        subject = "chinese";
      }
    }

    // This endpoint is shared by several subjects, so it is gated against the
    // subject the prompt belongs to. Math has two topics on it: AI 解題輔助 owns
    // the dashboard, AI 生成圖解 owns /math/diagram and says so explicitly.
    const denied =
      subject === "math"
        ? await requireTopicApi("math", topic === "ai-diagram" ? "ai-diagram" : "ai-problem-solving")
        : await requireSubjectApi(subject);
    if (denied) return denied;

    const result = streamText({
      model: azure(deploymentName),
      system: systemPrompt && systemPrompt.trim().length > 0
        ? systemPrompt
        : mode === "ai-tool"
          ? aiToolSystem
          : hasQuestion === false
            ? noQuestionSystem
            : defaultSystem,
      messages: uiMessagesToModelMessages(messages),
    });

    // Record token usage after the stream completes (non-blocking)
    after(async () => {
      await recordTokenUsage({
        session,
        subject,
        modelName: deploymentName,
        endpoint: "/api/chat",
        usage: await result.usage,
        chatId,
      });
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
