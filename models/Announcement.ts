import { Schema, Types, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import {
  ANNOUNCEMENT_AUDIENCE_VALUES,
  type AnnouncementAudience,
} from "@/lib/announcements";

/** One picture attached to an announcement. The bytes live in GridFS. */
export interface IAnnouncementImage {
  fileId: Types.ObjectId;
  /** Detected from the file's magic bytes, never taken from the browser. */
  contentType: string;
  size: number;
}

/**
 * A message the admin pushes to students and/or teachers. It pops up after
 * login until the user has read it.
 *
 * Read state is kept in AnnouncementRead rather than on this document so the
 * document does not grow with every pupil who reads it.
 */
export interface IAnnouncement extends Document {
  title: string;
  content: string;
  images: IAnnouncementImage[];
  audience: AnnouncementAudience[];
  /** Empty means every subject; otherwise users holding any listed subject. */
  subjects: Subject[];
  active: boolean;
  startAt: Date;
  endAt: Date | null;
  /**
   * When the announcement was last pushed. A read only counts if it happened
   * after this, so moving it forward ("重新推送") makes the pop-up show again
   * without deleting the read history.
   */
  pushedAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementImageSchema = new Schema<IAnnouncementImage>(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    images: { type: [AnnouncementImageSchema], default: [] },
    audience: {
      type: [{ type: String, enum: ANNOUNCEMENT_AUDIENCE_VALUES }],
      required: true,
    },
    subjects: {
      type: [{ type: String, enum: ALL_SUBJECTS }],
      default: [],
    },
    active: { type: Boolean, default: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    pushedAt: { type: Date, required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ active: 1, audience: 1, pushedAt: -1 });
AnnouncementSchema.index({ "images.fileId": 1 });

export const Announcement = defineModel<IAnnouncement>("Announcement", AnnouncementSchema);
