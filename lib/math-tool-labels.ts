// Client-safe display names for the math toolbox in the English interface.
//
// Tool and group names live in the database (ToolboxConfig, seeded by
// scripts/seed-toolbox.ts and edited in the admin 工具箱 page) and are Chinese.
// `sub` is English but technical ("FractionApp (Addition)"), so it can't be
// shown as the name. This maps the stable keys to English names instead; the
// stored labels are untouched, and the Chinese interface shows them as before.
//
// The names match the titles on the tool pages themselves (app/math/fraction-*
// etc.), so the sidebar entry and the tool it opens read the same.
import type { Locale } from "@/lib/i18n/config";

/** By tool `key`. */
const TOOL_NAMES_EN: Record<string, string> = {
  "fraction-addition": "Addition of Fractions",
  "fraction-subtraction": "Subtraction of Fractions",
  "fraction-multiplication": "Multiplication of Fractions",
  "fraction-division": "Division of Fractions",
  "fraction-comparison": "Compare Magnitude of Fractions",
  "fraction-expanding-simplifying": "Equivalent Fractions",
  "fraction-converting": "Conversion between Whole Numbers and Fractions",
  "fraction-integer": "Fractional Parts of a Whole Number",
  "clock-24hrs": "24-hour Clock",
  "clock-time-difference": "Time Difference",
  "volume-cubes": "Volume Explorer",
  "journey-graph": "Journey Graph",
};

/** By toolbox group `type` (also the question type the classifier returns). */
const GROUP_NAMES_EN: Record<string, string> = {
  "fraction-operations": "Fraction Operations",
  "fraction-concept": "Fraction Concepts",
  clock: "Clock",
  volume: "Volume",
  journey: "Journey Graph",
  other: "Other",
};

/**
 * Some stored labels already carry an English name after the Chinese one
 * ("時鐘 Clock", "行程圖 Journey Graph"). For a tool or group an admin added
 * later, that English part is the best fallback there is.
 */
function englishPart(label: string): string | null {
  const match = label.match(/[A-Za-z][A-Za-z0-9 &()'\-/]*$/);
  const english = match?.[0].trim();
  return english && english !== label.trim() ? english : null;
}

/** The name to show for a tool. Chinese interface: the stored label, unchanged. */
export function toolDisplayName(tool: { key: string; label: string }, locale: Locale): string {
  if (locale !== "en") return tool.label;
  return TOOL_NAMES_EN[tool.key] ?? englishPart(tool.label) ?? tool.label;
}

/**
 * The name to show for a toolbox group / question type. `label` is the stored
 * group label, or undefined when the type has no config (the raw type is shown,
 * as before).
 */
export function toolGroupDisplayName(type: string | undefined, label: string | undefined, locale: Locale): string {
  const fallback = label ?? type ?? "";
  if (locale !== "en") return fallback;
  return (type && GROUP_NAMES_EN[type]) ?? englishPart(fallback) ?? fallback;
}
