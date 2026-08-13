import { azure } from "@ai-sdk/azure";
import { streamText } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  HUMANITIES_WATER_RESOURCES_SYSTEM_PROMPT,
  HUMANITIES_ANTI_JAPANESE_WAR_SYSTEM_PROMPT,
} from "@/lib/humanities-prompts";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { recordTokenUsage } from "@/lib/token-usage";
import { retrieveContext, buildAugmentedPrompt, latestUserText } from "@/lib/rag";

// Each Humanities topic shares the same Azure-backed chat pipeline and only
// differs by its system prompt. Add a new topic by extending this map and
// creating a matching page that points at /api/humanities-topic/<topic>.
const TOPIC_PROMPTS: Record<string, string> = {
  "water-resources": HUMANITIES_WATER_RESOURCES_SYSTEM_PROMPT,
  "anti-japanese-war": HUMANITIES_ANTI_JAPANESE_WAR_SYSTEM_PROMPT,
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
  const endpoint = `/api/humanities-topic/${topic}`;

  try {
    const systemPrompt = TOPIC_PROMPTS[topic];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown topic: ${topic}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Checked against the database: the page guard can be bypassed by calling
    // this endpoint directly. The URL topic slug doubles as the topic key in
    // lib/topics.ts.
    const denied = await requireTopicApi("humanities", topic);
    if (denied) return denied;

    const { messages } = (await req.json()) as { messages: InputMessage[] };
    const inputMessages = messages ?? [];

    // Retrieve topic-specific knowledge from Pinecone (namespace = topic slug)
    // and inject it into the system prompt. No-op when RAG is not configured.
    const { chunks, ragTokens } = await retrieveContext(
      topic,
      latestUserText(inputMessages)
    );
    const augmentedPrompt = buildAugmentedPrompt(systemPrompt, chunks);

    const session = await getSession().catch(() => null);
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1";

    const result = streamText({
      model: azure(deploymentName),
      system: augmentedPrompt,
      messages: toModelMessages(inputMessages),
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "humanities",
        topic,
        modelName: deploymentName,
        endpoint,
        usage: await result.usage,
        ragTokens,
      });
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error(`[humanities-topic:${topic}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
