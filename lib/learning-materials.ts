// Client-safe learning-material constants. Do NOT import models here — that
// would pull mongoose into client bundles. Keep audiences in sync with
// models/LearningMaterial.ts.

export const MATERIAL_AUDIENCES = [
  { value: "both", label: "老師和學生" },
  { value: "teacher", label: "只限老師" },
  { value: "student", label: "只限學生" },
] as const;

export type MaterialAudienceValue = (typeof MATERIAL_AUDIENCES)[number]["value"];

export const MATERIAL_AUDIENCE_LABELS: Record<string, string> = Object.fromEntries(
  MATERIAL_AUDIENCES.map((a) => [a.value, a.label])
);

/** Human readable file size, e.g. 1.2 MB. */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
