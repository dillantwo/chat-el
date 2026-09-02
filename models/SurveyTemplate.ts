import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

/** The two phases a 類別 can hold. */
export const SURVEY_PHASES = ["pre", "post"] as const;
export type SurveyPhase = (typeof SURVEY_PHASES)[number];

/**
 * One questionnaire. `url` is validated as https at the API boundary, not here:
 * the value is put in an `<iframe src>` and an `href`, so anything but a plain
 * https URL has no business being stored.
 */
export interface ISurveySlot {
  title: string;
  url: string;
  description: string;
  /**
   * Whether to show the questionnaire inline. Some providers refuse to be framed
   * (X-Frame-Options / CSP), so this can be turned off to render a launch button
   * instead of an iframe that would just sit there blank.
   */
  embed: boolean;
}

/** One questionnaire inside a 類別, tagged with the phase it belongs to. */
export interface ISurveyItem extends ISurveySlot {
  phase: SurveyPhase;
}

/**
 * A named 類別, e.g. 「單元一：閱讀理解」, holding any number of questionnaires in
 * the order students see them — a 類別 may carry several 前測 and several 後測.
 *
 * An empty 類別 is a placeholder the admin has created but not filled in yet; the
 * student API drops those rather than showing an empty tab.
 */
export interface ISurveyGroup {
  name: string;
  surveys: ISurveyItem[];
  /**
   * @deprecated The single pre/post pair a 類別 held before `surveys` existed.
   * Still read — `templateGroups` folds it into the list — but never written
   * again: saving a template replaces the whole 類別 list.
   */
  pre?: ISurveySlot | null;
  /** @deprecated See `pre`. */
  post?: ISurveySlot | null;
}

/**
 * A named set of questionnaire 類別, together with the schools it applies to.
 *
 * Deliberately the same shape as MaterialTemplate: the template holds the
 * settings, `schools` says who gets them, and /api/survey-links reads it directly
 * so saving takes effect immediately. A school belongs to at most one survey
 * template per subject — the admin API moves it rather than letting two claim it,
 * because with two matches the page's contents would depend on which document the
 * query happened to return first.
 *
 * A 類別 may hold only 前測 questionnaires for a while: a class often has the 前測
 * running weeks before the 後測 links exist.
 */
export interface ISurveyTemplate extends Document {
  subject: Subject;
  /** Shown in the 範本 picker. Unique within a subject. */
  name: string;
  /** 適用學校. Empty means the template is a draft that nobody can see yet. */
  schools: Types.ObjectId[];
  /** 類別, in the order students see them. */
  groups: ISurveyGroup[];
  /**
   * @deprecated The single pre/post pair a template held before 類別 existed.
   * Still read — `templateGroups` turns it into one 類別 so old documents keep
   * working — but never written again: saving a template clears both fields.
   */
  pre: ISurveySlot | null;
  /** @deprecated See `pre`. */
  post: ISurveySlot | null;
  createdAt: Date;
  updatedAt: Date;
}

const SurveySlotSchema = new Schema<ISurveySlot>(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    embed: { type: Boolean, default: true },
  },
  { _id: false }
);

const SurveyItemSchema = new Schema<ISurveyItem>(
  {
    phase: { type: String, enum: SURVEY_PHASES, required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    embed: { type: Boolean, default: true },
  },
  { _id: false }
);

const SurveyGroupSchema = new Schema<ISurveyGroup>(
  {
    name: { type: String, required: true, trim: true },
    surveys: { type: [SurveyItemSchema], default: [] },
    // Declared without a default so new 類別 do not store two null fields, but
    // still declared: without them, saving a template that was only renamed
    // would strip the legacy pair off documents that have not been rewritten yet.
    pre: { type: SurveySlotSchema },
    post: { type: SurveySlotSchema },
  },
  { _id: false }
);

const SurveyTemplateSchema = new Schema<ISurveyTemplate>(
  {
    subject: { type: String, enum: ALL_SUBJECTS, required: true },
    name: { type: String, required: true, trim: true },
    schools: {
      type: [{ type: Schema.Types.ObjectId, ref: "School" }],
      default: [],
    },
    groups: { type: [SurveyGroupSchema], default: [] },
    pre: { type: SurveySlotSchema, default: null },
    post: { type: SurveySlotSchema, default: null },
  },
  { timestamps: true }
);

// Two templates in the same subject may not share a name — the picker shows only
// the name, so duplicates would be indistinguishable.
SurveyTemplateSchema.index({ subject: 1, name: 1 }, { unique: true });

// Serves the student-facing lookup, which is by subject + school on every visit
// to a 前測-後測 page.
SurveyTemplateSchema.index({ subject: 1, schools: 1 });

export const SurveyTemplate = defineModel<ISurveyTemplate>("SurveyTemplate", SurveyTemplateSchema);
