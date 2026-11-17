// Client-safe constants and DTO types for 提示詞 (teacher-written prompts).
// Do NOT import models here — that would pull mongoose into client bundles.

/** Topic key in lib/topics.ts. Every subject has one, switched in 學校管理. */
export const PROMPT_TOPIC = "prompts";

export const MAX_PROMPT_TITLE_LENGTH = 100;
/** Characters in one copyable text item. */
export const MAX_PROMPT_ITEM_LENGTH = 5000;
/** Copyable text items in one prompt. */
export const MAX_PROMPT_ITEMS = 20;
export const MAX_PROMPT_IMAGES = 6;
export const MAX_PROMPT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROMPT_IMAGE_LABEL = "5MB";

/**
 * Formats the server accepts. SVG is left out on purpose: it can carry script,
 * and these files are served back inline from our own origin.
 */
export const PROMPT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Value for the `<input type="file" accept>` attribute. */
export const PROMPT_IMAGE_ACCEPT = PROMPT_IMAGE_TYPES.join(",");

/** URL path (without basePath) that serves one prompt image. */
export function promptImagePath(imageId: string): string {
  return `/api/prompts/images/${imageId}`;
}

export interface PromptImageDTO {
  id: string;
  contentType: string;
  size: number;
}

export interface PromptDTO {
  id: string;
  title: string;
  /** The copyable texts, in order. Each one has its own copy button. */
  items: string[];
  images: PromptImageDTO[];
  /** false = 草稿, only the author sees it. */
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptClassDTO {
  id: string;
  name: string;
  academicYear: string;
}

/** GET /api/prompts for the author. */
export interface TeacherPromptsResponse {
  role: "teacher";
  prompts: PromptDTO[];
  /** Every class the teacher teaches, for the 班別 picker. */
  classes: PromptClassDTO[];
  /** The classes whose students see this teacher's published prompts. */
  visibleClassIds: string[];
  /** false = no choice saved yet, so every class the teacher teaches. */
  classesCustomized: boolean;
}

export interface PromptGroupDTO {
  teacherId: string;
  teacherName: string;
  /** Admins only: which school the teacher belongs to. */
  schoolName?: string;
  prompts: PromptDTO[];
}

/** GET /api/prompts for students (and the read-only admin view). */
export interface ViewerPromptsResponse {
  role: "student" | "admin";
  groups: PromptGroupDTO[];
}

export type PromptsResponse = TeacherPromptsResponse | ViewerPromptsResponse;
