import "server-only";

import type { Locale } from "./config";
import { getLocale } from "./server";

/**
 * How a route's output relates to language, which decides what the English
 * override is allowed to touch.
 *
 * - "chat": free-text replies (math, science, humanities). Everything in English.
 * - "structured": generateObject / streamObject output. Only the free-text
 *   fields a person reads switch; keys, enums and data stay as the schema says.
 *
 * Not used by the Chinese Language subject (always Chinese) or the English
 * Language subject (always English): their routes keep their own prompts.
 */
export type ReplyLanguageKind = "chat" | "structured";

const HEADER = `## Reply language: English (OVERRIDES every earlier language rule)
The user has set the app interface to English.`;

const CHAT = `Always reply in English, even if the user writes in Chinese, and even where earlier instructions say to reply in Traditional Chinese or to match the user's language. Keep every other rule above unchanged: the same teaching approach, tone, length limits, reading level and formatting (Markdown, LaTeX, emoji). When you use facts or wording from Chinese reference material, translate them into simple English and keep the facts exactly the same.`;

const STRUCTURED = `Write every free-text field that a person will read (feedback, comments, summaries, analyses, titles, descriptions, explanations) in English, even where the schema descriptions or earlier instructions say Traditional Chinese. Keep enum values, numbers, keys and any field that must copy the input word for word exactly as the schema requires.`;

const DIRECTIVES: Record<ReplyLanguageKind, string> = {
  chat: `${HEADER}\n${CHAT}`,
  structured: `${HEADER}\n${STRUCTURED}`,
};

/**
 * The instruction to append to a system prompt for this locale, or "" for
 * Chinese (every prompt is already written for Chinese, so nothing changes).
 * Appended at the very end so it is the last word on language.
 */
export function replyLanguageDirective(locale: Locale, kind: ReplyLanguageKind): string {
  return locale === "en" ? DIRECTIVES[kind] : "";
}

/** Appends the reply-language directive for `locale` to `system`. */
export function applyReplyLanguage(system: string, locale: Locale, kind: ReplyLanguageKind): string {
  const directive = replyLanguageDirective(locale, kind);
  return directive ? `${system}\n\n${directive}` : system;
}

/**
 * Same as `applyReplyLanguage`, reading the locale from the request's cookie.
 * Route handlers are same-origin fetches, so the cookie arrives with every call.
 */
export async function withReplyLanguage(system: string, kind: ReplyLanguageKind): Promise<string> {
  return applyReplyLanguage(system, await getLocale(), kind);
}
