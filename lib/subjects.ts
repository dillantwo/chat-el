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

/**
 * One accent colour per subject, matching the sticker colours on the pupil-facing
 * subject tiles in app/page.tsx. Kept here so the admin area labels a subject
 * with the same colour a pupil sees on the tile they tap.
 *
 * Hex rather than a Tailwind class name on purpose: these are consumed as inline
 * `color` / `background-color` with an alpha suffix, which a utility class can't
 * express for an arbitrary palette.
 */
export const SUBJECT_ACCENTS: Record<string, string> = {
  math: "#146ef5",
  chinese: "#7a3dff",
  english: "#00a81b",
  science: "#ff6b00",
  humanities: "#ed52cb",
};

/** Fallback for a subject value that is no longer in SUBJECTS. */
export const FALLBACK_ACCENT = "#64748b";

/**
 * Reverse lookup, because not every caller has the key.
 * lib/token-usage-query.ts resolves subjects to labels before they reach the
 * client, so the usage tables only ever hold "數學科", never "math".
 */
const SUBJECT_KEY_BY_LABEL: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.label, s.value])
);

/** Accepts either a subject key ("math") or its label ("數學科"). */
export function subjectAccent(subject: string): string {
  return (
    SUBJECT_ACCENTS[subject] ??
    SUBJECT_ACCENTS[SUBJECT_KEY_BY_LABEL[subject] ?? ""] ??
    FALLBACK_ACCENT
  );
}
