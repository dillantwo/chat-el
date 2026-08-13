/**
 * Single source of truth for upload size limits.
 *
 * The limit is expressed in RAW bytes (what the user sees in their file
 * manager), not in transport bytes. Two transports carry these uploads:
 *
 *   - multipart/form-data (admin learning materials) — sends raw bytes, so the
 *     request body is ~= the file size.
 *   - base64 data URLs inside a JSON body (chat images, podcast audio) — base64
 *     inflates by 4/3, so a 20MB image becomes a ~27MB request body.
 *
 * nginx's `client_max_body_size` therefore has to sit ABOVE this number; see
 * nginx.conf. Keep the two in sync when changing this.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Human-readable form of MAX_UPLOAD_BYTES, for UI copy and API errors. */
export const MAX_UPLOAD_LABEL = "20MB";

/**
 * Character budget for a base64 data URL holding `rawBytes` of payload.
 * base64 encodes 3 bytes as 4 characters; the slack covers the
 * `data:<mime>;base64,` prefix.
 */
export function dataUrlCharLimit(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4 + 256;
}

/**
 * Client-side guard for attachment pickers (file input + paste).
 *
 * The cap applies to the TOTAL of one request, not to each file, because chat
 * panels send every attachment in a single JSON body — four 20MB images would
 * otherwise blow past nginx and fail as an opaque 413. Oversized files are
 * dropped and the user is told which ones, matching how the rest of the app
 * reports this kind of error (window.alert).
 */
export function filterUploadsWithinLimit(
  existing: readonly File[],
  incoming: readonly File[],
  lang: "zh" | "en" = "zh",
): File[] {
  let total = existing.reduce((sum, file) => sum + file.size, 0);
  const accepted: File[] = [];
  const rejected: string[] = [];

  for (const file of incoming) {
    if (total + file.size > MAX_UPLOAD_BYTES) {
      rejected.push(file.name || (lang === "en" ? "untitled file" : "未命名檔案"));
      continue;
    }
    total += file.size;
    accepted.push(file);
  }

  if (rejected.length > 0 && typeof window !== "undefined") {
    const message =
      lang === "en"
        ? `Attachments are limited to ${MAX_UPLOAD_LABEL} per message. Skipped:\n${rejected.join("\n")}`
        : `單次上傳總大小上限為 ${MAX_UPLOAD_LABEL}，已略過以下檔案：\n${rejected.join("\n")}`;
    window.alert(message);
  }

  return accepted;
}
