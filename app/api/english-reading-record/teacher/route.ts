import { ReadingRecord, type IReadingAnswer } from "@/models/ReadingRecord";
import {
  findScopedStudent,
  jsonError,
  requireTeacherDataScope,
  summarizeStudents,
  type StudentRecordStats,
} from "@/lib/teacher-data-access";

// Turn a skill id like "activate-background" into a readable label.
function skillLabel(id: string): string {
  return id
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Turn a stored reading record into a readable markdown summary so the shared
// record viewer (which renders chat messages) can display it as-is.
function buildSummary(
  score: number,
  total: number,
  completed: boolean,
  answers: IReadingAnswer[],
  skills: string[],
): string {
  const header = `**得分：${score} / ${total}**　·　${completed ? "已完成 ✅" : "未完成"}`;
  const skillsBlock = skills.length
    ? `\n\n**已使用的閱讀技巧：** ${skills.map(skillLabel).join("、")}`
    : "";
  if (!answers.length) {
    return `${header}${skillsBlock}\n\n_尚無作答記錄_`;
  }
  const rows = [...answers]
    .sort((a, b) => a.questionId - b.questionId)
    .map((a) => {
      const q = a.questionText ? a.questionText.replace(/\|/g, "\\|") : `Question ${a.questionId}`;
      return `| ${a.questionId} | ${q} | ${a.selected || "—"} | ${a.correct || "—"} | ${a.isCorrect ? "✅" : "❌"} |`;
    })
    .join("\n");
  return `${header}${skillsBlock}\n\n| 題號 | 題目 | 學生作答 | 正確答案 | 結果 |\n|---|---|---|---|---|\n${rows}`;
}

export async function GET(req: Request) {
  try {
    const auth = await requireTeacherDataScope("english", req);
    if (!auth.ok) return jsonError(auth.message, auth.status);
    const { scope } = auth;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId")?.trim();

    // --- Single student's reading records ---
    if (studentId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) {
        return jsonError("找不到該學生", 404);
      }

      const docs = await ReadingRecord.find({ userId: studentId })
        .sort({ updatedAt: -1 })
        .lean();

      return Response.json({
        student: {
          id: studentId,
          displayName: String(student.displayName),
          username: String(student.username),
        },
        items: docs.map((doc) => ({
          id: String(doc.readingId),
          title: `${String(doc.title)}（${doc.score ?? 0}/${doc.total ?? 0}）`,
          topic: "reading-comprehension",
          messages: [
            {
              id: `${String(doc.readingId)}-summary`,
              role: "assistant" as const,
              parts: [
                {
                  type: "text" as const,
                  text: buildSummary(
                    doc.score ?? 0,
                    doc.total ?? 0,
                    Boolean(doc.completed),
                    Array.isArray(doc.answers) ? doc.answers : [],
                    Array.isArray(doc.skills) ? doc.skills : [],
                  ),
                },
              ],
            },
          ],
          updatedAt: doc.updatedAt,
        })),
      });
    }

    // --- List students who have reading records ---
    const grouped = await ReadingRecord.aggregate<StudentRecordStats>([
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
    console.error("[english-reading-record/teacher] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
