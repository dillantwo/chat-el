import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSubjectAccess, requireTopicApi } from "@/lib/subject-access";
import { listTeacherClasses } from "@/lib/teacher-data-access";
import { uploadPromptImage, deletePromptImage } from "@/lib/gridfs";
import {
  PROMPT_TOPIC,
  type PromptGroupDTO,
  type TeacherPromptsResponse,
  type ViewerPromptsResponse,
} from "@/lib/prompts";
import {
  effectiveClassIds,
  isSubject,
  jsonError,
  parsePromptForm,
  promptTeachersForStudent,
  requirePromptAuthor,
  savedClassIds,
  serializePrompt,
} from "@/lib/teacher-prompts";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { TeacherPrompt, type ITeacherPromptImage } from "@/models/TeacherPrompt";

export const runtime = "nodejs";

type LeanPrompt = {
  _id: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  title: string;
  items?: string[];
  content?: string;
  images?: ITeacherPromptImage[];
  published?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PROMPT_FIELDS = {
  teacher: 1,
  title: 1,
  items: 1,
  // Legacy single-text prompts; see promptItems().
  content: 1,
  images: 1,
  published: 1,
  createdAt: 1,
  updatedAt: 1,
};

/** Group prompts under their authors, keeping the authors' order. */
function groupByTeacher(
  prompts: LeanPrompt[],
  teachers: { id: string; name: string; schoolName?: string }[],
): PromptGroupDTO[] {
  return teachers
    .map((t) => ({
      teacherId: t.id,
      teacherName: t.name,
      ...(t.schoolName !== undefined ? { schoolName: t.schoolName } : {}),
      prompts: prompts.filter((p) => String(p.teacher) === t.id).map(serializePrompt),
    }))
    .filter((g) => g.prompts.length > 0);
}

// GET /api/prompts?subject=chinese
//  - teacher → their own prompts (drafts included) and their class setting
//  - student → published prompts of the teachers in scope, grouped by teacher
//  - admin   → every published prompt in the subject, read-only
export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject");
  if (!isSubject(subject)) return jsonError("科目無效", 400);

  const denied = await requireTopicApi(subject, PROMPT_TOPIC);
  if (denied) return denied;

  // DB-backed role, so a role change applies before the 7-day cookie expires.
  const access = await getSubjectAccess();
  if (!access.ok) return jsonError(access.message, access.status);

  try {
    await connectDB();

    if (access.role === "teacher") {
      const author = await requirePromptAuthor(subject);
      if (!author.ok) return author.response;
      const { teacherId, schoolId, classIds } = author.teacher;

      const [prompts, saved, classes] = await Promise.all([
        TeacherPrompt.find({ teacher: teacherId, subject })
          .sort({ createdAt: -1 })
          .select(PROMPT_FIELDS)
          .lean<LeanPrompt[]>(),
        savedClassIds(teacherId, subject),
        listTeacherClasses(schoolId, classIds),
      ]);

      const body: TeacherPromptsResponse = {
        role: "teacher",
        prompts: prompts.map(serializePrompt),
        classes,
        visibleClassIds: effectiveClassIds(classIds, saved).map(String),
        classesCustomized: saved !== null,
      };
      return NextResponse.json(body);
    }

    if (access.role === "student") {
      const teachers = (await promptTeachersForStudent(access.userId, subject)).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "zh-Hant"),
      );
      const prompts = teachers.length
        ? await TeacherPrompt.find({
            teacher: { $in: teachers.map((t) => t._id) },
            subject,
            published: true,
          })
            .sort({ createdAt: -1 })
            .select(PROMPT_FIELDS)
            .lean<LeanPrompt[]>()
        : [];

      const body: ViewerPromptsResponse = {
        role: "student",
        groups: groupByTeacher(
          prompts,
          teachers.map((t) => ({ id: String(t._id), name: t.displayName })),
        ),
      };
      return NextResponse.json(body);
    }

    // Admin: global, so every published prompt, labelled with the school.
    const prompts = await TeacherPrompt.find({ subject, published: true })
      .sort({ createdAt: -1 })
      .select(PROMPT_FIELDS)
      .lean<LeanPrompt[]>();

    const authorIds = [...new Set(prompts.map((p) => String(p.teacher)))];
    const authors = authorIds.length
      ? await User.find({ _id: { $in: authorIds } })
          .select({ displayName: 1, school: 1 })
          .lean<{ _id: mongoose.Types.ObjectId; displayName: string; school: mongoose.Types.ObjectId | null }[]>()
      : [];
    const schoolIds = [...new Set(authors.map((a) => a.school).filter(Boolean).map(String))];
    const schools = schoolIds.length
      ? await School.find({ _id: { $in: schoolIds } })
          .select({ name: 1 })
          .lean<{ _id: mongoose.Types.ObjectId; name: string }[]>()
      : [];
    const schoolName = new Map(schools.map((s) => [String(s._id), String(s.name)]));

    const body: ViewerPromptsResponse = {
      role: "admin",
      groups: groupByTeacher(
        prompts,
        authors
          .map((a) => ({
            id: String(a._id),
            name: String(a.displayName),
            schoolName: a.school ? (schoolName.get(String(a.school)) ?? "") : "",
          }))
          .sort(
            (a, b) =>
              a.schoolName.localeCompare(b.schoolName, "zh-Hant") ||
              a.name.localeCompare(b.name, "zh-Hant"),
          ),
      ),
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[prompts:GET]", err);
    return jsonError("伺服器錯誤", 500);
  }
}

// POST /api/prompts?subject=chinese — create a prompt.
// multipart/form-data: title, items (repeated), published, images (repeated).
// The subject is in the query so the caller is authorized before the body,
// which may carry several megabytes of pictures, is read.
export async function POST(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject");
  if (!isSubject(subject)) return jsonError("科目無效", 400);

  const author = await requirePromptAuthor(subject);
  if (!author.ok) return author.response;

  const uploaded: mongoose.Types.ObjectId[] = [];
  try {
    const parsed = await parsePromptForm(await req.formData());
    if (!parsed.ok) return jsonError(parsed.error, parsed.status ?? 400);
    const f = parsed.fields;

    await connectDB();

    const images: ITeacherPromptImage[] = [];
    for (const img of f.newImages) {
      const fileId = await uploadPromptImage(img.buffer, img.filename, img.contentType);
      uploaded.push(fileId);
      images.push({ fileId, contentType: img.contentType, size: img.size });
    }

    const doc = await TeacherPrompt.create({
      teacher: author.teacher.teacherId,
      subject,
      title: f.title,
      items: f.items,
      images,
      published: f.published,
    });

    return NextResponse.json(serializePrompt(doc.toObject() as unknown as LeanPrompt), {
      status: 201,
    });
  } catch (err) {
    await Promise.all(uploaded.map((fileId) => deletePromptImage(fileId)));
    console.error("[prompts:POST]", err);
    return jsonError("伺服器錯誤", 500);
  }
}
