import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale, type CopyTable, type Locale } from "./config";

/**
 * The interface language of the current request, from the `locale` cookie.
 * Works in Server Components, Route Handlers and Server Functions. Reading it
 * opts the route into dynamic rendering, which every page here already is
 * (each layout checks subject access against the database).
 */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return resolveLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    // Called outside a request (e.g. a script). Chinese is the platform default.
    return DEFAULT_LOCALE;
  }
}

/** Server-component counterpart of `useCopy`: picks the current locale's half of a copy table. */
export async function getCopy<T>(table: CopyTable<T>): Promise<T> {
  return table[await getLocale()];
}
