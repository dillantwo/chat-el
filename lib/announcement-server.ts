import "server-only";
import mongoose from "mongoose";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import type { IAnnouncement, IAnnouncementImage } from "@/models/Announcement";
import {
  type AdminAnnouncementDTO,
  ANNOUNCEMENT_AUDIENCE_VALUES,
  MAX_ANNOUNCEMENT_CONTENT_LENGTH,
  MAX_ANNOUNCEMENT_IMAGES,
  MAX_ANNOUNCEMENT_IMAGE_BYTES,
  MAX_ANNOUNCEMENT_IMAGE_LABEL,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  type AnnouncementAudience,
  type AnnouncementImageDTO,
} from "@/lib/announcements";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

/**
 * Mongo filter for the announcements a user of `role` holding `subjects` may
 * see right now. Shared by the pop-up list and the image route, so an image is
 * served to exactly the people who can see the announcement it belongs to.
 */
export function visibleAnnouncementFilter(
  role: AnnouncementAudience,
  subjects: Subject[],
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    active: true,
    audience: role,
    startAt: { $lte: now },
    $and: [
      { $or: [{ endAt: null }, { endAt: { $gt: now } }] },
      { $or: [{ subjects: { $size: 0 } }, { subjects: { $in: subjects } }] },
    ],
  };
}

/**
 * Detect the image format from its first bytes. The browser's `file.type` is
 * only a guess from the extension, and the stored type is what we later send as
 * Content-Type, so it has to come from the content itself.
 */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 6) {
    const head = buf.subarray(0, 6).toString("ascii");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function imageToDTO(img: IAnnouncementImage): AnnouncementImageDTO {
  return { id: String(img.fileId), contentType: img.contentType, size: img.size };
}

/** The lean shape the routes read. */
export type AnnouncementDoc = Pick<
  IAnnouncement,
  | "title"
  | "content"
  | "images"
  | "audience"
  | "subjects"
  | "active"
  | "startAt"
  | "endAt"
  | "pushedAt"
  | "createdAt"
  | "updatedAt"
> & { _id: mongoose.Types.ObjectId };

export function serializeAdminAnnouncement(
  doc: AnnouncementDoc,
  readCount: number,
): AdminAnnouncementDTO {
  return {
    id: String(doc._id),
    title: doc.title,
    content: doc.content ?? "",
    images: (doc.images ?? []).map(imageToDTO),
    audience: doc.audience ?? [],
    subjects: doc.subjects ?? [],
    active: doc.active !== false,
    startAt: new Date(doc.startAt).toISOString(),
    endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null,
    pushedAt: new Date(doc.pushedAt).toISOString(),
    readCount,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

/** A validated new image, read into memory and ready for GridFS. */
export interface PendingImage {
  buffer: Buffer;
  filename: string;
  contentType: string;
  size: number;
}

export interface AnnouncementFields {
  title: string;
  content: string;
  audience: AnnouncementAudience[];
  subjects: Subject[];
  active: boolean;
  /** null when the form left it empty ("start now"). */
  startAt: Date | null;
  endAt: Date | null;
  /** Existing image ids to keep, in display order (edit only). */
  keepImages: string[];
  newImages: PendingImage[];
  repush: boolean;
}

type ParseResult = { ok: true; fields: AnnouncementFields } | { ok: false; error: string; status?: number };

function readDate(raw: FormDataEntryValue | null): Date | null | "invalid" {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

/**
 * Parse and validate the multipart body shared by create and edit.
 *
 * Fields: title, content, audience (repeated), subjects (repeated, none = all),
 * active, startAt, endAt (ISO, optional), keepImages (repeated ids),
 * images (repeated files), repush.
 */
export async function parseAnnouncementForm(form: FormData): Promise<ParseResult> {
  const title = (form.get("title") ?? "").toString().trim();
  const content = (form.get("content") ?? "").toString().replace(/\r\n/g, "\n").trim();

  if (!title) return { ok: false, error: "請輸入標題" };
  if (title.length > MAX_ANNOUNCEMENT_TITLE_LENGTH) {
    return { ok: false, error: `標題不能超過 ${MAX_ANNOUNCEMENT_TITLE_LENGTH} 字` };
  }
  if (content.length > MAX_ANNOUNCEMENT_CONTENT_LENGTH) {
    return { ok: false, error: `內容不能超過 ${MAX_ANNOUNCEMENT_CONTENT_LENGTH} 字` };
  }

  const audience = [
    ...new Set(form.getAll("audience").map((v) => v.toString())),
  ].filter((v): v is AnnouncementAudience =>
    ANNOUNCEMENT_AUDIENCE_VALUES.includes(v as AnnouncementAudience),
  );
  if (audience.length === 0) return { ok: false, error: "請至少選擇一個推送對象" };

  const subjects = [...new Set(form.getAll("subjects").map((v) => v.toString()))].filter(
    (v): v is Subject => ALL_SUBJECTS.includes(v as Subject),
  );

  const startAt = readDate(form.get("startAt"));
  const endAt = readDate(form.get("endAt"));
  if (startAt === "invalid") return { ok: false, error: "開始時間格式不正確" };
  if (endAt === "invalid") return { ok: false, error: "結束時間格式不正確" };
  if (endAt && endAt.getTime() <= (startAt ?? new Date()).getTime()) {
    return { ok: false, error: "結束時間必須晚於開始時間" };
  }

  const keepImages = [...new Set(form.getAll("keepImages").map((v) => v.toString()))].filter(
    (id) => mongoose.Types.ObjectId.isValid(id),
  );

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (keepImages.length + files.length > MAX_ANNOUNCEMENT_IMAGES) {
    return { ok: false, error: `最多只能附加 ${MAX_ANNOUNCEMENT_IMAGES} 張圖片` };
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `單次上傳的圖片總大小上限為 ${MAX_UPLOAD_LABEL}`, status: 413 };
  }

  const newImages: PendingImage[] = [];
  for (const file of files) {
    if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
      return {
        ok: false,
        error: `圖片「${file.name}」過大（每張上限 ${MAX_ANNOUNCEMENT_IMAGE_LABEL}）`,
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
      content,
      audience,
      subjects,
      active: (form.get("active") ?? "true").toString() !== "false",
      startAt,
      endAt,
      keepImages,
      newImages,
      repush: (form.get("repush") ?? "").toString() === "true",
    },
  };
}

/** Convert a Node async-iterable stream into a Web ReadableStream. */
export function toWebStream(nodeStream: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = nodeStream[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
