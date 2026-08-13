import { EnglishChatHistory } from "@/models/EnglishChatHistory";
import {
  findScopedStudent,
  jsonError,
  requireTeacherDataScope,
  summarizeStudents,
  type StudentRecordStats,
} from "@/lib/teacher-data-access";

// The three English topics this viewer currently supports.
const ENGLISH_TOPICS = ["thank-you-letter", "reading-comprehension", "location-direction"];

export async function GET(req: Request) {
  try {
    const auth = await requireTeacherDataScope("english", req);
    if (!auth.ok) return jsonError(auth.message, auth.status);
    const { scope } = auth;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const topicMatch =
      topic && ENGLISH_TOPICS.includes(topic) ? topic : { $in: ENGLISH_TOPICS };

    // --- Single student's chat history (optionally filtered by topic) ---
    if (studentId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) {
        return jsonError("找不到該學生", 404);
      }

      const docs = await EnglishChatHistory.find({ userId: studentId, topic: topicMatch })
        .sort({ updatedAt: -1 })
        .lean();

      return Response.json({
        student: {
          id: studentId,
          displayName: String(student.displayName),
          username: String(student.username),
        },
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
    }

    // --- List students who have English chat history ---
    const grouped = await EnglishChatHistory.aggregate<StudentRecordStats>([
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
    console.error("[english-chat-history/teacher] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
