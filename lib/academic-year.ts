// Client-safe academic-year helpers. Used for the default value of a new
// class and for validating what the admin types in.

/**
 * The academic year containing `now`, formatted "2025-2026".
 * Hong Kong school years start in September.
 */
export function currentAcademicYear(now: Date = new Date()): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

const ACADEMIC_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

/** True for a "YYYY-YYYY" string whose second year follows the first. */
export function isValidAcademicYear(value: string): boolean {
  const match = ACADEMIC_YEAR_PATTERN.exec(value.trim());
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}
