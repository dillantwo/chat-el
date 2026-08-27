import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Return the configured basePath (e.g. "/aitools") or "" when unset. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Strip `$\text{...}$` wrappers so Chinese text renders as plain wrappable
 * text. KaTeX keeps `\text{}` on one line, which overflows a narrow chat
 * bubble; the content inside it is prose, not maths.
 */
export function stripTextModeLatex(text: string): string {
  // Handles one level of nested braces.
  return text.replace(/\$\\text\{((?:[^{}]|\{[^{}]*\})*)\}\$/g, "$1");
}
