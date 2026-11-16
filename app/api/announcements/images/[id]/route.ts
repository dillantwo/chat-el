import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSubjectAccess } from "@/lib/subject-access";
import { Announcement, type IAnnouncementImage } from "@/models/Announcement";
import { openAnnouncementImageStream } from "@/lib/gridfs";
import { toWebStream, visibleAnnouncementFilter } from "@/lib/announcement-server";
import { ANNOUNCEMENT_IMAGE_TYPES, type AnnouncementAudience } from "@/lib/announcements";

export const runtime = "nodejs";

// GET /api/announcements/images/[id] — one announcement picture, shown inline.
// Admins can view any; everyone else only images of announcements they can see.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getSubjectAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  }
  const fileId = new mongoose.Types.ObjectId(id);

  await connectDB();

  const filter =
    access.role === "admin"
      ? { "images.fileId": fileId }
      : {
          ...visibleAnnouncementFilter(access.role as AnnouncementAudience, access.subjects),
          "images.fileId": fileId,
        };

  const doc = await Announcement.findOne(filter)
    .select({ images: 1 })
    .lean<{ images: IAnnouncementImage[] } | null>();
  const image = doc?.images.find((img) => String(img.fileId) === id);

  // Same answer whether the image is missing or hidden, so ids cannot be probed.
  if (!image || !ANNOUNCEMENT_IMAGE_TYPES.includes(image.contentType)) {
    return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  }

  const stream = await openAnnouncementImageStream(fileId);

  return new Response(toWebStream(stream), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // A file id is never reused for different bytes, so a short private cache
      // is safe and saves re-downloading when the 公告 list is reopened.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
