import { ChineseChatHistory } from "@/models/ChineseChatHistory";
import {
  findScopedStudent,
  jsonError,
  requireTeacherDataScope,
  summarizeStudents,
  type StudentRecordStats,
} from "@/lib/teacher-data-access";

// Humanities chats are stored in the shared ChineseChatHistory collection,
// distinguished by their topic string.
const HUMANITIES_TOPICS = ["humanities-water-resources", "humanities-anti-japanese-war"];

export async function GET(req: Request) {
  try {
    const auth = await requireTeacherDataScope("humanities", req);
    if (!auth.ok) return jsonError(auth.message, auth.status);
    const { scope } = auth;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const topicMatch =
      topic && HUMANITIES_TOPICS.includes(topic) ? topic : { $in: HUMANITIES_TOPICS };

    // --- Single student's chat history (optionally filtered by topic) ---
    if (studentId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) {
        return jsonError("找不到該學生", 404);
      }

      const docs = await ChineseChatHistory.find({ userId: studentId, topic: topicMatch })
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
          messages: Array.isArray(doc.messages) ? doc.messages : [],
          updatedAt: doc.updatedAt,
        })),
      });
    }

    // --- List students who have Humanities chat history ---
    const grouped = await ChineseChatHistory.aggregate<StudentRecordStats>([
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
    console.error("[humanities-chat-history/teacher] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
