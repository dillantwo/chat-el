import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { MathChatHistory } from "@/models/MathChatHistory";

interface SavedMessagePart {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

interface SavedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: SavedMessagePart[];
}

export async function GET(req: Request) {
  try {
    const denied = await requireTopicApi("math", "ai-problem-solving");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId")?.trim();

    if (chatId) {
      const doc = await MathChatHistory.findOne({ userId: session.userId, chatId }).lean();
      if (!doc) {
        return Response.json({ item: null });
      }

      return Response.json({
        item: {
          id: String(doc.chatId),
          kind: doc.kind,
          title: String(doc.title),
          hasUserQuestion: Boolean(doc.hasUserQuestion),
          question: doc.question ? String(doc.question) : undefined,
          type: doc.type ? String(doc.type) : undefined,
          selectedTool: typeof doc.selectedTool === "string" ? doc.selectedTool : null,
          toolUrl: doc.toolUrl ? String(doc.toolUrl) : undefined,
          entryMode: doc.entryMode,
          messages: Array.isArray(doc.messages) ? doc.messages : [],
          updatedAt: doc.updatedAt,
        },
      });
    }

    // Metadata only — see the note in the Chinese equivalent: `messages` holds
    // the full transcript (base64 images included) and the sidebar never reads
    // it, so it is projected out and fetched per chat via ?chatId=.
    const docs = await MathChatHistory.find({ userId: session.userId })
      .select("-messages")
      .sort({ updatedAt: -1 })
      .lean();
    return Response.json({
      items: docs.map((doc) => ({
        id: String(doc.chatId),
        kind: doc.kind,
        title: String(doc.title),
        hasUserQuestion: Boolean(doc.hasUserQuestion),
        question: doc.question ? String(doc.question) : undefined,
        type: doc.type ? String(doc.type) : undefined,
        selectedTool: typeof doc.selectedTool === "string" ? doc.selectedTool : null,
        toolUrl: doc.toolUrl ? String(doc.toolUrl) : undefined,
        entryMode: doc.entryMode,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[math-chat-history] GET Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function POST(req: Request) {
  try {
    const denied = await requireTopicApi("math", "ai-problem-solving");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id, kind, title, hasUserQuestion, question, type, selectedTool, toolUrl, entryMode, messages } = (await req.json()) as {
      id?: string;
      kind?: "general" | "volume-cubes" | "clock-24hrs" | "clock-time-difference";
      title?: string;
      hasUserQuestion?: boolean;
      question?: string;
      type?: string;
      selectedTool?: string | null;
      toolUrl?: string;
      entryMode?: "question" | "ai-tool";
      messages?: SavedChatMessage[];
    };

    if (!id || !kind || !title) {
      return new Response(JSON.stringify({ error: "id, kind and title are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const updateFields: Record<string, unknown> = {
      userId: session.userId,
      chatId: id,
      kind,
      title: title.trim(),
      hasUserQuestion: Boolean(hasUserQuestion),
      question: hasUserQuestion ? (question?.trim() || undefined) : undefined,
      type: hasUserQuestion ? (type?.trim() || undefined) : undefined,
      selectedTool: selectedTool ?? null,
      entryMode,
      messages: Array.isArray(messages) ? messages : [],
    };

    if (!hasUserQuestion) {
      updateFields.toolUrl = undefined;
    } else if (toolUrl?.trim()) {
      updateFields.toolUrl = toolUrl.trim();
    }

    const doc = await MathChatHistory.findOneAndUpdate(
      { userId: session.userId, chatId: id },
      {
        $set: updateFields,
      },
      { returnDocument: "after", upsert: true },
    );

    return Response.json({
      item: {
        id: String(doc.chatId),
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    console.error("[math-chat-history] POST Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await requireTopicApi("math", "ai-problem-solving");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId")?.trim();
    if (!chatId) {
      return new Response(JSON.stringify({ error: "chatId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    await MathChatHistory.deleteOne({ userId: session.userId, chatId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[math-chat-history] DELETE Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}