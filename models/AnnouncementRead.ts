import { Schema, Types, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

/**
 * One user's read receipt for one announcement. `readAt` is compared with the
 * announcement's `pushedAt`, so a repush makes an old receipt stale without
 * deleting it.
 */
export interface IAnnouncementRead extends Document {
  user: Types.ObjectId;
  announcement: Types.ObjectId;
  readAt: Date;
}

const AnnouncementReadSchema = new Schema<IAnnouncementRead>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  announcement: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
  readAt: { type: Date, required: true },
});

AnnouncementReadSchema.index({ user: 1, announcement: 1 }, { unique: true });
// Read counts on the admin page.
AnnouncementReadSchema.index({ announcement: 1, readAt: 1 });

export const AnnouncementRead = defineModel<IAnnouncementRead>(
  "AnnouncementRead",
  AnnouncementReadSchema,
);
