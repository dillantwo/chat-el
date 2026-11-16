// Client-safe i18n constants and helpers. No server-only imports here: this file
// is shared by the LocaleProvider (client) and lib/i18n/server.ts.
//
// The interface language is a cookie, not a URL segment. This is a signed-in
// school app with no SEO needs, and prefixing every route with /en would have
// meant moving all of app/ under app/[lang] and rewriting the auth/subject
// checks in proxy.ts.

export const LOCALES = ["zh-Hant", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-Hant";

/** Read by the root layout and by every AI route handler. */
export const LOCALE_COOKIE = "locale";

/** One year: the choice should survive closing the browser on a pupil's own device. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Anything that is not a supported locale (missing, tampered, stale) falls back to Chinese. */
export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Value for `<html lang>`, which also drives the browser's font and hyphenation choices. */
export function htmlLang(locale: Locale): string {
  return locale === "en" ? "en" : "zh-Hant";
}

/** BCP 47 tag for `Intl` / `toLocaleString`. British English, as taught in Hong Kong schools. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-GB" : "zh-HK";
}

/**
 * A bilingual copy table: one object per locale with the same shape.
 *
 * UI strings live next to the component that renders them (the same pattern
 * MaterialsBrowser and SurveyBrowser already used), rather than in one central
 * dictionary, so a page's copy is edited in the page's own file.
 */
export type CopyTable<T> = { "zh-Hant": T; en: T };

/**
 * Declares a copy table. The Chinese half defines the shape; `NoInfer` makes the
 * English half be checked against it, so a missing or misspelt key in `en` is a
 * type error instead of an `undefined` on screen.
 */
export function defineCopy<T>(table: { "zh-Hant": T; en: NoInfer<T> }): CopyTable<T> {
  return table;
}
