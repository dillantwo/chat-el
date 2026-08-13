import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Return the configured basePath (e.g. "/aitools") or "" when unset. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
