import { MathChatHistory } from "@/models/MathChatHistory";
import {
  findScopedStudent,
  jsonError,
  requireTeacherDataScope,
  summarizeStudents,
  type StudentRecordStats,
} from "@/lib/teacher-data-access";

export async function GET(req: Request) {
  try {
    const auth = await requireTeacherDataScope("math", req);
    if (!auth.ok) return jsonError(auth.message, auth.status);
    const { scope } = auth;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId")?.trim();

    // --- Single student's chat history ---
    if (studentId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) {
        return jsonError("找不到該學生", 404);
      }

      const docs = await MathChatHistory.find({ userId: studentId })
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
          // The shared record viewer keys labels off `topic`; math uses `kind`,
          // so expose it under both names for compatibility.
          topic: String(doc.kind),
          kind: doc.kind,
          messages: Array.isArray(doc.messages) ? doc.messages : [],
          updatedAt: doc.updatedAt,
        })),
      });
    }

    // --- List students who have Math chat history ---
    const grouped = await MathChatHistory.aggregate<StudentRecordStats>([
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
    console.error("[math-chat-history/teacher] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
