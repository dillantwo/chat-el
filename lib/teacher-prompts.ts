import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireTopicApi } from "@/lib/subject-access";
import { requireTeacherSubject, type AuthorizedTeacher } from "@/lib/teacher-data-access";
import { sniffImageType } from "@/lib/announcement-server";
import { deletePromptImage } from "@/lib/gridfs";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import {
  MAX_PROMPT_IMAGES,
  MAX_PROMPT_IMAGE_BYTES,
  MAX_PROMPT_IMAGE_LABEL,
  MAX_PROMPT_ITEMS,
  MAX_PROMPT_ITEM_LENGTH,
  MAX_PROMPT_TITLE_LENGTH,
  PROMPT_TOPIC,
  type PromptDTO,
} from "@/lib/prompts";
import { User, ALL_SUBJECTS, type Subject } from "@/models/User";
import { TeacherPrompt, type ITeacherPromptImage } from "@/models/TeacherPrompt";
import { TeacherPromptSetting } from "@/models/TeacherPromptSetting";

/**
 * Authorization for 提示詞.
 *
 * Authors: the same teachers who may open 查看學生數據 for the subject (holds
 * the subject, school offers it, `canViewStudentData` not switched off), via
 * requireTeacherSubject — plus the school must not have closed the 提示詞
 * topic.
 *
 * Readers: a student sees a teacher's published prompts when, right now,
 *  - the student may open the subject's 提示詞 topic,
 *  - the teacher is an author by the rule above, at the student's school, and
 *  - the student sits in one of the teacher's chosen classes (all the classes
 *    the teacher teaches when they never chose), intersected with the classes
 *    the teacher still teaches.
 *
 * Everything is derived from the accounts on each request, never stamped onto
 * the prompt, so changes in 用戶管理 and 學校管理 apply on the next load.
 */

