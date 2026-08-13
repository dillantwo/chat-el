import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { ReadingRecord } from "@/models/ReadingRecord";

interface SavedReadingAnswer {
  questionId: number;
  questionText?: string;
  selected?: string;
  correct?: string;
  isCorrect?: boolean;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  try {
    const denied = await requireTopicApi("english", "reading-comprehension");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return jsonError("未登錄", 401);
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const readingId = searchParams.get("readingId")?.trim();

    if (readingId) {
      const doc = await ReadingRecord.findOne({ userId: session.userId, readingId }).lean();
      if (!doc) {
        return Response.json({ item: null });
      }
      return Response.json({
        item: {
          readingId: String(doc.readingId),
          title: String(doc.title),
          score: doc.score ?? 0,
          total: doc.total ?? 0,
          completed: Boolean(doc.completed),
          answers: Array.isArray(doc.answers) ? doc.answers : [],
          section: typeof doc.section === "string" ? doc.section : "",
          step: doc.step && typeof doc.step === "object" ? doc.step : {},
          skills: Array.isArray(doc.skills) ? doc.skills : [],
          updatedAt: doc.updatedAt,
        },
      });
    }

    const docs = await ReadingRecord.find({ userId: session.userId })
      .sort({ updatedAt: -1 })
      .lean();
    return Response.json({
      items: docs.map((doc) => ({
        readingId: String(doc.readingId),
        title: String(doc.title),
        score: doc.score ?? 0,
        total: doc.total ?? 0,
        completed: Boolean(doc.completed),
        answers: Array.isArray(doc.answers) ? doc.answers : [],
        section: typeof doc.section === "string" ? doc.section : "",
        step: doc.step && typeof doc.step === "object" ? doc.step : {},
        skills: Array.isArray(doc.skills) ? doc.skills : [],
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[english-reading-record] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const denied = await requireTopicApi("english", "reading-comprehension");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return jsonError("未登錄", 401);
    }

    const { readingId, title, score, total, completed, answers, section, step, skills } =
      (await req.json()) as {
        readingId?: string;
        title?: string;
        score?: number;
        total?: number;
        completed?: boolean;
        answers?: SavedReadingAnswer[];
        section?: string;
        step?: Record<string, number>;
        skills?: string[];
      };

    if (!readingId || !title) {
      return jsonError("readingId and title are required", 400);
    }

    await connectDB();

    const cleanAnswers = Array.isArray(answers)
      ? answers.map((a) => ({
          questionId: Number(a.questionId),
          questionText: typeof a.questionText === "string" ? a.questionText : "",
          selected: typeof a.selected === "string" ? a.selected : "",
          correct: typeof a.correct === "string" ? a.correct : "",
          isCorrect: Boolean(a.isCorrect),
        }))
      : [];

    // Only keep numeric step values, guarding against malformed input.
    const cleanStep: Record<string, number> = {};
    if (step && typeof step === "object") {
      for (const [key, value] of Object.entries(step)) {
        if (typeof value === "number" && Number.isFinite(value)) {
          cleanStep[key] = value;
        }
      }
    }

    const cleanSkills = Array.isArray(skills)
      ? Array.from(new Set(skills.filter((s): s is string => typeof s === "string")))
      : [];

    const doc = await ReadingRecord.findOneAndUpdate(
      { userId: session.userId, readingId: readingId.trim() },
      {
        $set: {
          userId: session.userId,
          readingId: readingId.trim(),
          title: title.trim(),
          score: typeof score === "number" ? score : 0,
          total: typeof total === "number" ? total : 0,
          completed: Boolean(completed),
          answers: cleanAnswers,
          section: typeof section === "string" ? section : "",
          step: cleanStep,
          skills: cleanSkills,
        },
      },
      { returnDocument: "after", upsert: true },
    );

    return Response.json({
      item: { readingId: String(doc.readingId), updatedAt: doc.updatedAt },
    });
  } catch (error) {
    console.error("[english-reading-record] POST Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await requireTopicApi("english", "reading-comprehension");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return jsonError("未登錄", 401);
    }

    const { searchParams } = new URL(req.url);
    const readingId = searchParams.get("readingId")?.trim();
    if (!readingId) {
      return jsonError("readingId is required", 400);
    }

    await connectDB();
    await ReadingRecord.deleteOne({ userId: session.userId, readingId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[english-reading-record] DELETE Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
