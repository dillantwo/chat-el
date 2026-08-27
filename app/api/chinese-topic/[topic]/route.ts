import { azure } from "@ai-sdk/azure";
import { streamText } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  CHINESE_CHARACTER_DESCRIPTION_SYSTEM_PROMPT,
  CHINESE_LIN_ZEXU_SYSTEM_PROMPT,
  CHINESE_SCENERY_DESCRIPTION_SYSTEM_PROMPT,
} from "@/lib/chinese-prompts";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { recordTokenUsage } from "@/lib/token-usage";

// Each Chinese writing topic shares the same Azure-backed chat pipeline and
// only differs by its system prompt. Add a new topic by extending this map and
// creating a matching page that points at /api/chinese-topic/<topic>.
const TOPIC_PROMPTS: Record<string, string> = {
  "lin-zexu": CHINESE_LIN_ZEXU_SYSTEM_PROMPT,
  scenery: CHINESE_SCENERY_DESCRIPTION_SYSTEM_PROMPT,
  character: CHINESE_CHARACTER_DESCRIPTION_SYSTEM_PROMPT,
};

// These slugs are shorter than the topic keys an admin toggles in 學校管理, so
// map them across. Keep in sync with TOPIC_PROMPTS and lib/topics.ts.
const TOPIC_KEYS: Record<string, string> = {
  "lin-zexu": "lin-zexu",
  scenery: "scenery-description",
  character: "character-description",
};

type InputImage = {
  mediaType: string;
  data: string;
};

type InputMessage = {
  role: "user" | "assistant";
  text: string;
  images?: InputImage[];
};

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1],
    data: match[2],
  };
}

function toModelMessages(messages: InputMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: [{ type: "text", text: message.text }],
      };
    }

    const content: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; data: string }
    > = [];

    if (message.text.trim()) {
      content.push({ type: "text", text: message.text });
    }

    for (const image of message.images ?? []) {
      const parsed = parseDataUrl(image.data);
      if (!parsed) {
        continue;
      }

      content.push({
        type: "file",
        mediaType: parsed.mediaType || image.mediaType,
        data: parsed.data,
      });
    }

    return { role: "user", content };
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ topic: string }> }
) {
  const { topic } = await params;
  const endpoint = `/api/chinese-topic/${topic}`;

  try {
    const systemPrompt = TOPIC_PROMPTS[topic];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown topic: ${topic}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const denied = await requireTopicApi("chinese", TOPIC_KEYS[topic]);
    if (denied) return denied;

    const { messages, chatId } = (await req.json()) as {
      messages: InputMessage[];
      chatId?: string;
    };

    const session = await getSession().catch(() => null);
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1";

    const result = streamText({
      model: azure(deploymentName),
      system: systemPrompt,
      messages: toModelMessages(messages ?? []),
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "chinese",
        topic,
        modelName: deploymentName,
        endpoint,
        usage: await result.usage,
        chatId,
      });
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error(`[chinese-topic:${topic}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
