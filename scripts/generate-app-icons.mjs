/**
 * Renders the browser/app icons from one vector source.
 *
 * The artwork is the second subject sticker on the login card — the open book in
 * 中國語文科 purple — so the browser tab matches the screen a pupil logs in from.
 * Kept as a script rather than three checked-in binaries with no origin: the SVG
 * below is the only place the shape is defined, and `npm run gen:icons` rebuilds
 * every raster from it.
 *
 * Outputs, all read by Next's app-icon file conventions (see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md):
 *   app/favicon.ico    16/32/48 — what browsers fetch by default, links or not
 *   app/icon.png       96px, emitted as <link rel="icon">
 *   app/apple-icon.png 180px, for "add to home screen" on iPad
 *
 * favicon.ico is regenerated rather than left in place because browsers request
 * /favicon.ico on their own, and bookmarks and history entries keep using it
 * even when a <link> points elsewhere. A stale one would quietly outlive the
 * change.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const APP_DIR = path.join(import.meta.dirname, "..", "app");

/** Design canvas is 64px. Border and stroke weights are deliberately heavy:
 *  at a 16px favicon a 1px hairline disappears, so the black keyline is 4/64
 *  and the book is drawn at stroke-width 3 in the glyph's own 24px space.
 *  The glyph is lucide's book-open, the same icon the sticker uses. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="15" fill="#7a3dff" stroke="#080808" stroke-width="4"/>
  <g transform="translate(13.5 13.5) scale(1.5417)"
     fill="none" stroke="#ffffff" stroke-width="3"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 7v14"/>
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
  </g>
</svg>`;

const SOURCE_SIZE = 64;

/** Rasterise at the target size directly. Passing a matching density makes
 *  librsvg draw at full resolution instead of rendering 64px and upscaling. */
async function render(size) {
  return sharp(Buffer.from(SVG), { density: (72 * size) / SOURCE_SIZE })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Packs PNGs into an ICO container. Sizes up to 256 may be stored as PNG
 * payloads, so no BMP encoding is needed — just the directory in front.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size, 0 for truecolour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const icoSizes = [16, 32, 48];
const ico = buildIco(
  await Promise.all(
    icoSizes.map(async (size) => ({ size, data: await render(size) })),
  ),
);

await writeFile(path.join(APP_DIR, "favicon.ico"), ico);
await writeFile(path.join(APP_DIR, "icon.png"), await render(96));
await writeFile(path.join(APP_DIR, "apple-icon.png"), await render(180));

console.log(
  `wrote app/favicon.ico (${icoSizes.join("/")}), app/icon.png (96), app/apple-icon.png (180)`,
);
