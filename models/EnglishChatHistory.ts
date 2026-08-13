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

export interface IEnglishChatHistory extends Document {
  userId: string;
  chatId: string;
  title: string;
  topic: string;
  selectedTask?: number | null;
  studentRole?: string | null;
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

const EnglishChatHistorySchema = new Schema<IEnglishChatHistory>(
  {
    userId: { type: String, required: true, index: true },
    chatId: { type: String, required: true },
    title: { type: String, required: true },
    topic: { type: String, required: true },
    selectedTask: { type: Number, default: null },
    studentRole: { type: String, default: null },
    messages: { type: [SavedChatMessageSchema], default: [] },
  },
  { timestamps: true },
);

EnglishChatHistorySchema.index({ userId: 1, chatId: 1 }, { unique: true });

export const EnglishChatHistory = defineModel<IEnglishChatHistory>("EnglishChatHistory", EnglishChatHistorySchema);
