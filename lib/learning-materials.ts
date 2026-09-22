// Client-safe learning-material constants. Do NOT import models here — that
// would pull mongoose into client bundles. Keep audiences and kinds in sync with
// models/LearningMaterial.ts.

export const MATERIAL_AUDIENCES = [
  { value: "both", label: "老師和學生" },
  { value: "teacher", label: "只限老師" },
  { value: "student", label: "只限學生" },
] as const;

export type MaterialAudienceValue = (typeof MATERIAL_AUDIENCES)[number]["value"];

export const MATERIAL_AUDIENCE_LABELS: Record<string, string> = Object.fromEntries(
  MATERIAL_AUDIENCES.map((a) => [a.value, a.label])
);

/** A pool resource is either an uploaded file or a link to somewhere else. */
export const MATERIAL_KINDS = [
  { value: "file", label: "上傳檔案" },
  { value: "link", label: "外部連結" },
] as const;

export type MaterialKindValue = (typeof MATERIAL_KINDS)[number]["value"];

export const MATERIAL_KIND_LABELS: Record<string, string> = Object.fromEntries(
  MATERIAL_KINDS.map((k) => [k.value, k.label])
);

/** Long enough for any real share link, short enough to keep a document small. */
export const MAX_LINK_URL_LENGTH = 2000;

export type LinkUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validate and normalise a link resource's URL.
 *
 * Only plain https is accepted. The value ends up in an `href` on the student
 * page, so `javascript:` and friends are rejected at the point of writing rather
 * than at render time; http would be blocked as mixed content there anyway.
 *
 * Shared by the admin form and the API so the browser can report a bad link
 * before the round trip without the two rules drifting apart. The API is still
 * the one that decides — it does not trust the client to have run this.
 */
export function parseLinkUrl(raw: string): LinkUrlResult {
  const value = raw.trim();
  if (!value) return { ok: false, error: "請輸入連結網址" };
  if (value.length > MAX_LINK_URL_LENGTH) {
    return { ok: false, error: `連結網址過長（上限 ${MAX_LINK_URL_LENGTH} 字）` };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "連結格式不正確，請包含開頭的 https://" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "連結必須以 https:// 開頭" };
  }

  return { ok: true, url: parsed.toString() };
}

/**
 * Hostname of a link, shown wherever a file would show its filename and size.
 * Falls back to the raw value so a stored link that no longer parses is still
 * legible instead of vanishing.
 */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Human readable file size, e.g. 1.2 MB. */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** One pool resource, as the admin API hands it over. */
export interface MaterialDTO {
  id: string;
  subject: string;
  title: string;
  description: string;
  audience: string;
  kind: MaterialKindValue;
  /** Files only; `""` for links. */
  filename: string;
  /** Links only; `""` for files. */
  url: string;
  contentType: string;
  size: number;
  /** ISO 8601, or `""` when unknown. */
  createdAt: string;
}

/** Structural view of a stored material — no mongoose types, on purpose. */
export interface SerializableMaterial {
  _id: unknown;
  subject: string;
  title: string;
  description?: string | null;
  audience: string;
  kind?: string | null;
  filename?: string | null;
  url?: string | null;
  contentType?: string | null;
  size?: number | null;
  createdAt?: Date | string | null;
}

/**
 * The wire shape of a pool resource, shared by the list, create and update
 * responses so the three cannot answer with different fields.
 *
 * A missing `kind` means the document predates links, which is a file. `.lean()`
 * reads skip schema defaults, so that fallback has to live here too.
 */
export function serializeMaterial(doc: SerializableMaterial): MaterialDTO {
  return {
    id: String(doc._id),
    subject: doc.subject,
    title: doc.title,
    description: doc.description ?? "",
    audience: doc.audience,
    kind: doc.kind === "link" ? "link" : "file",
    filename: doc.filename ?? "",
    url: doc.url ?? "",
    contentType: doc.contentType ?? "",
    size: doc.size ?? 0,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
  };
}
