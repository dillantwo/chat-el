import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

/**
 * One ordered group ("分組") within a school's subject layout, holding an
 * ordered list of references to resource-pool materials.
 */
export interface IMaterialGroup {
  name: string;
  materials: Types.ObjectId[];
}

/**
 * Per (school, subject) layout describing how that school's learning materials
 * are grouped and ordered. Different schools can define completely different
 * groups even for the same subject.
 */
export interface ISchoolMaterialLayout extends Document {
  school: Types.ObjectId;
  subject: Subject;
  groups: IMaterialGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const MaterialGroupSchema = new Schema<IMaterialGroup>(
  {
    name: { type: String, required: true, trim: true },
    materials: {
      type: [{ type: Schema.Types.ObjectId, ref: "LearningMaterial" }],
      default: [],
    },
  },
  { _id: false }
);

const SchoolMaterialLayoutSchema = new Schema<ISchoolMaterialLayout>(
  {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    subject: { type: String, enum: ALL_SUBJECTS, required: true, index: true },
    groups: { type: [MaterialGroupSchema], default: [] },
  },
  { timestamps: true }
);

// One layout per school+subject.
SchoolMaterialLayoutSchema.index({ school: 1, subject: 1 }, { unique: true });

export const SchoolMaterialLayout = defineModel<ISchoolMaterialLayout>("SchoolMaterialLayout", SchoolMaterialLayoutSchema);
