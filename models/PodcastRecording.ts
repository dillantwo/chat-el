import mongoose, { Schema, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export interface IPodcastRecording extends Document {
  userId: string;
  recordingId: string;
  topic: string;
  title: string;
  /** Optional script/notes the student prepared before recording. */
  script: string;
  /**
   * GridFS file holding the audio (bucket "podcastAudio"). Stored out of line
   * because inline base64 would cap a recording at MongoDB's 16MB document
   * limit — see lib/podcast-audio.ts.
   */
  audioFileId: mongoose.Types.ObjectId;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const PodcastRecordingSchema = new Schema<IPodcastRecording>(
  {
    userId: { type: String, required: true, index: true },
    recordingId: { type: String, required: true },
    topic: { type: String, required: true, index: true },
    title: { type: String, required: true },
    script: { type: String, default: "" },
    audioFileId: { type: Schema.Types.ObjectId, required: true },
    mimeType: { type: String, default: "audio/webm" },
    durationSec: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PodcastRecordingSchema.index({ userId: 1, recordingId: 1 }, { unique: true });
PodcastRecordingSchema.index({ userId: 1, topic: 1, updatedAt: -1 });

export const PodcastRecording = defineModel<IPodcastRecording>("PodcastRecording", PodcastRecordingSchema);
