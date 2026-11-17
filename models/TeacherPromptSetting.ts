import { Schema, Types, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

/**
 * Which of a teacher's classes see their 提示詞 in one subject. One setting
 * covers every prompt the teacher wrote for that subject.
 *
 * No document means the teacher never chose, and every class they teach sees
 * the published prompts. Once saved, the list is intersected with the classes
 * the teacher teaches *now* on every read, so removing a teacher from a class
 * in 用戶管理 also withdraws their prompts from it.
 */
export interface ITeacherPromptSetting extends Document {
  teacher: Types.ObjectId;
  subject: Subject;
  classes: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TeacherPromptSettingSchema = new Schema<ITeacherPromptSetting>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, enum: ALL_SUBJECTS, required: true },
    classes: { type: [{ type: Schema.Types.ObjectId, ref: "Class" }], default: [] },
  },
  { timestamps: true },
);

TeacherPromptSettingSchema.index({ teacher: 1, subject: 1 }, { unique: true });

export const TeacherPromptSetting = defineModel<ITeacherPromptSetting>(
  "TeacherPromptSetting",
  TeacherPromptSettingSchema,
);
