// Client-safe subject constants. Do NOT import models/User here — that pulls
// mongoose into client bundles. Keep this list in sync with models/User.ts.
export const SUBJECTS = [
  { value: "math", label: "數學科" },
  { value: "chinese", label: "中國語文科" },
  { value: "english", label: "English Language" },
  { value: "science", label: "科學科" },
  { value: "humanities", label: "人文科" },
] as const;

export type SubjectValue = (typeof SUBJECTS)[number]["value"];

export const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.value, s.label])
);

export const ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  teacher: "老師",
  student: "學生",
};
