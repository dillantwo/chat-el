import { Schema, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export interface IEssayDraft extends Document {
  userId: string;
  draftId: string;
  topic: string;
  title: string;
  first: string;
  revised: string;
  final: string;
  createdAt: Date;
  updatedAt: Date;
}

const EssayDraftSchema = new Schema<IEssayDraft>(
  {
    userId: { type: String, required: true, index: true },
    draftId: { type: String, required: true },
    topic: { type: String, required: true },
    title: { type: String, required: true },
    first: { type: String, default: "" },
    revised: { type: String, default: "" },
    final: { type: String, default: "" },
  },
  { timestamps: true },
);

EssayDraftSchema.index({ userId: 1, draftId: 1 }, { unique: true });

export const EssayDraft = defineModel<IEssayDraft>("EssayDraft", EssayDraftSchema);
