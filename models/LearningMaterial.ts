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
 * Where a resource's content lives.
 * - "file": uploaded here, bytes in GridFS, handed out by the download route
 * - "link": hosted elsewhere, opened straight from the student page
 *
 * Both kinds sit in the same pool so a group can mix them and so links inherit
 * everything the pool already does: 開放對象 filtering, assignment to template
 * groups, and reference cleanup on delete.
 */
export type MaterialKind = "file" | "link";

export const MATERIAL_KINDS: MaterialKind[] = ["file", "link"];

/**
 * A single uploaded resource in the school-agnostic resource pool.
 * Grouping and per-school assignment live in MaterialTemplate — a resource here
 * is just the file (or link) plus its metadata.
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
  /** Whether the content is an uploaded file or an external link */
  kind: MaterialKind;
  /** GridFS file id holding the binary content. Files only. */
  fileId?: Types.ObjectId;
  /** Original uploaded file name. Files only; `""` for links. */
  filename: string;
  /** External https URL. Links only; `""` for files. */
  url: string;
  /** MIME type of the stored file. Files only. */
  contentType: string;
  /** File size in bytes. Files only; `0` for links. */
  size: number;
  /** userId of the admin who uploaded it */
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** True when this document needs the file half of the schema filled in. */
function isFile(this: ILearningMaterial): boolean {
  return this.kind !== "link";
}

/** True when this document needs the link half of the schema filled in. */
function isLink(this: ILearningMaterial): boolean {
  return this.kind === "link";
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
    // Defaults to "file" so every document written before links existed reads
    // back as what it is, with no migration.
    kind: {
      type: String,
      enum: MATERIAL_KINDS,
      default: "file",
      required: true,
    },
    // The file and link halves are each required only for their own kind, so a
    // half-built resource cannot be saved either way round.
    fileId: { type: Schema.Types.ObjectId, required: isFile },
    filename: { type: String, default: "", required: isFile },
    url: { type: String, default: "", trim: true, required: isLink },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const LearningMaterial = defineModel<ILearningMaterial>("LearningMaterial", LearningMaterialSchema);
