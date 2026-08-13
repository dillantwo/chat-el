import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export type UserRole = "admin" | "teacher" | "student";

export type Subject = "math" | "chinese" | "english" | "science" | "humanities";

export const ALL_SUBJECTS: Subject[] = ["math", "chinese", "english", "science", "humanities"];

export interface IUser extends Document {
  username: string;
  hashedPassword: string;
  role: UserRole;
  displayName: string;
  /**
   * The school this user belongs to. Required for teacher/student.
   * Admins are global and have no school (null).
   */
  school: Types.ObjectId | null;
  /** Subjects this user may access (must be a subset of the school's enabled subjects) */
  subjects: Subject[];
  /**
   * Subjects whose *student data* this teacher may review in 查看學生數據.
   * Teachers only; always a subset of the school's enabled subjects.
   *
   * Tri-state on purpose:
   *  - field absent  → not configured yet, falls back to `subjects`
   *  - `[]`          → explicitly no access to any subject's student data
   *  - `[...]`       → access to exactly those subjects
   *
   * The fallback keeps teachers created before this field existed working
   * without a migration. Resolve it with `effectiveDataSubjects()` rather
   * than reading the field directly.
   */
  dataSubjects?: Subject[];
  /**
   * Classes this user belongs to. Always within the user's own school.
   *
   * Both roles can hold several: a teacher teaches multiple classes, and a
   * student can sit in a homeroom class plus an elective group. For teachers
   * this is also the scope of 查看學生數據 — they only ever see students who
   * share a class with them, so a teacher with no class sees no students.
   */
  classes: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    hashedPassword: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    displayName: { type: String, required: true, trim: true },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    subjects: {
      type: [String],
      enum: ["math", "chinese", "english", "science", "humanities"],
      default: [],
    },
    dataSubjects: {
      type: [String],
      enum: ["math", "chinese", "english", "science", "humanities"],
      // No default: an absent field means "not configured", which is
      // meaningfully different from an empty array (see IUser.dataSubjects).
      default: undefined,
    },
    classes: {
      type: [{ type: Schema.Types.ObjectId, ref: "Class" }],
      default: [],
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * Which subjects' student data a teacher may review.
 * Falls back to their teaching subjects while `dataSubjects` is unset.
 */
export function effectiveDataSubjects(user: {
  subjects?: Subject[];
  dataSubjects?: Subject[] | null;
}): Subject[] {
  if (Array.isArray(user.dataSubjects)) return user.dataSubjects;
  return user.subjects ?? [];
}

export const User = defineModel<IUser>("User", UserSchema);
