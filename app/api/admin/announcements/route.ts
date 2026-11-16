import { NextRequest, NextResponse } from "next/server";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Announcement } from "@/models/Announcement";
import { AnnouncementRead } from "@/models/AnnouncementRead";
import { uploadAnnouncementImage, deleteAnnouncementImage } from "@/lib/gridfs";
import {
  parseAnnouncementForm,
  serializeAdminAnnouncement,
  type AnnouncementDoc,
} from "@/lib/announcement-server";

export const runtime = "nodejs";

// GET /api/admin/announcements — every announcement, latest push first, with
// how many users have read the current push.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  await connectDB();

  const docs = await Announcement.find().sort({ pushedAt: -1 }).lean<AnnouncementDoc[]>();

  const counts = await Promise.all(
    docs.map((d) =>
      AnnouncementRead.countDocuments({ announcement: d._id, readAt: { $gte: d.pushedAt } }),
    ),
  );

  return NextResponse.json(docs.map((d, i) => serializeAdminAnnouncement(d, counts[i])));
}

// POST /api/admin/announcements — create. multipart/form-data, see
// parseAnnouncementForm for the fields.
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const uploaded: mongoose.Types.ObjectId[] = [];
  try {
    const parsed = await parseAnnouncementForm(await req.formData());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status ?? 400 });
    }
    const f = parsed.fields;

    await connectDB();

    const images = [];
    for (const img of f.newImages) {
      const fileId = await uploadAnnouncementImage(img.buffer, img.filename, img.contentType);
      uploaded.push(fileId);
      images.push({ fileId, contentType: img.contentType, size: img.size });
    }

    const now = new Date();
    const doc = await Announcement.create({
      title: f.title,
      content: f.content,
      images,
      audience: f.audience,
      subjects: f.subjects,
      active: f.active,
      startAt: f.startAt ?? now,
      endAt: f.endAt,
      pushedAt: now,
      createdBy: session.userId,
    });

    return NextResponse.json(
      serializeAdminAnnouncement(doc.toObject() as unknown as AnnouncementDoc, 0),
      { status: 201 },
    );
  } catch (err) {
    // Do not leave pictures behind for an announcement that was never saved.
    await Promise.all(uploaded.map((id) => deleteAnnouncementImage(id)));
    console.error("[admin/announcements:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