export function isSubject(value: unknown): value is Subject {
  return typeof value === "string" && ALL_SUBJECTS.includes(value as Subject);
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function toObjectId(id: unknown): mongoose.Types.ObjectId | null {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : null;
}

/**
 * Gate an authoring request: topic open, and the caller is an author for the
 * subject. Returns the response to bail out with, or the teacher.
 */
export async function requirePromptAuthor(
  subject: Subject,
): Promise<{ ok: true; teacher: AuthorizedTeacher } | { ok: false; response: Response }> {
  const denied = await requireTopicApi(subject, PROMPT_TOPIC);
  if (denied) return { ok: false, response: denied };

  const result = await requireTeacherSubject(subject, "沒有編輯此科目提示詞的權限");
  if (!result.ok) return { ok: false, response: jsonError(result.message, result.status) };

  return result;
}

/**
 * The classes whose students see a teacher's prompts: the saved choice when
 * there is one, otherwise every class they teach — always cut down to the
 * classes they teach now.
 */
export function effectiveClassIds(
  teacherClassIds: mongoose.Types.ObjectId[],
  savedClassIds: mongoose.Types.ObjectId[] | null,
): mongoose.Types.ObjectId[] {
  if (savedClassIds === null) return teacherClassIds;
  return teacherClassIds.filter((id) => savedClassIds.some((saved) => saved.equals(id)));
}

/** The teacher's saved class choice for a subject, or null when never saved. */
export async function savedClassIds(
  teacherId: mongoose.Types.ObjectId,
  subject: Subject,
): Promise<mongoose.Types.ObjectId[] | null> {
  const setting = await TeacherPromptSetting.findOne({ teacher: teacherId, subject })
    .select({ classes: 1 })
    .lean<{ classes?: mongoose.Types.ObjectId[] } | null>();
  return setting ? (setting.classes ?? []) : null;
}

export interface PromptTeacher {
  _id: mongoose.Types.ObjectId;
  displayName: string;
}

/**
 * The teachers whose published prompts in `subject` this student may read.
 *
 * The caller must already have checked the student's own topic access. An
 * empty array is the safe answer for a student with no school or no class:
 * `$in: []` matches nothing.
 */
export async function promptTeachersForStudent(
  studentId: string,
  subject: Subject,
): Promise<PromptTeacher[]> {
  await connectDB();

  const student = await User.findOne({ _id: studentId, role: "student" })
    .select({ school: 1, classes: 1 })
    .lean<{ school: mongoose.Types.ObjectId | null; classes?: mongoose.Types.ObjectId[] } | null>();

  const studentClasses = student?.classes ?? [];
  if (!student?.school || studentClasses.length === 0) return [];

  // Mirrors effectiveDataSubjects(): holds the subject, and only an explicit
  // `false` switches student-data access off. The school offering the subject
  // is already implied by the student's own access to it.
  const teachers = await User.find({
    role: "teacher",
    school: student.school,
    classes: { $in: studentClasses },
    subjects: subject,
    canViewStudentData: { $ne: false },
  })
    .select({ displayName: 1, classes: 1 })
    .lean<(PromptTeacher & { classes?: mongoose.Types.ObjectId[] })[]>();

  if (teachers.length === 0) return [];

  const settings = await TeacherPromptSetting.find({
    teacher: { $in: teachers.map((t) => t._id) },
    subject,
  })
    .select({ teacher: 1, classes: 1 })
    .lean<{ teacher: mongoose.Types.ObjectId; classes?: mongoose.Types.ObjectId[] }[]>();

  const savedByTeacher = new Map(settings.map((s) => [String(s.teacher), s.classes ?? []]));

  return teachers
    .filter((t) => {
      const saved = savedByTeacher.get(String(t._id)) ?? null;
      const visible = effectiveClassIds(t.classes ?? [], saved);
      return visible.some((id) => studentClasses.some((own) => own.equals(id)));
    })
    .map((t) => ({ _id: t._id, displayName: String(t.displayName) }));
}

type PromptDoc = {
  _id: mongoose.Types.ObjectId;
  title: string;
  items?: string[];
  content?: string;
  images?: ITeacherPromptImage[];
  published?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The prompt's copyable texts. A prompt saved before `items` existed has one
 * `content` string instead, which reads as a one-item list.
 */
export function promptItems(doc: { items?: string[]; content?: string }): string[] {
  if (doc.items && doc.items.length > 0) return doc.items;
  return doc.content ? [doc.content] : [];
}

export function serializePrompt(doc: PromptDoc): PromptDTO {
  return {
    id: String(doc._id),
    title: doc.title,
    items: promptItems(doc),
    images: (doc.images ?? []).map((img) => ({
      id: String(img.fileId),
      contentType: img.contentType,
      size: img.size,
    })),
    published: doc.published === true,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

/** A validated new image, read into memory and ready for GridFS. */
export interface PendingPromptImage {
  buffer: Buffer;
  filename: string;
  contentType: string;
  size: number;
}

export interface PromptFields {
  title: string;
  /** Non-empty texts, in the order the editor sent them. */
  items: string[];
  published: boolean;
  /** Existing image ids to keep, in display order (edit only). */
  keepImages: string[];
  newImages: PendingPromptImage[];
}

type ParseResult = { ok: true; fields: PromptFields } | { ok: false; error: string; status?: number };

/**
 * Parse and validate the multipart body shared by create and edit.
 *
 * Fields: title, items (repeated, in order), published,
 * keepImages (repeated ids), images (repeated files).
 */
export async function parsePromptForm(form: FormData): Promise<ParseResult> {
  const title = (form.get("title") ?? "").toString().trim();
  // Only line endings and the blank edges are normalized: a prompt is copied
  // verbatim, so indentation and inner spacing are the teacher's to keep.
  // Empty boxes left in the editor are dropped.
  const items = form
    .getAll("items")
    .map((v) => v.toString().replace(/\r\n/g, "\n").replace(/^\n+|\s+$/g, ""))
    .filter((text) => text.length > 0);

  if (!title) return { ok: false, error: "請輸入標題" };
  if (title.length > MAX_PROMPT_TITLE_LENGTH) {
    return { ok: false, error: `標題不能超過 ${MAX_PROMPT_TITLE_LENGTH} 字` };
  }
  if (items.length > MAX_PROMPT_ITEMS) {
    return { ok: false, error: `每條最多只能有 ${MAX_PROMPT_ITEMS} 段提示詞` };
  }
  const tooLong = items.findIndex((text) => text.length > MAX_PROMPT_ITEM_LENGTH);
  if (tooLong >= 0) {
    return { ok: false, error: `第 ${tooLong + 1} 段提示詞不能超過 ${MAX_PROMPT_ITEM_LENGTH} 字` };
  }

  const keepImages = [...new Set(form.getAll("keepImages").map((v) => v.toString()))].filter(
    (id) => mongoose.Types.ObjectId.isValid(id),
  );

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (keepImages.length + files.length > MAX_PROMPT_IMAGES) {
    return { ok: false, error: `最多只能附加 ${MAX_PROMPT_IMAGES} 張圖片` };
  }
  if (items.length === 0 && keepImages.length + files.length === 0) {
    return { ok: false, error: "請輸入提示詞內容或附加圖片" };
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `單次上傳的圖片總大小上限為 ${MAX_UPLOAD_LABEL}`, status: 413 };
  }

  const newImages: PendingPromptImage[] = [];
  for (const file of files) {
    if (file.size > MAX_PROMPT_IMAGE_BYTES) {
      return {
        ok: false,
        error: `圖片「${file.name}」過大（每張上限 ${MAX_PROMPT_IMAGE_LABEL}）`,
        status: 413,
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = sniffImageType(buffer);
    if (!contentType) {
      return { ok: false, error: `「${file.name}」不是支援的圖片格式（PNG、JPEG、WebP、GIF）` };
    }
    newImages.push({ buffer, filename: file.name || "image", contentType, size: file.size });
  }

  return {
    ok: true,
    fields: {
      title,
      items,
      published: (form.get("published") ?? "").toString() === "true",
      keepImages,
      newImages,
    },
  };
}

/**
 * Remove every prompt (and its pictures) and every class setting a teacher
 * left behind. Called when the account is deleted in 用戶管理.
 */
export async function deleteTeacherPrompts(teacherId: mongoose.Types.ObjectId): Promise<void> {
  await connectDB();

  const prompts = await TeacherPrompt.find({ teacher: teacherId })
    .select({ images: 1 })
    .lean<{ images?: ITeacherPromptImage[] }[]>();

  await TeacherPrompt.deleteMany({ teacher: teacherId });
  await TeacherPromptSetting.deleteMany({ teacher: teacherId });
  await Promise.all(
    prompts.flatMap((p) => (p.images ?? []).map((img) => deletePromptImage(img.fileId))),
  );
}
