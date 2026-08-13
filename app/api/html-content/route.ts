import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { HtmlContent } from "@/models/HtmlContent";

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

function createToolKey(title: string) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "ai-tool"}-${Date.now().toString(36)}`;
}

export async function POST(req: Request) {
  try {
    // Saved AI tools belong to the math dashboard.
    const denied = await requireTopicApi("math", "ai-problem-solving");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { toolKey, title, html, chatMessages, sharedWithStudents } = (await req.json()) as {
      toolKey?: string;
      title?: string;
      html?: string;
      chatMessages?: SavedChatMessage[];
      sharedWithStudents?: boolean;
    };

    if (!title || !html) {
      return new Response(JSON.stringify({ error: "title and html are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const nextToolKey = toolKey?.trim() || createToolKey(title);
    const setDoc: Record<string, unknown> = {
      userId: session.userId,
      toolKey: nextToolKey,
      title: title.trim(),
      html,
      chatMessages: Array.isArray(chatMessages) ? chatMessages : [],
    };
    if (typeof sharedWithStudents === "boolean") {
      setDoc.sharedWithStudents = sharedWithStudents;
    }

    const doc = await HtmlContent.findOneAndUpdate(
      { userId: session.userId, toolKey: nextToolKey },
      {
        $set: setDoc,
        $setOnInsert: { sharedWithStudents: false },
      },
      { returnDocument: "after", upsert: true }
    );

    return Response.json({
      toolKey: doc.toolKey,
      title: doc.title,
      sharedWithStudents: !!doc.sharedWithStudents,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error("[html-content] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
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
    const toolKey = searchParams.get("toolKey")?.trim();
    const includeChatMessages = session.role === "teacher";

    if (toolKey) {
      const query = session.role === "teacher"
        ? { userId: session.userId, toolKey }
        : { toolKey, sharedWithStudents: true };

      const doc = await HtmlContent.findOne(query)
        .select({ toolKey: 1, title: 1, html: 1, chatMessages: 1, sharedWithStudents: 1, updatedAt: 1 })
        .lean();

      if (!doc) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return Response.json({
        item: {
          toolKey: String(doc.toolKey),
          title: String(doc.title),
          html: String(doc.html),
          chatMessages: includeChatMessages && Array.isArray(doc.chatMessages) ? doc.chatMessages : [],
          sharedWithStudents: !!doc.sharedWithStudents,
          updatedAt: doc.updatedAt,
        },
      });
    }

    const query = session.role === "teacher"
      ? { userId: session.userId }
      : { sharedWithStudents: true };

    const docs = await HtmlContent.find(query)
      .sort({ updatedAt: -1 })
      .select({ toolKey: 1, title: 1, html: 1, chatMessages: 1, sharedWithStudents: 1, updatedAt: 1 })
      .lean();

    return Response.json({
      items: docs.map((doc) => ({
        toolKey: String(doc.toolKey),
        title: String(doc.title),
        html: String(doc.html),
        chatMessages: includeChatMessages && Array.isArray(doc.chatMessages) ? doc.chatMessages : [],
        sharedWithStudents: !!doc.sharedWithStudents,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[html-content] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function PATCH(req: Request) {
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
    if (session.role !== "teacher") {
      return new Response(JSON.stringify({ error: "僅教師可分享工具" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { toolKey, sharedWithStudents } = (await req.json()) as {
      toolKey?: string;
      sharedWithStudents?: boolean;
    };

    if (!toolKey || typeof sharedWithStudents !== "boolean") {
      return new Response(JSON.stringify({ error: "toolKey and sharedWithStudents are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const doc = await HtmlContent.findOneAndUpdate(
      { userId: session.userId, toolKey: toolKey.trim() },
      { $set: { sharedWithStudents } },
      { returnDocument: "after" }
    );

    if (!doc) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return Response.json({
      toolKey: doc.toolKey,
      sharedWithStudents: !!doc.sharedWithStudents,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error("[html-content] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}