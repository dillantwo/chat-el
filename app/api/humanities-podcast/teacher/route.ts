import mongoose from "mongoose";
import { PodcastRecording } from "@/models/PodcastRecording";
import { podcastAudioDataUrl } from "@/lib/podcast-audio";
import {
  findScopedStudent,
  jsonError,
  requireTeacherDataScope,
  summarizeStudents,
  type StudentRecordStats,
} from "@/lib/teacher-data-access";

// Reading audio out of GridFS needs the Node runtime.
export const runtime = "nodejs";

const DEFAULT_TOPIC = "anti-japanese-war";

interface RecDoc {
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

function serializeMeta(doc: RecDoc) {
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
    const auth = await requireTeacherDataScope("humanities", req);
    if (!auth.ok) return jsonError(auth.message, auth.status);
    const { scope } = auth;

    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic")?.trim() || DEFAULT_TOPIC;
    const studentId = searchParams.get("studentId")?.trim();
    const recordingId = searchParams.get("recordingId")?.trim();

    // --- A single recording (with audio) for playback ---
    if (studentId && recordingId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) return jsonError("找不到該學生", 404);

      const doc = await PodcastRecording.findOne({
        userId: studentId,
        recordingId,
        topic,
      }).lean<RecDoc | null>();
      if (!doc) return jsonError("找不到該錄音", 404);

      return Response.json({
        item: { ...serializeMeta(doc), audioData: await podcastAudioDataUrl(doc) },
      });
    }

    // --- One student's recordings (metadata only) ---
    if (studentId) {
      const student = await findScopedStudent(scope, studentId);
      if (!student) return jsonError("找不到該學生", 404);

      const docs = await PodcastRecording.find({ userId: studentId, topic })
        .sort({ updatedAt: -1 })
        .lean<RecDoc[]>();

      return Response.json({
        student: {
          id: studentId,
          displayName: String(student.displayName),
          username: String(student.username),
        },
        items: docs.map(serializeMeta),
      });
    }

    // --- List students (in this school) who have podcast recordings ---
    const grouped = await PodcastRecording.aggregate<StudentRecordStats>([
      { $match: { topic } },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          lastUpdatedAt: { $max: "$updatedAt" },
        },
      },
    ]);

    return Response.json({ students: await summarizeStudents(scope, grouped) });
  } catch (error) {
    console.error("[humanities-podcast/teacher] GET Error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
