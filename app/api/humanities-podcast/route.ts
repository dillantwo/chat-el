import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { PodcastRecording } from "@/models/PodcastRecording";
import { deletePodcastAudio, uploadPodcastAudio } from "@/lib/gridfs";
import { decodeAudioDataUrl, podcastAudioDataUrl } from "@/lib/podcast-audio";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, dataUrlCharLimit } from "@/lib/upload-limits";

// GridFS streaming and Buffer decoding both need the Node runtime.
export const runtime = "nodejs";

// Cheap pre-check on the encoded string, so an oversized payload is rejected
// before it is decoded into a second copy in memory.
const MAX_AUDIO_DATA_URL_CHARS = dataUrlCharLimit(MAX_UPLOAD_BYTES);

function unauthorized() {
  return new Response(JSON.stringify({ error: "未登錄" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

interface RecordingDoc {
  recordingId: string;
  topic: string;
  title: string;
  script?: string;
  audioFileId: mongoose.Types.ObjectId;
  mimeType?: string;
  durationSec?: number;
  sizeBytes?: number;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(doc: RecordingDoc) {
  return {
    id: String(doc.recordingId),
    topic: String(doc.topic),
    title: String(doc.title),
    script: doc.script ?? "",
    mimeType: doc.mimeType ?? "audio/webm",
    durationSec: doc.durationSec ?? 0,
    sizeBytes: doc.sizeBytes ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const denied = await requireTopicApi("humanities", "anti-japanese-war");
    if (denied) return denied;

    await connectDB();

    const { searchParams } = new URL(req.url);
    const recordingId = searchParams.get("recordingId")?.trim();

    // Fetch a single recording including its (heavy) audio payload.
    if (recordingId) {
      const doc = await PodcastRecording.findOne({
        userId: session.userId,
        recordingId,
      }).lean<RecordingDoc | null>();
      if (!doc) return Response.json({ item: null });

      return Response.json({
        item: { ...serialize(doc), audioData: await podcastAudioDataUrl(doc) },
      });
    }

    // Listing is metadata only; the audio lives in GridFS, not in these docs.
    const topic = searchParams.get("topic")?.trim();
    const docs = await PodcastRecording.find({
      userId: session.userId,
      ...(topic ? { topic } : {}),
    })
      .sort({ updatedAt: -1 })
      .lean<RecordingDoc[]>();

    return Response.json({ items: docs.map(serialize) });
  } catch (error) {
    console.error("[humanities-podcast] GET Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function POST(req: Request) {
  let uploadedFileId: mongoose.Types.ObjectId | null = null;
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const denied = await requireTopicApi("humanities", "anti-japanese-war");
    if (denied) return denied;

    const { id, topic, title, script, audioData, mimeType, durationSec } =
      (await req.json()) as {
        id?: string;
        topic?: string;
        title?: string;
        script?: string;
        audioData?: string;
        mimeType?: string;
        durationSec?: number;
        sizeBytes?: number;
      };

    if (!id || !topic) return badRequest("id and topic are required");
    if (!audioData || !audioData.startsWith("data:")) {
      return badRequest("audioData (a base64 data URL) is required");
    }
    if (audioData.length > MAX_AUDIO_DATA_URL_CHARS) {
      return badRequest(`錄音檔案太大了（上限 ${MAX_UPLOAD_LABEL}），請錄製較短的片段。`);
    }

    const decoded = decodeAudioDataUrl(audioData);
    if (!decoded) return badRequest("audioData is not a valid base64 data URL");
    if (decoded.buffer.length > MAX_UPLOAD_BYTES) {
      return badRequest(`錄音檔案太大了（上限 ${MAX_UPLOAD_LABEL}），請錄製較短的片段。`);
    }

    await connectDB();

    // Re-saving the same recordingId replaces the audio, so the file it used to
    // point at has to be cleaned up once the new reference is committed.
    const previous = await PodcastRecording.findOne({
      userId: session.userId,
      recordingId: id,
    })
      .select("audioFileId")
      .lean<{ audioFileId?: mongoose.Types.ObjectId } | null>();

    const resolvedMimeType = mimeType?.trim() || decoded.mimeType;
    uploadedFileId = await uploadPodcastAudio(
      decoded.buffer,
      `podcast-${id}`,
      resolvedMimeType,
    );

    const doc = await PodcastRecording.findOneAndUpdate(
      { userId: session.userId, recordingId: id },
      {
        $set: {
          userId: session.userId,
          recordingId: id,
          topic: topic.trim(),
          title: (title?.trim() || "未命名播客").slice(0, 80),
          script: (script ?? "").slice(0, 5000),
          audioFileId: uploadedFileId,
          mimeType: resolvedMimeType,
          durationSec: Math.max(0, Math.round(durationSec ?? 0)),
          // Measured server-side rather than trusting the client's figure.
          sizeBytes: decoded.buffer.length,
        },
      },
      { returnDocument: "after", upsert: true },
    );

    // Only safe once the document no longer references it.
    if (previous?.audioFileId) await deletePodcastAudio(previous.audioFileId);
    uploadedFileId = null;

    return Response.json({ item: { id: String(doc.recordingId), updatedAt: doc.updatedAt } });
  } catch (error) {
    // Roll back the orphaned GridFS file if the metadata write failed.
    if (uploadedFileId) await deletePodcastAudio(uploadedFileId);
    console.error("[humanities-podcast] POST Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const denied = await requireTopicApi("humanities", "anti-japanese-war");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const recordingId = searchParams.get("recordingId")?.trim();
    if (!recordingId) return badRequest("recordingId is required");

    await connectDB();
    const doc = await PodcastRecording.findOneAndDelete({
      userId: session.userId,
      recordingId,
    });
    if (doc?.audioFileId) await deletePodcastAudio(doc.audioFileId);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[humanities-podcast] DELETE Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
