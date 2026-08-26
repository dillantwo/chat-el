"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import type { Subject } from "@/models/User";

/**
 * 選擇學習科目.
 *
 * Same audience and same visual language as app/login: primary-school pupils,
 * sticker tiles with a 2px black edge and a hard offset shadow on dotted
 * exercise-book paper. A pupil lands here straight from the login card, so the
 * two screens are deliberately the same object family rather than two different
 * design systems bolted together.
 *
 * The numbers follow from the audience, not from taste: every tile is a single
 * tap target well over 100px tall, icons repeat what the labels say because
 * children scan shapes before they read, and no copy drops below 14px.
 */

type SubjectTile = {
  id: Subject;
  label: string;
  labelEn: string;
  /** What is actually inside the subject, in the pupil's words. */
  topics: string[];
  icon: LucideIcon;
  href: string;
  available: boolean;
  /** Sticker colour, matching the decorative row on the login card. */
  accent: string;
  /** Slight rotation so the row looks placed by hand, not laid on a grid. */
  tilt: string;
};

const subjects: SubjectTile[] = [
  {
    id: "math",
    label: "數學科",
    labelEn: "Mathematics",
    topics: ["解題工具", "即時回饋"],
    icon: Calculator,
    href: "/math",
    available: true,
    accent: "#146ef5",
    tilt: "-rotate-6",
  },
  {
    id: "chinese",
    label: "中國語文科",
    labelEn: "Chinese Language",
    topics: ["閱讀理解", "寫作引導", "文言文"],
    icon: BookOpen,
    href: "/chinese",
    available: true,
    accent: "#7a3dff",
    tilt: "rotate-3",
  },
  {
    id: "english",
    label: "英國語文科",
    labelEn: "English Language",
    // The topic titles exactly as /english names them — abbreviating them left a
    // sticker reading "Reading", which is not a topic a pupil can go and find.
    topics: ["Location and Direction", "Thank-you Letter", "Reading Comprehension"],
    icon: Globe,
    href: "/english",
    available: true,
    accent: "#00a81b",
    tilt: "-rotate-2",
  },
  {
    id: "science",
    label: "科學科",
    labelEn: "Science",
    topics: ["電路", "航天科技"],
    icon: FlaskConical,
    href: "/science",
    available: true,
    accent: "#ff6b00",
    tilt: "rotate-6",
  },
  {
    id: "humanities",
    label: "人文科",
    labelEn: "Humanities",
    topics: ["水資源", "抗日戰爭"],
    icon: Landmark,
    href: "/humanities",
    available: true,
    accent: "#ed52cb",
    tilt: "-rotate-3",
  },
];

/** Dotted practice-paper texture, shared with the login card. */
const DOTTED_PAPER: React.CSSProperties = {
  backgroundImage: "radial-gradient(rgba(8,8,8,0.11) 1.5px, transparent 1.5px)",
  backgroundSize: "22px 22px",
};

/** One tap target per subject: a pressable card, so the whole tile is the button.
 *
 *  `h-full` plus `auto-rows-fr` on the grid keeps every tile the same size no
 *  matter how many topic stickers it carries — English wraps onto a second row
 *  and would otherwise stand taller than its neighbours. */
const TILE_BASE =
  "group relative flex h-full min-h-[184px] flex-col rounded-[18px] border-2 p-5 text-left sm:min-h-[204px] sm:p-6";

