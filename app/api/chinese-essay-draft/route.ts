import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireSubjectApi } from "@/lib/subject-access";
import { EssayDraft } from "@/models/EssayDraft";

function unauthorized() {
  return new Response(JSON.stringify({ error: "未登錄" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function serialize(doc: {
  draftId: string;
  topic: string;
  title: string;
  first?: string;
  revised?: string;
  final?: string;
  updatedAt: Date;
  createdAt: Date;
}) {
  return {
    id: String(doc.draftId),
    topic: String(doc.topic),
    title: String(doc.title),
    first: doc.first ?? "",
    revised: doc.revised ?? "",
    final: doc.final ?? "",
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  };
}

export async function GET(req: Request) {
  try {
    const denied = await requireSubjectApi("chinese");
    if (denied) return denied;

    const session = await getSession();
    if (!session) return unauthorized();

    await connectDB();

    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get("draftId")?.trim();

    if (draftId) {
      const doc = await EssayDraft.findOne({ userId: session.userId, draftId }).lean();
      return Response.json({ item: doc ? serialize(doc) : null });
    }

    const topic = searchParams.get("topic")?.trim();
    const docs = await EssayDraft.find({
      userId: session.userId,
      ...(topic ? { topic } : {}),
    })
      .sort({ updatedAt: -1 })
      .lean();

    return Response.json({ items: docs.map(serialize) });
  } catch (error) {
    console.error("[chinese-essay-draft] GET Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function POST(req: Request) {
  try {
    const denied = await requireSubjectApi("chinese");
    if (denied) return denied;

    const session = await getSession();
    if (!session) return unauthorized();

    const { id, topic, title, first, revised, final } = (await req.json()) as {
      id?: string;
      topic?: string;
      title?: string;
      first?: string;
      revised?: string;
      final?: string;
    };

    if (!id || !topic) {
      return new Response(JSON.stringify({ error: "id and topic are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const doc = await EssayDraft.findOneAndUpdate(
      { userId: session.userId, draftId: id },
      {
        $set: {
          userId: session.userId,
          draftId: id,
          topic: topic.trim(),
          title: (title?.trim() || "未命名作文稿").slice(0, 60),
          first: first ?? "",
          revised: revised ?? "",
          final: final ?? "",
        },
      },
      { returnDocument: "after", upsert: true },
    );

    return Response.json({ item: { id: String(doc.draftId), updatedAt: doc.updatedAt } });
  } catch (error) {
    console.error("[chinese-essay-draft] POST Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await requireSubjectApi("chinese");
    if (denied) return denied;

    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get("draftId")?.trim();
    if (!draftId) {
      return new Response(JSON.stringify({ error: "draftId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    await EssayDraft.deleteOne({ userId: session.userId, draftId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[chinese-essay-draft] DELETE Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
