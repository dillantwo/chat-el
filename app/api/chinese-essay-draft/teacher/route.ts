import { EssayDraft } from "@/models/EssayDraft";
import {
  findScopedStudent,
  jsonError,
  requireTeacherDataScope,
  summarizeStudents,
  type StudentRecordStats,
} from "@/lib/teacher-data-access";

// The Chinese writing topics that keep essay drafts (作文稿).
const ESSAY_TOPICS = ["scenery-description", "character-description"];

export async function GET(req: Request) {
  try {
    const auth = await requireTeacherDataScope("chinese", req);
    if (!auth.ok) return jsonError(auth.message, auth.status);
    const { scope } = auth;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const topicMatch = topic && ESSAY_TOPICS.includes(topic) ? topic : { $in: ESSAY_TOPICS };

    // --- A single student's essay drafts (optionally filtered by topic) ---
    if (studentId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) {
        return jsonError("找不到該學生", 404);
      }

      const docs = await EssayDraft.find({ userId: studentId, topic: topicMatch })
        .sort({ updatedAt: -1 })
        .lean();

      return Response.json({
        student: {
          id: studentId,
          displayName: String(student.displayName),
          username: String(student.username),
        },
        items: docs.map((doc) => ({
          id: String(doc.draftId),
          title: String(doc.title),
          topic: String(doc.topic),
          first: doc.first ?? "",
          revised: doc.revised ?? "",
          final: doc.final ?? "",
          updatedAt: doc.updatedAt,
          createdAt: doc.createdAt,
        })),
      });
    }

    // --- List students who have essay drafts ---
    const grouped = await EssayDraft.aggregate<StudentRecordStats>([
      { $match: { topic: topicMatch } },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          lastUpdatedAt: { $max: "$updatedAt" },
        },
      },
    ]);

    return Response.json({ students: await summarizeStudents(scope, grouped) });
  } catch (error) {
    console.error("[chinese-essay-draft/teacher] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
