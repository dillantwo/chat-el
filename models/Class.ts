import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export interface IClass extends Document {
  /** The school this class belongs to. Classes never span schools. */
  school: Types.ObjectId;
  /** Class name as the school writes it, e.g. "6A". */
  name: string;
  /**
   * Academic year, "2025-2026". Stored from day one because classes are
   * re-formed every year: "6A" in 2025-2026 is a different cohort from "6A" in
   * 2026-2027, and without the year a promoted student's historical records
   * would be attributed to the wrong group.
   */
  academicYear: string;
  /**
   * Whether the class is still in use. Retiring a cohort is a labelling change
   * only: disabled classes stay assignable and keep working, so a teacher never
   * loses access to a past class's records. Deleting is the destructive option
   * and is blocked while members remain.
   */
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One "6A" per school per academic year.
ClassSchema.index({ school: 1, academicYear: 1, name: 1 }, { unique: true });

export const Class = defineModel<IClass>("Class", ClassSchema);
