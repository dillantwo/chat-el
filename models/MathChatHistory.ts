import { Schema, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

interface ISavedMessagePart {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

interface ISavedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: ISavedMessagePart[];
}

export type MathChatKind = "general" | "volume-cubes" | "clock-24hrs" | "clock-time-difference";
export type MathDashboardEntryMode = "question" | "ai-tool";

export interface IMathChatHistory extends Document {
  userId: string;
  chatId: string;
  kind: MathChatKind;
  title: string;
  hasUserQuestion?: boolean;
  question?: string;
  type?: string;
  selectedTool?: string | null;
  toolUrl?: string;
  entryMode?: MathDashboardEntryMode;
  messages: ISavedChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const SavedMessagePartSchema = new Schema<ISavedMessagePart>(
  {
    type: { type: String, enum: ["text", "file"], required: true },
    text: { type: String },
    url: { type: String },
    mediaType: { type: String },
    filename: { type: String },
  },
  { _id: false },
);

const SavedChatMessageSchema = new Schema<ISavedChatMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    parts: { type: [SavedMessagePartSchema], default: [] },
  },
  { _id: false },
);

const MathChatHistorySchema = new Schema<IMathChatHistory>(
  {
    userId: { type: String, required: true, index: true },
    chatId: { type: String, required: true },
    kind: { type: String, enum: ["general", "volume-cubes", "clock-24hrs", "clock-time-difference"], required: true },
    title: { type: String, required: true },
    hasUserQuestion: { type: Boolean, default: false },
    question: { type: String },
    type: { type: String },
    selectedTool: { type: String, default: null },
    toolUrl: { type: String },
    entryMode: { type: String, enum: ["question", "ai-tool"] },
    messages: { type: [SavedChatMessageSchema], default: [] },
  },
  { timestamps: true },
);

MathChatHistorySchema.index({ userId: 1, chatId: 1 }, { unique: true });

export const MathChatHistory = defineModel<IMathChatHistory>("MathChatHistory", MathChatHistorySchema);