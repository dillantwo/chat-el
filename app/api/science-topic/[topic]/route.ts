import { azure } from "@ai-sdk/azure";
import { streamText } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  SCIENCE_CIRCUIT_SYSTEM_PROMPT,
  SCIENCE_AEROSPACE_SYSTEM_PROMPT,
} from "@/lib/science-prompts";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { recordTokenUsage } from "@/lib/token-usage";
import { retrieveContext, buildAugmentedPrompt, latestUserText } from "@/lib/rag";

// Each Science topic shares the same Azure-backed chat pipeline and only
// differs by its system prompt. Add a new topic by extending this map and
// creating a matching page that points at /api/science-topic/<topic>.
// Every prompt handles both languages itself (it answers in whatever language
// the student writes in), so the route does not sniff the question language.
const TOPIC_PROMPTS: Record<string, string> = {
  circuit: SCIENCE_CIRCUIT_SYSTEM_PROMPT,
  aerospace: SCIENCE_AEROSPACE_SYSTEM_PROMPT,
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
  const endpoint = `/api/science-topic/${topic}`;

  try {
    const systemPrompt = TOPIC_PROMPTS[topic];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown topic: ${topic}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // The URL topic slug doubles as the topic key in lib/topics.ts.
    const denied = await requireTopicApi("science", topic);
    if (denied) return denied;

    const { messages } = (await req.json()) as { messages: InputMessage[] };
    const inputMessages = messages ?? [];

    // Retrieve topic-specific knowledge from Pinecone and inject it into the
    // system prompt. No-op when RAG is not configured for this topic.
    const { chunks, ragTokens, description } = await retrieveContext(
      topic,
      latestUserText(inputMessages)
    );
    const augmentedPrompt = buildAugmentedPrompt(systemPrompt, chunks, description);

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
        subject: "science",
        topic,
        modelName: deploymentName,
        endpoint,
        usage: await result.usage,
        ragTokens,
      });
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error(`[science-topic:${topic}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
