import { Schema, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface IChatSession extends Document {
  question: string;
  type: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    imageUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    question: { type: String, required: true },
    type: { type: String, required: true, index: true },
    messages: [ChatMessageSchema],
  },
  { timestamps: true }
);

export const ChatSession = defineModel<IChatSession>("ChatSession", ChatSessionSchema);
