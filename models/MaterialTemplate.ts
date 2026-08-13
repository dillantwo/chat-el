import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import type { IMaterialGroup } from "@/models/SchoolMaterialLayout";

/**
 * A per-subject template layout, not tied to any school. Admins edit one
 * template per subject and can then sync it to every school's layout.
 */
export interface IMaterialTemplate extends Document {
  subject: Subject;
  groups: IMaterialGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const TemplateGroupSchema = new Schema<IMaterialGroup>(
  {
    name: { type: String, required: true, trim: true },
    materials: {
      type: [{ type: Schema.Types.ObjectId, ref: "LearningMaterial" }],
      default: [],
    },
  },
  { _id: false }
);

const MaterialTemplateSchema = new Schema<IMaterialTemplate>(
  {
    subject: { type: String, enum: ALL_SUBJECTS, required: true, unique: true },
    groups: { type: [TemplateGroupSchema], default: [] },
  },
  { timestamps: true }
);

export const MaterialTemplate = defineModel<IMaterialTemplate>("MaterialTemplate", MaterialTemplateSchema);

export type { Types };
