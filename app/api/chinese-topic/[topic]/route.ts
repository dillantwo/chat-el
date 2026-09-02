import { azure } from "@ai-sdk/azure";
import { streamText } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  CHINESE_LIN_ZEXU_SYSTEM_PROMPT,
  CHINESE_SCENERY_DESCRIPTION_SYSTEM_PROMPT,
} from "@/lib/chinese-prompts";
import {
  buildChineseCharacterSystemPrompt,
  detectChineseCharacterMode,
} from "@/lib/chinese-character-prompt";
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
};

// `character` is the exception: it is three exercises behind one page, so its
// prompt is assembled from the transcript rather than looked up. Kept out of
// TOPIC_PROMPTS and handled in resolveSystemPrompt below.
const ASSEMBLED_TOPICS = new Set(["character"]);

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

/**
 * The 人物描寫 mode is fixed by the quick-start button the student pressed, which
 * is stored as the first user message — so it is read off the transcript here
 * rather than trusted from a separate client field, and it survives a
 * conversation reopened from the history sidebar.
 */
function resolveSystemPrompt(topic: string, messages: InputMessage[]): string | undefined {
  if (topic === "character") {
    const firstUserText = messages.find((message) => message.role === "user")?.text;
    return buildChineseCharacterSystemPrompt(detectChineseCharacterMode(firstUserText));
  }

  return TOPIC_PROMPTS[topic];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ topic: string }> }
) {
  const { topic } = await params;
  const endpoint = `/api/chinese-topic/${topic}`;

  try {
    // Reject unknown topics before reading the body or hitting the DB.
    if (!(topic in TOPIC_PROMPTS) && !ASSEMBLED_TOPICS.has(topic)) {
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

    const systemPrompt = resolveSystemPrompt(topic, messages ?? []);
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown topic: ${topic}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

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
