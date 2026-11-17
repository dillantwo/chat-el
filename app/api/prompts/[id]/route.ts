import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { uploadPromptImage, deletePromptImage } from "@/lib/gridfs";
import {
  jsonError,
  parsePromptForm,
  requirePromptAuthor,
  serializePrompt,
  toObjectId,
} from "@/lib/teacher-prompts";
import { TeacherPrompt, type ITeacherPromptImage } from "@/models/TeacherPrompt";
import type { Subject } from "@/models/User";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type LeanPrompt = {
  _id: mongoose.Types.ObjectId;
  subject: Subject;
  title: string;
  items?: string[];
  content?: string;
  images?: ITeacherPromptImage[];
  published?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const NOT_FOUND = "找不到提示詞";

/**
 * Find a prompt the caller wrote and authorize them for its subject.
 *
 * Every edit is scoped to `{ _id, teacher: me }`, so another teacher's prompt
 * reads as missing rather than forbidden and ids cannot be probed. The author
 * check runs against the prompt's own subject, so losing the subject (or
 * student-data access) also freezes editing.
 */
async function loadOwnPrompt(
  id: string,
): Promise<{ ok: true; prompt: LeanPrompt } | { ok: false; response: Response }> {
  const session = await getSession();
  if (!session) return { ok: false, response: jsonError("未登錄", 401) };
  if (session.role !== "teacher") {
    return { ok: false, response: jsonError("僅教師可編輯提示詞", 403) };
  }

  const objectId = toObjectId(id);
  if (!objectId) return { ok: false, response: jsonError(NOT_FOUND, 404) };

  await connectDB();

  const prompt = await TeacherPrompt.findOne({ _id: objectId, teacher: session.userId })
    .lean<LeanPrompt | null>();
  if (!prompt) return { ok: false, response: jsonError(NOT_FOUND, 404) };

  const author = await requirePromptAuthor(prompt.subject);
  if (!author.ok) return author;

  // The DB-backed id must match the cookie's, or a role change could slip by.
  if (!author.teacher.teacherId.equals(session.userId)) {
    return { ok: false, response: jsonError(NOT_FOUND, 404) };
  }

  return { ok: true, prompt };
}

// PUT /api/prompts/[id] — replace the prompt's content.
// multipart/form-data: title, items (repeated), published, keepImages (repeated ids),
// images (repeated files).
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const loaded = await loadOwnPrompt(id);
  if (!loaded.ok) return loaded.response;
  const current = loaded.prompt;

  const uploaded: mongoose.Types.ObjectId[] = [];
  try {
    const parsed = await parsePromptForm(await req.formData());
    if (!parsed.ok) return jsonError(parsed.error, parsed.status ?? 400);
    const f = parsed.fields;

    // Kept images follow the order the editor sent; ids that are not on this
    // prompt are ignored rather than trusted.
    const existing = new Map((current.images ?? []).map((img) => [String(img.fileId), img]));
    const kept: ITeacherPromptImage[] = f.keepImages
      .map((imageId) => existing.get(imageId))
      .filter((img): img is ITeacherPromptImage => Boolean(img))
      .map((img) => ({ fileId: img.fileId, contentType: img.contentType, size: img.size }));
    const keptIds = new Set(kept.map((img) => String(img.fileId)));
    const removed = (current.images ?? []).filter((img) => !keptIds.has(String(img.fileId)));

    const added: ITeacherPromptImage[] = [];
    for (const img of f.newImages) {
      const fileId = await uploadPromptImage(img.buffer, img.filename, img.contentType);
      uploaded.push(fileId);
      added.push({ fileId, contentType: img.contentType, size: img.size });
    }

    const doc = await TeacherPrompt.findOneAndUpdate(
      { _id: current._id },
      {
        $set: {
          title: f.title,
          items: f.items,
          images: [...kept, ...added],
          published: f.published,
        },
        // A legacy single-text prompt is now held in `items`.
        $unset: { content: 1 },
      },
      { returnDocument: "after" },
    ).lean<LeanPrompt | null>();

    if (!doc) {
      await Promise.all(uploaded.map((fileId) => deletePromptImage(fileId)));
      return jsonError(NOT_FOUND, 404);
    }

    // Only after the save: until then the old document still points at them.
    await Promise.all(removed.map((img) => deletePromptImage(img.fileId)));

    return NextResponse.json(serializePrompt(doc));
  } catch (err) {
    await Promise.all(uploaded.map((fileId) => deletePromptImage(fileId)));
    console.error("[prompts:PUT]", err);
    return jsonError("伺服器錯誤", 500);
  }
}

// PATCH /api/prompts/[id] — quick 顯示給學生 / 草稿 toggle.
// Body: { published: boolean }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const loaded = await loadOwnPrompt(id);
  if (!loaded.ok) return loaded.response;

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.published !== "boolean") return jsonError("沒有要更新的內容", 400);

    const doc = await TeacherPrompt.findOneAndUpdate(
      { _id: loaded.prompt._id },
      { $set: { published: body.published } },
      { returnDocument: "after" },
    ).lean<LeanPrompt | null>();
    if (!doc) return jsonError(NOT_FOUND, 404);

    return NextResponse.json(serializePrompt(doc));
  } catch (err) {
    console.error("[prompts:PATCH]", err);
    return jsonError("伺服器錯誤", 500);
  }
}

// DELETE /api/prompts/[id] — remove the prompt and its pictures.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const loaded = await loadOwnPrompt(id);
  if (!loaded.ok) return loaded.response;

  try {
    const doc = await TeacherPrompt.findOneAndDelete({ _id: loaded.prompt._id })
      .lean<LeanPrompt | null>();
    if (!doc) return jsonError(NOT_FOUND, 404);

    await Promise.all((doc.images ?? []).map((img) => deletePromptImage(img.fileId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[prompts:DELETE]", err);
    return jsonError("伺服器錯誤", 500);
  }
}
