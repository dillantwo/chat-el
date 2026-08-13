import { Schema, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

/**
 * Per-user progress for the 學習文言文 game (學習模式 + 四種挑戰模式).
 * One document per user, keyed by userId, so progress syncs across devices.
 */
export interface IWenyanProgress extends Document {
  userId: string;
  username: string;
  /** Ids of learning texts the student has completed. */
  completedTexts: string[];
  /** Best score (0–100) per challenge mode. */
  bestTranslate: number;
  bestPuzzle: number;
  bestTheme: number;
  bestApplication: number;
  /** Number of times each challenge mode has been played. */
  playsTranslate: number;
  playsPuzzle: number;
  playsTheme: number;
  playsApplication: number;
  /** Earned badge ids. */
  badges: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WenyanProgressSchema = new Schema<IWenyanProgress>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    completedTexts: { type: [String], default: [] },
    bestTranslate: { type: Number, default: 0 },
    bestPuzzle: { type: Number, default: 0 },
    bestTheme: { type: Number, default: 0 },
    bestApplication: { type: Number, default: 0 },
    playsTranslate: { type: Number, default: 0 },
    playsPuzzle: { type: Number, default: 0 },
    playsTheme: { type: Number, default: 0 },
    playsApplication: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const WenyanProgress = defineModel<IWenyanProgress>("WenyanProgress", WenyanProgressSchema);
