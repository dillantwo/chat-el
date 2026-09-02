import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

/**
 * One ordered group ("分組") within a template, holding an ordered list of
 * references to resource-pool materials.
 */
export interface IMaterialGroup {
  name: string;
  materials: Types.ObjectId[];
}

/**
 * A named layout for one subject, together with the schools it applies to.
 *
 * This is the single source of truth for what a school sees on its 學習資源
 * page: /api/learning-materials looks up the template whose `schools` holds the
 * caller's school and resolves its groups on the spot. Saving a template is
 * therefore all it takes to change what those schools see — there is no copy to
 * push and no way for a school to drift out of date.
 *
 * A school belongs to at most one template per subject. The admin API enforces
 * that by moving a school out of its previous template rather than letting two
 * claim it, because with two matches the page's contents would depend on which
 * document the query happened to return first.
 *
 * Replaces the old per-school `SchoolMaterialLayout` collection, which stored a
 * copy of the groups for every school and had to be re-synced by hand after each
 * edit. scripts/migrate-material-templates.ts folds those layouts into templates.
 */
export interface IMaterialTemplate extends Document {
  subject: Subject;
  /** Shown in the 範本 picker. Unique within a subject. */
  name: string;
  /** 適用學校. Empty means the template is a draft that nobody can see yet. */
  schools: Types.ObjectId[];
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
    // No `index: true` here: both indexes below start with `subject`, and
    // declaring a plain `subject_1` as well would collide with the legacy unique
    // index of that name until the migration has dropped it.
    subject: { type: String, enum: ALL_SUBJECTS, required: true },
    name: { type: String, required: true, trim: true },
    schools: {
      type: [{ type: Schema.Types.ObjectId, ref: "School" }],
      default: [],
    },
    groups: { type: [TemplateGroupSchema], default: [] },
  },
  { timestamps: true }
);

// Two templates in the same subject may not share a name — the picker shows only
// the name, so duplicates would be indistinguishable.
MaterialTemplateSchema.index({ subject: 1, name: 1 }, { unique: true });

// Serves the student-facing lookup, which is by subject + school on every visit
// to a 學習資源 page.
MaterialTemplateSchema.index({ subject: 1, schools: 1 });

export const MaterialTemplate = defineModel<IMaterialTemplate>("MaterialTemplate", MaterialTemplateSchema);

export type { Types };
