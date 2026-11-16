"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  htmlLang,
  isLocale,
  type CopyTable,
  type Locale,
} from "@/lib/i18n/config";

interface LocaleContextValue {
  /** The language this part of the screen renders in. */
  locale: Locale;
  /**
   * The language the user picked. Equal to `locale` except inside a
   * `LocaleOverride` (e.g. the Chinese Language subject, which is always
   * Chinese); the language switch shows this one.
   */
  preference: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  preference: DEFAULT_LOCALE,
  setLocale: () => {},
});

/**
 * Same-origin channel that tells every other copy of the app about a switch.
 * The math tools (clock, volume, journey, fractions) run in an iframe inside the
 * dashboard with their own provider, and a pupil may have a second tab open;
 * without this they would keep the old language until they reload.
 */
const CHANNEL_NAME = "app-locale";

/**
 * Holds the interface language for client components.
 *
 * `initialLocale` comes from the cookie, read by the root layout on the server,
 * so the first paint is already in the right language (no flash of Chinese).
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Applies a locale on this page: client components switch at once from
  // context; the refresh re-renders Server Components (page headings, chat
  // configs) with the cookie, which is already set by whoever switched.
  const apply = useCallback(
    (next: Locale) => {
      document.documentElement.lang = htmlLang(next);
      setLocaleState(next);
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      if (isLocale(event.data)) apply(event.data);
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [apply]);

  const setLocale = useCallback(
    (next: Locale) => {
      // path=/ to match the session cookie: the AI route handlers read this
      // cookie too, and they live under the same basePath as the pages.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      apply(next);
      // A channel never delivers to its own sender, so this page is not re-applied.
      channelRef.current?.postMessage(next);
    },
    [apply],
  );

  const value = useMemo(() => ({ locale, preference: locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Pins a subtree to one language whatever the user picked, for a subject whose
 * interface is the same in both modes. Shared components inside it (Header,
 * sidebar, topic picker, chat) render in `locale`, while the language switch
 * still shows and changes the user's own choice for the rest of the app.
 *
 * Client-only: Server Components inside the subtree read the cookie through
 * getCopy, so a pinned subject's server pages should not use getCopy.
 */
export function LocaleOverride({ locale, children }: { locale: Locale; children: ReactNode }) {
  const parent = useContext(LocaleContext);
  const value = useMemo(() => ({ ...parent, locale }), [parent, locale]);

  return (
    <LocaleContext.Provider value={value}>
      {/* `lang` for screen readers and fonts; display:contents keeps layout untouched. */}
      <div lang={htmlLang(locale)} style={{ display: "contents" }}>
        {children}
      </div>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Picks the current locale's half of a copy table declared with `defineCopy`. */
export function useCopy<T>(table: CopyTable<T>): T {
  return table[useContext(LocaleContext).locale];
}
