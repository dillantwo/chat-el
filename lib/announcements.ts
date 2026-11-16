// Client-safe announcement constants and DTO types. Do NOT import models here —
// that would pull mongoose into client bundles.

/** Who an announcement is pushed to. Admins never receive announcements. */
export const ANNOUNCEMENT_AUDIENCES = [
  { value: "student", label: "學生" },
  { value: "teacher", label: "老師" },
] as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number]["value"];

export const ANNOUNCEMENT_AUDIENCE_VALUES: AnnouncementAudience[] =
  ANNOUNCEMENT_AUDIENCES.map((a) => a.value);

export const MAX_ANNOUNCEMENT_TITLE_LENGTH = 100;
export const MAX_ANNOUNCEMENT_CONTENT_LENGTH = 5000;
export const MAX_ANNOUNCEMENT_IMAGES = 6;
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ANNOUNCEMENT_IMAGE_LABEL = "5MB";

/**
 * Formats the server accepts. SVG is left out on purpose: it can carry script,
 * and these files are served back inline from our own origin.
 */
export const ANNOUNCEMENT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Value for the `<input type="file" accept>` attribute. */
export const ANNOUNCEMENT_IMAGE_ACCEPT = ANNOUNCEMENT_IMAGE_TYPES.join(",");

/** URL path (without basePath) that serves one announcement image. */
export function announcementImagePath(imageId: string): string {
  return `/api/announcements/images/${imageId}`;
}

export interface AnnouncementImageDTO {
  id: string;
  contentType: string;
  size: number;
}

/** What the admin page lists and edits. */
export interface AdminAnnouncementDTO {
  id: string;
  title: string;
  content: string;
  images: AnnouncementImageDTO[];
  audience: AnnouncementAudience[];
  /** Empty means every subject. */
  subjects: string[];
  active: boolean;
  startAt: string;
  endAt: string | null;
  /** Last time the announcement was (re)pushed. Reads before this do not count. */
  pushedAt: string;
  /** Users who have read the current push. */
  readCount: number;
  createdAt: string;
  updatedAt: string;
}

/** What a student or teacher receives. */
export interface UserAnnouncementDTO {
  id: string;
  title: string;
  content: string;
  images: AnnouncementImageDTO[];
  pushedAt: string;
  unread: boolean;
}

export type AnnouncementStatus = "inactive" | "scheduled" | "expired" | "live";

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  inactive: "已停用",
  scheduled: "未開始",
  expired: "已過期",
  live: "推送中",
};

export function announcementStatus(
  a: Pick<AdminAnnouncementDTO, "active" | "startAt" | "endAt">,
  now: number = Date.now(),
): AnnouncementStatus {
  if (!a.active) return "inactive";
  if (new Date(a.startAt).getTime() > now) return "scheduled";
  if (a.endAt && new Date(a.endAt).getTime() <= now) return "expired";
  return "live";
}
