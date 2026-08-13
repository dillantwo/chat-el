import "server-only";
import mongoose from "mongoose";
import { readPodcastAudio } from "@/lib/gridfs";

/**
 * Podcast audio storage.
 *
 * The bytes live in GridFS (see lib/gridfs.ts) rather than inline in the
 * PodcastRecording document: a 20MB recording becomes ~27MB of base64, which no
 * single MongoDB document can hold (16MB BSON limit).
 *
 * The HTTP contract is still a base64 data URL in both directions, so the audio
 * players work unchanged — only the storage differs.
 */

const DEFAULT_MIME_TYPE = "audio/webm";

/** The subset of a PodcastRecording needed to resolve its audio. */
export interface StoredPodcastAudio {
  audioFileId: mongoose.Types.ObjectId;
  mimeType?: string;
}

/** Read the audio back out of GridFS as the data URL the players expect. */
export async function podcastAudioDataUrl(doc: StoredPodcastAudio): Promise<string> {
  const buffer = await readPodcastAudio(doc.audioFileId);
  return `data:${doc.mimeType || DEFAULT_MIME_TYPE};base64,${buffer.toString("base64")}`;
}

/**
 * Decode an incoming `data:<mime>;base64,<payload>` string.
 * Returns null when the string is not a base64 data URL or carries no bytes.
 */
export function decodeAudioDataUrl(
  dataUrl: string
): { mimeType: string; buffer: Buffer } | null {
  if (!dataUrl.startsWith("data:")) return null;

  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;

  // e.g. "audio/webm;codecs=opus;base64" — the mime type itself may contain ";".
  const header = dataUrl.slice("data:".length, comma);
  if (!header.endsWith(";base64")) return null;

  const buffer = Buffer.from(dataUrl.slice(comma + 1), "base64");
  if (buffer.length === 0) return null;

  return {
    mimeType: header.slice(0, -";base64".length) || DEFAULT_MIME_TYPE,
    buffer,
  };
}
