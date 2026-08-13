import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireSubjectApi } from "@/lib/subject-access";
import { EnglishChatHistory } from "@/models/EnglishChatHistory";

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
    const denied = await requireSubjectApi("english");
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
      const doc = await EnglishChatHistory.findOne({ userId: session.userId, chatId }).lean();
      if (!doc) {
        return Response.json({ item: null });
      }

      return Response.json({
        item: {
          id: String(doc.chatId),
          title: String(doc.title),
          topic: String(doc.topic),
          selectedTask: doc.selectedTask ?? null,
          studentRole: doc.studentRole ?? null,
          messages: Array.isArray(doc.messages) ? doc.messages : [],
          updatedAt: doc.updatedAt,
        },
      });
    }

    const docs = await EnglishChatHistory.find({
      userId: session.userId,
      ...(searchParams.get("topic")?.trim() ? { topic: searchParams.get("topic")!.trim() } : {}),
    }).sort({ updatedAt: -1 }).lean();
    return Response.json({
      items: docs.map((doc) => ({
        id: String(doc.chatId),
        title: String(doc.title),
        topic: String(doc.topic),
        selectedTask: doc.selectedTask ?? null,
        studentRole: doc.studentRole ?? null,
        messages: Array.isArray(doc.messages) ? doc.messages : [],
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[english-chat-history] GET Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function POST(req: Request) {
  try {
    const denied = await requireSubjectApi("english");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id, title, topic, selectedTask, studentRole, messages } = (await req.json()) as {
      id?: string;
      title?: string;
      topic?: string;
      selectedTask?: number | null;
      studentRole?: string | null;
      messages?: SavedChatMessage[];
    };

    if (!id || !title || !topic) {
      return new Response(JSON.stringify({ error: "id, title and topic are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const doc = await EnglishChatHistory.findOneAndUpdate(
      { userId: session.userId, chatId: id },
      {
        $set: {
          userId: session.userId,
          chatId: id,
          title: title.trim(),
          topic: topic.trim(),
          selectedTask: selectedTask ?? null,
          studentRole: studentRole ?? null,
          messages: Array.isArray(messages) ? messages : [],
        },
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
    console.error("[english-chat-history] POST Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await requireSubjectApi("english");
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
    await EnglishChatHistory.deleteOne({ userId: session.userId, chatId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[english-chat-history] DELETE Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
