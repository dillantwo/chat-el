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
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BellOff,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCopy, useLocale } from "@/components/LocaleProvider";
import AnnouncementContent from "@/components/AnnouncementContent";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { defineCopy, intlLocale } from "@/lib/i18n/config";
import type { UserAnnouncementDTO } from "@/lib/announcements";
import { basePath, cn } from "@/lib/utils";

const COPY = defineCopy({
  "zh-Hant": {
    latest: "最新公告",
    center: "公告",
    empty: "暫時沒有公告",
    emptyHint: "有新消息時，會在這裏通知你。",
    prev: "上一則",
    next: "下一則",
    done: "知道了",
    backToList: "返回列表",
    unread: "新",
    close: "關閉",
    unreadCount: (n: number) => `${n} 則未讀`,
    goTo: (n: number) => `第 ${n} 則`,
  },
  en: {
    latest: "New announcement",
    center: "Announcements",
    empty: "No announcements yet",
    emptyHint: "New messages will show up here.",
    prev: "Previous",
    next: "Next",
    done: "Got it",
    backToList: "All announcements",
    unread: "New",
    close: "Close",
    unreadCount: (n: number) => `${n} unread`,
    goTo: (n: number) => `Announcement ${n}`,
  },
});

// ── Visual language ─────────────────────────────────────────────────────────
// The same sticker family as the home page and login card (app/page.tsx): a 2px
// ink edge, hard offset shadows, paper background and slightly tilted icons.

const MARKER = "#ffae13";

/** The subject sticker colours. Each announcement keeps one, picked from its id. */
const ACCENTS = ["#146ef5", "#7a3dff", "#00a81b", "#ff6b00", "#ed52cb"];

function accentFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

