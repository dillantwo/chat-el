import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

/**
 * Who a learning material is intended for.
 * - "teacher": only teachers can see/download
 * - "student": only students can see/download
 * - "both": teachers and students can see/download
 */
export type MaterialAudience = "teacher" | "student" | "both";

export const MATERIAL_AUDIENCES: MaterialAudience[] = ["teacher", "student", "both"];

/**
 * A single uploaded resource in the school-agnostic resource pool.
 * Grouping and per-school assignment live in MaterialTemplate — a resource here
 * is just the file plus its metadata.
 */
export interface ILearningMaterial extends Document {
  /** Subject this material belongs to (english, math, ...) */
  subject: Subject;
  /** Display title shown in the list */
  title: string;
  /** Optional longer description */
  description: string;
  /** Intended audience (teacher / student / both) */
  audience: MaterialAudience;
  /** GridFS file id holding the binary content */
  fileId: Types.ObjectId;
  /** Original uploaded file name */
  filename: string;
  /** MIME type of the stored file */
  contentType: string;
  /** File size in bytes */
  size: number;
  /** userId of the admin who uploaded it */
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const LearningMaterialSchema = new Schema<ILearningMaterial>(
  {
    subject: {
      type: String,
      enum: ALL_SUBJECTS,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    audience: {
      type: String,
      enum: MATERIAL_AUDIENCES,
      default: "both",
      required: true,
    },
    fileId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const LearningMaterial = defineModel<ILearningMaterial>("LearningMaterial", LearningMaterialSchema);
