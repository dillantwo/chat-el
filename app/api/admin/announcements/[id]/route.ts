import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Announcement, type IAnnouncementImage } from "@/models/Announcement";
import { AnnouncementRead } from "@/models/AnnouncementRead";
import { uploadAnnouncementImage, deleteAnnouncementImage } from "@/lib/gridfs";
import {
  parseAnnouncementForm,
  serializeAdminAnnouncement,
  type AnnouncementDoc,
} from "@/lib/announcement-server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const FORBIDDEN = { error: "需要管理員權限" };

async function readCount(doc: AnnouncementDoc): Promise<number> {
  return AnnouncementRead.countDocuments({ announcement: doc._id, readAt: { $gte: doc.pushedAt } });
}

// PUT /api/admin/announcements/[id] — replace the announcement's content.
// multipart/form-data, same fields as POST plus keepImages and repush.
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json(FORBIDDEN, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "公告不存在" }, { status: 404 });
  }

  const uploaded: mongoose.Types.ObjectId[] = [];
  try {
    const parsed = await parseAnnouncementForm(await req.formData());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status ?? 400 });
    }
    const f = parsed.fields;

    await connectDB();

    const doc = await Announcement.findById(id);
    if (!doc) return NextResponse.json({ error: "公告不存在" }, { status: 404 });

    // Kept images follow the order the editor sent; ids that are not on this
    // announcement are ignored rather than trusted.
    const current = new Map(doc.images.map((img) => [String(img.fileId), img]));
    const kept: IAnnouncementImage[] = f.keepImages
      .map((imageId) => current.get(imageId))
      .filter((img): img is IAnnouncementImage => Boolean(img))
      .map((img) => ({ fileId: img.fileId, contentType: img.contentType, size: img.size }));
    const keptIds = new Set(kept.map((img) => String(img.fileId)));
    const removed = doc.images.filter((img) => !keptIds.has(String(img.fileId)));

    const added: IAnnouncementImage[] = [];
    for (const img of f.newImages) {
      const fileId = await uploadAnnouncementImage(img.buffer, img.filename, img.contentType);
      uploaded.push(fileId);
      added.push({ fileId, contentType: img.contentType, size: img.size });
    }

    doc.title = f.title;
    doc.content = f.content;
    doc.images = [...kept, ...added];
    doc.audience = f.audience;
    doc.subjects = f.subjects;
    doc.active = f.active;
    doc.startAt = f.startAt ?? doc.startAt;
    doc.endAt = f.endAt;
    if (f.repush) doc.pushedAt = new Date();
    await doc.save();

    // Only after the save: until then the old document still points at them.
    await Promise.all(removed.map((img) => deleteAnnouncementImage(img.fileId)));

    const saved = doc.toObject() as unknown as AnnouncementDoc;
    return NextResponse.json(serializeAdminAnnouncement(saved, await readCount(saved)));
  } catch (err) {
    await Promise.all(uploaded.map((fileId) => deleteAnnouncementImage(fileId)));
    console.error("[admin/announcements:PUT]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// PATCH /api/admin/announcements/[id] — quick actions from the list.
// Body: { active?: boolean, repush?: true }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json(FORBIDDEN, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "公告不存在" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};
    if (typeof body.active === "boolean") update.active = body.active;
    if (body.repush === true) update.pushedAt = new Date();
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "沒有要更新的內容" }, { status: 400 });
    }

    await connectDB();

    const doc = await Announcement.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" })
      .lean<AnnouncementDoc | null>();
    if (!doc) return NextResponse.json({ error: "公告不存在" }, { status: 404 });

    return NextResponse.json(serializeAdminAnnouncement(doc, await readCount(doc)));
  } catch (err) {
    console.error("[admin/announcements:PATCH]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/announcements/[id] — remove the announcement, its read
// receipts and its pictures.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json(FORBIDDEN, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "公告不存在" }, { status: 404 });
  }

  try {
    await connectDB();

    const doc = await Announcement.findByIdAndDelete(id).lean<AnnouncementDoc | null>();
    if (!doc) return NextResponse.json({ error: "公告不存在" }, { status: 404 });

    await AnnouncementRead.deleteMany({ announcement: doc._id });
    await Promise.all((doc.images ?? []).map((img) => deleteAnnouncementImage(img.fileId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/announcements:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