const STICKER_BUTTON =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] border-2 border-[#080808] px-4 text-[15px] font-bold shadow-[3px_3px_0px_#080808] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_#080808] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#080808] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5] disabled:pointer-events-none disabled:opacity-35";

// ── Context ─────────────────────────────────────────────────────────────────

interface AnnouncementContextValue {
  /** False for admins and signed-out visitors: they have no 公告. */
  enabled: boolean;
  unreadCount: number;
  openCenter: () => void;
}

const AnnouncementContext = createContext<AnnouncementContextValue>({
  enabled: false,
  unreadCount: 0,
  openCenter: () => {},
});

export function useAnnouncements() {
  return useContext(AnnouncementContext);
}

/** Pages where the login pop-up must not appear. */
function popupAllowed(pathname: string): boolean {
  return !pathname.startsWith("/login") && !pathname.startsWith("/admin");
}

type View =
  | { mode: "popup"; ids: string[]; index: number }
  | { mode: "center"; detailId: string | null };

/**
 * Loads the current user's announcements and owns the one dialog that shows
 * them, in two modes:
 *
 *  - popup:  opened automatically after sign-in when something is unread, and
 *            pages through the unread announcements only;
 *  - center: opened from the 公告 button in Header, lists recent ones.
 *
 * An announcement counts as read once it has been on screen; the receipts are
 * sent when the dialog closes. One the user never paged to stays unread and
 * pops up again next time.
 */
export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const copy = useCopy(COPY);
  const { locale } = useLocale();

  const userKey = user && user.role !== "admin" ? user.username : null;

  // Tagged with the user it was loaded for, so a previous account's list is
  // never shown while the next account's request is still in flight.
  const [loaded, setLoaded] = useState<{ owner: string; items: UserAnnouncementDTO[]; at: number } | null>(null);
  const items = useMemo(
    () => (loaded && loaded.owner === userKey ? loaded.items : []),
    [loaded, userKey],
  );
  const loadedAt = loaded && loaded.owner === userKey ? loaded.at : 0;

  // `view` outlives `open` so the dialog keeps its content while it fades out.
  const [view, setView] = useState<View>({ mode: "center", detailId: null });
  const [open, setOpen] = useState(false);
  const viewed = useRef(new Set<string>());
  const popupPending = useRef(false);

  const show = useCallback((next: View) => {
    setView(next);
    setOpen(true);
  }, []);

  // Fetch once per signed-in user. Navigation does not refetch.
  useEffect(() => {
    // A new account must not inherit a dialog left open by the previous one.
    setOpen(false);
    viewed.current.clear();
    popupPending.current = false;
    if (!userKey) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/announcements`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        popupPending.current = true;
        setLoaded({
          owner: userKey,
          items: Array.isArray(data.announcements) ? data.announcements : [],
          at: Date.now(),
        });
      } catch {
        // No announcements is a fine fallback; never block the page on this.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  // Separate from the fetch because sign-in sets the user while still on
  // /login: the pop-up waits until the user has landed on a real page.
  useEffect(() => {
    if (!popupPending.current || !loadedAt || !popupAllowed(pathname)) return;
    popupPending.current = false;
    const unread = items.filter((a) => a.unread).map((a) => a.id);
    if (unread.length > 0) show({ mode: "popup", ids: unread, index: 0 });
  }, [loadedAt, pathname, items, show]);

  // Whatever is on screen counts as seen.
  useEffect(() => {
    if (!open) return;
    if (view.mode === "popup") viewed.current.add(view.ids[view.index]);
    if (view.mode === "center" && view.detailId) viewed.current.add(view.detailId);
  }, [open, view]);

  const close = useCallback(() => {
    setOpen(false);
    const seen = viewed.current;
    viewed.current = new Set();
    const ids = items.filter((a) => a.unread && seen.has(a.id)).map((a) => a.id);
    if (ids.length === 0) return;

    setLoaded((prev) =>
      prev && {
        ...prev,
        items: prev.items.map((a) => (seen.has(a.id) ? { ...a, unread: false } : a)),
      },
    );
    fetch(`${basePath}/api/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {
      // A lost receipt only means the pop-up shows once more.
    });
  }, [items]);

  const openCenter = useCallback(() => show({ mode: "center", detailId: null }), [show]);

  const unreadCount = useMemo(() => items.filter((a) => a.unread).length, [items]);
  const byId = useMemo(() => new Map(items.map((a) => [a.id, a])), [items]);

  const formatters = useMemo(() => {
    const tag = intlLocale(locale);
    const long = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" });
    const short = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric" });
    return {
      long: (iso: string) => long.format(new Date(iso)),
      short: (iso: string) => short.format(new Date(iso)),
    };
  }, [locale]);

  const contextValue = useMemo(
    () => ({ enabled: Boolean(userKey), unreadCount, openCenter }),
    [userKey, unreadCount, openCenter],
  );

  const popupItem = view.mode === "popup" ? byId.get(view.ids[view.index]) : undefined;
  const detailItem = view.mode === "center" && view.detailId ? byId.get(view.detailId) : undefined;

  let body: ReactNode;
  if (view.mode === "popup" && popupItem) {
    const accent = accentFor(popupItem.id);
    const isLast = view.index >= view.ids.length - 1;
    body = (
      <>
        <Banner
          icon={Megaphone}
          accent={accent}
          label={copy.latest}
          closeLabel={copy.close}
          onClose={close}
          extra={
            view.ids.length > 1 && (
              <span className="rounded-full border-2 border-[#080808] bg-white px-2.5 py-0.5 text-[13px] font-bold tabular-nums">
                {view.index + 1} / {view.ids.length}
              </span>
            )
          }
        />
        {/* key: restart the entrance animation on every page turn. */}
        <Article key={popupItem.id} item={popupItem} accent={accent} date={formatters.long(popupItem.pushedAt)} />
        <footer className="flex items-center justify-between gap-3 border-t-2 border-[#080808]/10 px-5 py-4 sm:px-6">
          {view.ids.length > 1 ? (
            <div className="flex items-center gap-1.5">
              {view.ids.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  aria-label={copy.goTo(i + 1)}
                  aria-current={i === view.index ? "step" : undefined}
                  onClick={() => setView({ ...view, index: i })}
                  className={cn(
                    "h-3 rounded-full border-2 border-[#080808] transition-all duration-200",
                    i === view.index ? "w-8" : "w-3 bg-white hover:bg-[#ece5d5]",
                  )}
                  style={i === view.index ? { backgroundColor: accent } : undefined}
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {view.ids.length > 1 && (
              <button
                type="button"
                disabled={view.index === 0}
                onClick={() => setView({ ...view, index: view.index - 1 })}
                className={cn(STICKER_BUTTON, "bg-white px-3 text-[#080808]")}
                aria-label={copy.prev}
              >
                <ChevronLeft className="size-5" strokeWidth={2.75} />
                <span className="hidden sm:inline">{copy.prev}</span>
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? close : () => setView({ ...view, index: view.index + 1 })}
              className={cn(STICKER_BUTTON, "min-w-28 text-white")}
              style={{ backgroundColor: accent }}
            >
              {isLast ? (
                <>
                  <Check className="size-5" strokeWidth={3} />
                  {copy.done}
                </>
              ) : (
                <>
                  {copy.next}
                  <ArrowRight className="size-5" strokeWidth={2.75} />
                </>
              )}
            </button>
          </div>
        </footer>
      </>
    );
  } else if (view.mode === "center" && detailItem) {
    const accent = accentFor(detailItem.id);
    body = (
      <>
        <Banner icon={Bell} accent={accent} label={copy.center} closeLabel={copy.close} onClose={close} />
        <Article key={detailItem.id} item={detailItem} accent={accent} date={formatters.long(detailItem.pushedAt)} />
        <footer className="flex items-center border-t-2 border-[#080808]/10 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => setView({ mode: "center", detailId: null })}
            className={cn(STICKER_BUTTON, "bg-white text-[#080808]")}
          >
            <ChevronLeft className="size-5" strokeWidth={2.75} />
            {copy.backToList}
          </button>
        </footer>
      </>
    );
  } else {
    body = (
      <>
        <Banner
          icon={Bell}
          accent="#146ef5"
          label={copy.center}
          closeLabel={copy.close}
          onClose={close}
          title
          extra={
            unreadCount > 0 && (
              <span className="rounded-full border-2 border-[#080808] bg-[#ff3b30] px-2.5 py-0.5 text-[13px] font-bold text-white">
                {copy.unreadCount(unreadCount)}
              </span>
            )
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center rounded-[16px] border-2 border-dashed border-[#080808]/30 bg-white/70 px-6 py-10 text-center">
              <span className="flex size-14 rotate-6 items-center justify-center rounded-[14px] border-2 border-[#080808] bg-white shadow-[3px_3px_0px_#080808]">
                <BellOff className="size-6 text-[#8a8a8a]" strokeWidth={2.5} />
              </span>
              <p className="mt-4 text-[18px] font-bold">{copy.empty}</p>
              <p className="mt-1 text-[14px] text-[#6b6b6b]">{copy.emptyHint}</p>
            </div>
          ) : (
            <ul className="space-y-3 pb-1 pr-1">
              {items.map((a, i) => {
                const accent = accentFor(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setView({ mode: "center", detailId: a.id })}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-[14px] border-2 bg-white p-3 text-left transition-all duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5] sm:p-3.5",
                        a.unread
                          ? "border-[#080808] shadow-[3px_3px_0px_#080808] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_#080808]"
                          : "border-[#080808]/15 hover:-translate-y-[1px] hover:border-[#080808]/50",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-[11px] border-2 border-[#080808] text-white transition-transform duration-200 group-hover:rotate-0",
                          i % 2 === 0 ? "-rotate-3" : "rotate-3",
                          !a.unread && "opacity-55",
                        )}
                        style={{ backgroundColor: accent }}
                      >
                        <Megaphone className="size-5" strokeWidth={2.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-[16px] leading-6",
                              a.unread ? "font-bold text-[#080808]" : "font-semibold text-[#4d4d4d]",
                            )}
                          >
                            {a.title}
                          </span>
                          {a.unread && (
                            <span className="shrink-0 rounded-full border-2 border-[#080808] bg-[#ff3b30] px-1.5 text-[11px] font-bold leading-[16px] text-white">
                              {copy.unread}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-[#767676]">
                          {a.content || formatters.long(a.pushedAt)}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-[12px] font-medium text-[#8a8a8a] sm:block">
                        {formatters.short(a.pushedAt)}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="size-5 shrink-0 text-[#080808] transition-transform duration-200 group-hover:translate-x-0.5"
                        strokeWidth={2.5}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    );
  }

  return (
    <AnnouncementContext.Provider value={contextValue}>
      {children}

      <Dialog open={open && Boolean(userKey)} onOpenChange={(next) => !next && close()}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-[22px] border-2 border-[#080808] bg-[#fdf6e9] p-0 text-[#080808] shadow-[8px_8px_0px_#080808] sm:max-w-xl"
        >
          {body}
        </DialogContent>
      </Dialog>
    </AnnouncementContext.Provider>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/**
 * The marker-yellow strip across the top of the dialog. Striped so it reads as
 * a label stuck onto the card rather than a flat toolbar.
 */
function Banner({
  icon: Icon,
  accent,
  label,
  extra,
  closeLabel,
  onClose,
  title = false,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  extra?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  /** Render the label as the dialog title (the list view has no other title). */
  title?: boolean;
}) {
  const labelClass = "text-[17px] font-bold leading-tight text-[#080808]";
  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b-2 border-[#080808] px-5 py-3.5 sm:px-6"
      style={{
        backgroundColor: MARKER,
        backgroundImage:
          "repeating-linear-gradient(-45deg, rgba(255,255,255,0.22) 0 10px, transparent 10px 20px)",
      }}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 -rotate-6 items-center justify-center rounded-[12px] border-2 border-[#080808] bg-white shadow-[3px_3px_0px_#080808] motion-safe:animate-[announcement-wiggle_0.9s_ease-in-out_0.25s_1]"
      >
        <Icon className="size-5" style={{ color: accent }} strokeWidth={2.75} />
      </span>
      {title ? (
        <DialogTitle className={labelClass}>{label}</DialogTitle>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {extra}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[#080808] bg-white shadow-[2px_2px_0px_#080808] transition-all hover:-translate-y-[1px] hover:rotate-90 active:translate-y-[1px] active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5]"
      >
        <X className="size-4" strokeWidth={3} />
      </button>
    </div>
  );
}

/** Title, marker stroke, date sticker and the body, in the scrolling middle. */
function Article({ item, accent, date }: { item: UserAnnouncementDTO; accent: string; date: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 motion-safe:animate-[announcement-enter_0.3s_ease-out] sm:px-6">
      <DialogTitle className="text-[23px] font-bold leading-[1.25] tracking-[-0.01em] text-[#080808] sm:text-[26px]">
        {item.title}
      </DialogTitle>
      <span aria-hidden className="mt-2.5 block h-[6px] w-20 rounded-full" style={{ backgroundColor: accent }} />
      <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border-2 border-[#080808]/12 bg-white px-3 py-1 text-[13px] font-medium text-[#5a5a5a]">
        <CalendarDays className="size-3.5" strokeWidth={2.5} />
        {date}
      </p>
      <AnnouncementContent className="mt-4" content={item.content} images={item.images} />
    </div>
  );
}
