import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSubjectAccess } from "@/lib/subject-access";
import { Announcement } from "@/models/Announcement";
import { AnnouncementRead } from "@/models/AnnouncementRead";
import {
  imageToDTO,
  visibleAnnouncementFilter,
  type AnnouncementDoc,
} from "@/lib/announcement-server";
import type { AnnouncementAudience, UserAnnouncementDTO } from "@/lib/announcements";

export const runtime = "nodejs";

/** How many announcements the 公告 list keeps. Older ones drop off. */
const LIST_LIMIT = 20;
const MAX_READ_IDS = 50;

// GET /api/announcements — the announcements the current student or teacher
// can see, latest push first, each flagged unread or not. Role and subjects come
// from the database (getSubjectAccess), not from the 7-day session cookie.
export async function GET() {
  const access = await getSubjectAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (access.role === "admin") {
    return NextResponse.json({ announcements: [] });
  }

  await connectDB();

  const docs = await Announcement.find(
    visibleAnnouncementFilter(access.role as AnnouncementAudience, access.subjects),
  )
    .select({ title: 1, content: 1, images: 1, pushedAt: 1 })
    .sort({ pushedAt: -1 })
    .limit(LIST_LIMIT)
    .lean<Pick<AnnouncementDoc, "_id" | "title" | "content" | "images" | "pushedAt">[]>();

  const reads = await AnnouncementRead.find({
    user: new mongoose.Types.ObjectId(access.userId),
    announcement: { $in: docs.map((d) => d._id) },
  })
    .select({ announcement: 1, readAt: 1 })
    .lean<{ announcement: mongoose.Types.ObjectId; readAt: Date }[]>();
  const readAt = new Map(reads.map((r) => [String(r.announcement), r.readAt.getTime()]));

  const announcements: UserAnnouncementDTO[] = docs.map((d) => {
    const read = readAt.get(String(d._id));
    return {
      id: String(d._id),
      title: d.title,
      content: d.content ?? "",
      images: (d.images ?? []).map(imageToDTO),
      pushedAt: new Date(d.pushedAt).toISOString(),
      unread: read === undefined || read < new Date(d.pushedAt).getTime(),
    };
  });

  return NextResponse.json({ announcements });
}

// POST /api/announcements — mark announcements as read.
// Body: { ids: string[] }
export async function POST(req: NextRequest) {
  const access = await getSubjectAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (access.role === "admin") {
    return NextResponse.json({ success: true });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.map(String))]
      .filter((v) => mongoose.Types.ObjectId.isValid(v))
      .slice(0, MAX_READ_IDS);
    if (ids.length === 0) return NextResponse.json({ success: true });

    await connectDB();

    // Only receipts for announcements this user can actually see, so the
    // collection cannot be filled with arbitrary ids.
    const visible = await Announcement.find({
      ...visibleAnnouncementFilter(access.role as AnnouncementAudience, access.subjects),
      _id: { $in: ids },
    })
      .select({ _id: 1 })
      .lean<{ _id: mongoose.Types.ObjectId }[]>();

    if (visible.length > 0) {
      const now = new Date();
      const user = new mongoose.Types.ObjectId(access.userId);
      await AnnouncementRead.bulkWrite(
        visible.map((a) => ({
          updateOne: {
            filter: { user, announcement: a._id },
            update: { $set: { readAt: now } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[announcements:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
