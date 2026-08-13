import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

/**
 * GridFS buckets. Binaries are stored here instead of inline in the owning
 * document so they are not constrained by MongoDB's 16MB document limit, and so
 * list queries stay cheap (the payload is never part of the document).
 */
const MATERIALS_BUCKET = "learningMaterials";
const PODCAST_AUDIO_BUCKET = "podcastAudio";

/** Resolve a GridFSBucket bound to the shared mongoose connection. */
async function getBucket(bucketName: string): Promise<mongoose.mongo.GridFSBucket> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not ready");
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}

/** Upload a buffer and resolve with the stored file's ObjectId. */
async function uploadToBucket(
  bucketName: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<mongoose.Types.ObjectId> {
  const bucket = await getBucket(bucketName);
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { metadata: { contentType } });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id as mongoose.Types.ObjectId));
    uploadStream.end(buffer);
  });
}

/** Delete a stored file. Missing files are ignored. */
async function deleteFromBucket(
  bucketName: string,
  fileId: mongoose.Types.ObjectId
): Promise<void> {
  const bucket = await getBucket(bucketName);
  try {
    await bucket.delete(fileId);
  } catch {
    // File may already be gone — dropping the reference is what matters.
  }
}

/** Read a stored file fully into memory. */
async function readFromBucket(
  bucketName: string,
  fileId: mongoose.Types.ObjectId
): Promise<Buffer> {
  const bucket = await getBucket(bucketName);
  const chunks: Buffer[] = [];
  for await (const chunk of bucket.openDownloadStream(fileId)) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

// ---------- Learning materials (admin-uploaded PDFs / slide decks) ----------

export function uploadMaterialFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<mongoose.Types.ObjectId> {
  return uploadToBucket(MATERIALS_BUCKET, buffer, filename, contentType);
}

export function deleteMaterialFile(fileId: mongoose.Types.ObjectId): Promise<void> {
  return deleteFromBucket(MATERIALS_BUCKET, fileId);
}

/** Open a readable download stream for a stored material. */
export async function openMaterialDownloadStream(
  fileId: mongoose.Types.ObjectId
): Promise<mongoose.mongo.GridFSBucketReadStream> {
  const bucket = await getBucket(MATERIALS_BUCKET);
  return bucket.openDownloadStream(fileId);
}

// ---------- Podcast audio (student voice recordings) ----------

export function uploadPodcastAudio(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<mongoose.Types.ObjectId> {
  return uploadToBucket(PODCAST_AUDIO_BUCKET, buffer, filename, contentType);
}

export function deletePodcastAudio(fileId: mongoose.Types.ObjectId): Promise<void> {
  return deleteFromBucket(PODCAST_AUDIO_BUCKET, fileId);
}

export function readPodcastAudio(fileId: mongoose.Types.ObjectId): Promise<Buffer> {
  return readFromBucket(PODCAST_AUDIO_BUCKET, fileId);
}
