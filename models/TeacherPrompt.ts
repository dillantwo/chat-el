import { Schema, Types, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

/** One picture attached to a prompt. The bytes live in GridFS. */
export interface ITeacherPromptImage {
  fileId: Types.ObjectId;
  /** Detected from the file's magic bytes, never taken from the browser. */
  contentType: string;
  size: number;
}

/**
 * A 提示詞 a teacher wrote for one subject, for their students to copy.
 *
 * Who may read it is not stored here. A student sees a published prompt when
 * they share a class with its author, limited to the classes chosen in
 * TeacherPromptSetting — the same "shares a class" rule as 查看學生數據,
 * derived from the accounts on every request so that moving a teacher or a
 * student in 用戶管理 takes effect immediately. See lib/teacher-prompts.ts.
 *
 * There is no `school` field for the same reason: the author's current school
 * is what counts, not the one they were at when they wrote it.
 */
export interface ITeacherPrompt extends Document {
  teacher: Types.ObjectId;
  subject: Subject;
  title: string;
  /**
   * The copyable texts, in order. Plain text, shown and copied exactly as
   * typed, each with its own copy button.
   */
  items: string[];
  /**
   * Legacy single text from before `items` existed. Read as a one-item list
   * (see `promptItems()` in lib/teacher-prompts.ts) and removed on next save,
   * so no migration is needed.
   */
  content?: string;
  images: ITeacherPromptImage[];
  /** false = 草稿: only the author sees it. */
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherPromptImageSchema = new Schema<ITeacherPromptImage>(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const TeacherPromptSchema = new Schema<ITeacherPrompt>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, enum: ALL_SUBJECTS, required: true },
    title: { type: String, required: true, trim: true },
    items: { type: [String], default: [] },
    content: { type: String, default: undefined },
    images: { type: [TeacherPromptImageSchema], default: [] },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Author's own list, and the student query (teacher ∈ … , subject, published).
TeacherPromptSchema.index({ teacher: 1, subject: 1, createdAt: -1 });
TeacherPromptSchema.index({ "images.fileId": 1 });

export const TeacherPrompt = defineModel<ITeacherPrompt>("TeacherPrompt", TeacherPromptSchema);
