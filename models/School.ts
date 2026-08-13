import { Schema, Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { Subject } from "@/models/User";

export interface ISchool extends Document {
  /** Human readable school name, e.g. "聖保羅書院" */
  name: string;
  /** Short unique code used in URLs / references, e.g. "spc" */
  code: string;
  /** Subjects this school has subscribed to / enabled */
  enabledSubjects: Subject[];
  /**
   * Topics this school has closed, as `subject:topic` keys (see lib/topics.ts).
   *
   * Deliberately a blocklist rather than an allowlist: a school with no entry
   * here gets every topic of its enabled subjects, so existing schools need no
   * migration and a topic added to the code later is open by default.
   */
  disabledTopics: string[];
  /** Whether the school is active. Disabled schools block all their users. */
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    enabledSubjects: {
      type: [String],
      enum: ["math", "chinese", "english", "science", "humanities"],
      default: [],
    },
    // Free-form strings on purpose: the valid set lives in lib/topics.ts and is
    // validated in the admin route, so adding a topic needs no schema change.
    disabledTopics: {
      type: [String],
      default: [],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const School = defineModel<ISchool>("School", SchoolSchema);
