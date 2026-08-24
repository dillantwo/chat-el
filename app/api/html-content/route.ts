import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { getSubjectAccess, requireTopicApi } from "@/lib/subject-access";
import { HtmlContent } from "@/models/HtmlContent";
import { User } from "@/models/User";

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

/**
 * The teachers whose shared tools a student may open: same school, and at least
 * one class in common — the same "shares a class" rule that scopes 查看學生數據
 * in lib/teacher-data-access.ts, pointed the other way.
 *
 * Derived from the two accounts on each request rather than stamped onto the
 * record at share time. School and class already live on the account, so
 * deriving keeps an existing record's audience correct after a teacher or a
 * student is moved in 用戶管理, and makes removing a class actually revoke
 * access to what was shared through it. It also needs no backfill for the
 * records that were saved before sharing had a scope.
 *
 * An empty array is the safe answer for a student with no school or no class:
 * `$in: []` matches nothing, whereas omitting the condition would match
 * everything.
 */
async function sharingTeacherIds(studentId: string): Promise<string[]> {
  const student = await User.findById(studentId)
    .select({ school: 1, classes: 1 })
    .lean<{ school: mongoose.Types.ObjectId | null; classes?: mongoose.Types.ObjectId[] } | null>();

  const classIds = student?.classes ?? [];
  if (!student?.school || classIds.length === 0) return [];

  // A class never spans schools, so the class overlap already implies the
  // school; matching on it too means a stale class reference cannot reach
  // across one.
  const teachers = await User.find({
    role: "teacher",
    school: student.school,
    classes: { $in: classIds },
  })
    .select({ _id: 1 })
    .lean<{ _id: mongoose.Types.ObjectId }[]>();

  return teachers.map((teacher) => String(teacher._id));
}

/**
 * Which saved tools the caller may read:
 *  - teacher → their own, shared or not
 *  - student → shared ones from teachers in their school and classes
 *  - admin   → every shared one (admins are global and hold no class, so the
 *              student rule would otherwise show them nothing)
 */
async function readScope(
  role: "admin" | "teacher" | "student",
  userId: string,
): Promise<Record<string, unknown>> {
  if (role === "teacher") return { userId };
  if (role === "admin") return { sharedWithStudents: true };
  return { sharedWithStudents: true, userId: { $in: await sharingTeacherIds(userId) } };
}

export async function GET(req: Request) {
  try {
    const denied = await requireTopicApi("math", "ai-problem-solving");
    if (denied) return denied;

    // Role and id come from getSubjectAccess rather than the cookie: it reads
    // the database (and is already resolved for the gate above, so this is
    // free), which means a role change takes effect immediately instead of
    // when the 7-day session expires.
    const access = await getSubjectAccess();
    if (!access.ok) {
      return new Response(JSON.stringify({ error: access.message }), {
        status: access.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const toolKey = searchParams.get("toolKey")?.trim();
    const includeChatMessages = access.role === "teacher";
    const scope = await readScope(access.role, access.userId);

    if (toolKey) {
      const doc = await HtmlContent.findOne({ ...scope, toolKey })
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

    const docs = await HtmlContent.find(scope)
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

/**
 * DELETE /api/html-content?toolKey=...
 *
 * Scoped to `{ userId, toolKey }` exactly like PATCH, so a saved tool can only
 * be removed by the teacher who saved it. Students never own one — they reach
 * shared tools through the class scope in `readScope()` — hence the same
 * teacher-only guard rather than a per-record ownership message.
 *
 * Deleting a shared tool also withdraws it from students, because GET's scope
 * filter simply stops matching. A student holding the record open still has the
 * HTML their browser already received; the next load returns 404.
 */
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
    if (session.role !== "teacher") {
      return new Response(JSON.stringify({ error: "僅教師可刪除工具" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const toolKey = new URL(req.url).searchParams.get("toolKey")?.trim();
    if (!toolKey) {
      return new Response(JSON.stringify({ error: "toolKey is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const doc = await HtmlContent.findOneAndDelete({ userId: session.userId, toolKey });

    if (!doc) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return Response.json({ toolKey: doc.toolKey, deleted: true });
  } catch (error) {
    console.error("[html-content] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}