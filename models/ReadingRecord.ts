import { Schema, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export interface IReadingAnswer {
  questionId: number;
  questionText: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
}

export interface IReadingRecord extends Document {
  userId: string;
  /** Stable identifier for the reading, e.g. "cycle-2-reading-2". */
  readingId: string;
  title: string;
  score: number;
  total: number;
  completed: boolean;
  answers: IReadingAnswer[];
  /** Where the student last was, so we can resume them (e.g. "part2"). */
  section: string;
  /** Per-part question index the student had reached, e.g. { part1: 0, part2: 2 }. */
  step: Record<string, number>;
  /** Ids of the reading skills the student ticked off in the summary. */
  skills: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReadingAnswerSchema = new Schema<IReadingAnswer>(
  {
    questionId: { type: Number, required: true },
    questionText: { type: String, default: "" },
    selected: { type: String, default: "" },
    correct: { type: String, default: "" },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false },
);

const ReadingRecordSchema = new Schema<IReadingRecord>(
  {
    userId: { type: String, required: true, index: true },
    readingId: { type: String, required: true },
    title: { type: String, required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    answers: { type: [ReadingAnswerSchema], default: [] },
    section: { type: String, default: "" },
    step: { type: Schema.Types.Mixed, default: {} },
    skills: { type: [String], default: [] },
  },
  { timestamps: true },
);

// One record per student per reading (latest attempt is upserted).
ReadingRecordSchema.index({ userId: 1, readingId: 1 }, { unique: true });

export const ReadingRecord = defineModel<IReadingRecord>("ReadingRecord", ReadingRecordSchema);
