"use client";

import { useCopy, useLocale } from "@/components/LocaleProvider";
import { COMMON_COPY } from "@/lib/i18n/common";
import type { Locale } from "@/lib/i18n/config";

/** Each option is labelled in its own language, so a user who can't read the current one can still find theirs. */
const OPTIONS: { value: Locale; label: string; lang: string }[] = [
  { value: "zh-Hant", label: "中", lang: "zh-Hant" },
  { value: "en", label: "EN", lang: "en" },
];

/**
 * Two-way 中 / EN toggle. A segmented control rather than a dropdown: there are
 * only two choices, and both stay visible so it reads as a setting, not a menu.
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  // `preference`, not `locale`: on a subject pinned to one language the switch
  // must still show (and change) what the user chose for the rest of the app.
  const { preference: locale, setLocale } = useLocale();
  const copy = useCopy(COMMON_COPY);

  return (
    <div
      role="group"
      aria-label={copy.languageSwitch}
      title={copy.languageSwitch}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 text-xs ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={active}
            onClick={() => {
              if (!active) setLocale(option.value);
            }}
            className={[
              "rounded-md px-2 py-1 font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