/** Equal-height rows, so all five subjects read as one set of identical cards. */
const TILE_GRID = "grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const userSubjects = user?.subjects ?? [];

  // Only the subjects the user's school has opened for them are shown at all.
  // `subjects` comes from /api/auth/me, which resolves it from the database, so
  // a subject revoked in 學校管理 disappears on the next load.
  const visibleSubjects = subjects.filter(({ id }) => userSubjects.includes(id));

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return (
    <>
      <Header />

      {/* app/layout.tsx puts `overflow-hidden` on <body>, so this page owns its
          own scrolling. The texture is fixed behind it and never scrolls. */}
      <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[#fdf6e9] text-[#080808]">
        <div aria-hidden className="pointer-events-none fixed inset-0" style={DOTTED_PAPER} />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
          {/* ── Greeting ─────────────────────────────────────────────────── */}
          <section>
            <h1 className="text-[30px] leading-[1.15] font-bold tracking-[-0.01em] sm:text-[38px]">
              今天想學哪一科？
            </h1>
            {/* Hand-drawn-looking rule instead of a hairline: it belongs to the
                heading and reads as a marker stroke a child recognises. */}
            <span aria-hidden className="mt-3 block h-[6px] w-24 rounded-full bg-[#ffae13]" />
            <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#4d4d4d]">
              按下面的卡片，就可以進入那一科的練習和學習材料。
            </p>
          </section>

          {/* ── Teacher entry ───────────────────────────────────────────────
              Teachers review student records here rather than inside each topic. */}
          {!loading && user?.role === "teacher" && (
            <section className="mt-7">
              <Link
                href="/teacher/student-data"
                className="group flex items-center gap-4 rounded-[16px] border-2 border-[#080808] bg-white p-4 shadow-[6px_6px_0px_#080808] transition-all hover:-translate-y-[2px] hover:shadow-[8px_8px_0px_#080808] active:translate-y-[1px] active:shadow-[3px_3px_0px_#080808] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#146ef5] sm:p-5"
              >
                <span
                  aria-hidden
                  className="flex size-14 shrink-0 items-center justify-center rounded-[12px] border-2 border-[#080808] bg-[#ffae13] text-[#080808] shadow-[3px_3px_0px_#080808] rotate-3"
                >
                  <BarChart3 className="size-6" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-[#5a5a5a]">教師專區</span>
                  <span className="block text-[21px] font-bold leading-[1.2] sm:text-[23px]">
                    查看學生數據
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-6 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  strokeWidth={2.5}
                />
              </Link>
            </section>
          )}

          {/* ── Subject tiles ────────────────────────────────────────────── */}
          <section className="mt-7 pb-4 sm:mt-9">
            {loading ? (
              <ul className={TILE_GRID}>
                {subjects.map(({ id }) => (
                  <li key={id}>
                    <div
                      className={`${TILE_BASE} animate-pulse border-[#080808]/15 bg-white/70`}
                      aria-hidden
                    >
                      <div className="size-14 rounded-[12px] bg-[#ece5d5]" />
                      <div className="mt-5 h-7 w-32 rounded-[6px] bg-[#ece5d5]" />
                      <div className="mt-3 h-4 w-24 rounded-[6px] bg-[#f2ece0]" />
                      <div className="mt-auto h-12 rounded-[12px] bg-[#f2ece0]" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : visibleSubjects.length === 0 ? (
              <div className="rounded-[18px] border-2 border-dashed border-[#080808]/35 bg-white/70 p-6 sm:p-8">
                <h2 className="text-[24px] font-bold leading-[1.2] sm:text-[26px]">
                  還沒有開通任何科目
                </h2>
                <p className="mt-3 max-w-lg text-[16px] leading-7 text-[#4d4d4d]">
                  你的帳戶現在沒有可以進入的科目。請告訴老師或管理員，幫你開通權限。
                </p>
              </div>
            ) : (
              <ul className={TILE_GRID}>
                {visibleSubjects.map(
                  ({ id, label, labelEn, topics, icon: Icon, href, available, accent, tilt }) => {
                    const inner = (
                      <>
                        <span className="flex items-start justify-between gap-3">
                          <span
                            aria-hidden
                            className={[
                              "flex size-14 items-center justify-center rounded-[12px] border-2 border-[#080808] text-white shadow-[3px_3px_0px_#080808] transition-transform duration-200",
                              tilt,
                              available ? "group-hover:rotate-0" : "opacity-60",
                            ].join(" ")}
                            style={{ backgroundColor: accent }}
                          >
                            <Icon className="size-7" strokeWidth={2.5} />
                          </span>
                          {!available && (
                            <span className="rounded-full border-2 border-[#080808]/25 bg-white px-3 py-1 text-[14px] font-semibold text-[#5a5a5a]">
                              準備中
                            </span>
                          )}
                        </span>

                        <span className="mt-4 block">
                          <span
                            className={[
                              "block text-[25px] font-bold leading-[1.2] tracking-[-0.01em] sm:text-[27px]",
                              available ? "text-[#080808]" : "text-[#080808]/45",
                            ].join(" ")}
                          >
                            {label}
                          </span>
                          <span className="mt-1 block text-[14px] font-medium text-[#767676]">
                            {labelEn}
                          </span>
                        </span>

                        {/* The topics as small stickers: a pupil can see what is
                            inside before committing to a tap. This is the row
                            that absorbs the spare height, so the 開始學習 bar
                            lines up across every card. */}
                        <span className="mt-3 flex flex-1 flex-wrap content-start gap-2">
                          {topics.map((topic) => (
                            <span
                              key={topic}
                              // nowrap so a long title breaks the row, never the
                              // pill: a sticker split over two lines stops
                              // looking like one label.
                              className="whitespace-nowrap rounded-full border-2 border-[#080808]/12 bg-[#faf6ee] px-3 py-1 text-[14px] font-medium text-[#4d4d4d]"
                            >
                              {topic}
                            </span>
                          ))}
                        </span>

                        {/* 48px tall and full width: on a phone this is the part
                            a child aims at, even though the whole tile works. */}
                        <span
                          className={[
                            "mt-5 flex h-12 items-center justify-between gap-2 rounded-[12px] border-2 px-4 text-[16px] font-bold",
                            available
                              ? "border-[#080808] text-white"
                              : "border-[#080808]/20 bg-white text-[#8a8a8a]",
                          ].join(" ")}
                          style={available ? { backgroundColor: accent } : undefined}
                        >
                          {available ? "開始學習" : "還未開放"}
                          {available && (
                            <ArrowRight
                              aria-hidden
                              className="size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                              strokeWidth={2.75}
                            />
                          )}
                        </span>
                      </>
                    );

                    return (
                      <li key={id}>
                        {available ? (
                          <Link
                            href={href}
                            className={`${TILE_BASE} border-[#080808] bg-white shadow-[6px_6px_0px_#080808] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[9px_9px_0px_#080808] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0px_#080808] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#146ef5]`}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div
                            aria-disabled
                            className={`${TILE_BASE} cursor-not-allowed border-[#080808]/25 bg-white/60`}
                          >
                            {inner}
                          </div>
                        )}
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
