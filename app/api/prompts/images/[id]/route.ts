import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { canAccessTopic, getSubjectAccess } from "@/lib/subject-access";
import { requireTeacherSubject } from "@/lib/teacher-data-access";
import { toWebStream } from "@/lib/announcement-server";
import { openPromptImageStream } from "@/lib/gridfs";
import { PROMPT_IMAGE_TYPES, PROMPT_TOPIC } from "@/lib/prompts";
import { jsonError, promptTeachersForStudent, toObjectId } from "@/lib/teacher-prompts";
import { TeacherPrompt, type ITeacherPromptImage } from "@/models/TeacherPrompt";
import type { Subject } from "@/models/User";

export const runtime = "nodejs";

const NOT_FOUND = "找不到圖片";

type PromptForImage = {
  teacher: mongoose.Types.ObjectId;
  subject: Subject;
  published?: boolean;
  images?: ITeacherPromptImage[];
};

/** Whether the caller may see the prompt this image belongs to. */
async function canSeePrompt(
  role: "admin" | "teacher" | "student",
  userId: string,
  prompt: PromptForImage,
): Promise<boolean> {
  if (role === "admin") return prompt.published === true;

  if (!(await canAccessTopic(prompt.subject, PROMPT_TOPIC))) return false;

  if (role === "teacher") {
    if (!prompt.teacher.equals(userId)) return false;
    return (await requireTeacherSubject(prompt.subject)).ok;
  }

  if (prompt.published !== true) return false;
  const teachers = await promptTeachersForStudent(userId, prompt.subject);
  return teachers.some((t) => t._id.equals(prompt.teacher));
}

// GET /api/prompts/images/[id] — one prompt picture, shown inline.
// Served to exactly the people who can see the prompt. Missing and hidden give
// the same 404, so ids cannot be probed.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getSubjectAccess();
  if (!access.ok) return jsonError(access.message, access.status);

  const { id } = await params;
  const fileId = toObjectId(id);
  if (!fileId) return jsonError(NOT_FOUND, 404);

  await connectDB();

  const prompt = await TeacherPrompt.findOne({ "images.fileId": fileId })
    .select({ teacher: 1, subject: 1, published: 1, images: 1 })
    .lean<PromptForImage | null>();
  const image = prompt?.images?.find((img) => img.fileId.equals(fileId));

  if (
    !prompt ||
    !image ||
    !PROMPT_IMAGE_TYPES.includes(image.contentType) ||
    !(await canSeePrompt(access.role, access.userId, prompt))
  ) {
    return jsonError(NOT_FOUND, 404);
  }

  const stream = await openPromptImageStream(fileId);

  return new Response(toWebStream(stream), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // A file id is never reused for different bytes, so a short private
      // cache is safe. Kept short so a withdrawn prompt stops showing soon.
      "Cache-Control": "private, max-age=600",
    },
  });
}
