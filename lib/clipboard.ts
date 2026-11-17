// Client-only clipboard helpers for 提示詞.

/**
 * Copy plain text. Falls back to a hidden textarea + `execCommand("copy")`
 * where the async Clipboard API is missing (non-HTTPS origins, older browsers).
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    if (!document.execCommand("copy")) throw new Error("copy failed");
  } finally {
    document.body.removeChild(area);
  }
}

/** Whether this browser can put a picture on the clipboard at all. */
export function canCopyImage(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

/**
 * Re-encode any image the browser can decode as PNG. PNG is the only image
 * type every browser accepts on the clipboard, so a JPEG/WebP/GIF has to be
 * converted or the paste comes out empty. A GIF keeps its first frame.
 */
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("encode failed"))), "image/png"),
    );
  } finally {
    bitmap.close();
  }
}

/**
 * Copy the picture at `url` (same origin) to the clipboard as a real image, so
 * pasting into a chat box, Word or PowerPoint inserts the picture itself.
 *
 * The ClipboardItem is built synchronously with a *promise* of the PNG rather
 * than awaiting the download first: Safari only allows clipboard writes that
 * start inside the click, and the fetch would otherwise use that window up.
 */
export async function copyImage(url: string): Promise<void> {
  if (!canCopyImage()) throw new Error("unsupported");

  const png = fetch(url, { credentials: "same-origin" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then(toPng);

  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
