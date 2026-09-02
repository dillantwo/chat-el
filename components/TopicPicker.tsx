"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { topicKey } from "@/lib/topics";
import type { SubjectValue } from "@/lib/subjects";

/**
 * The 選課題 screen every subject lands on, in the same sticker-and-hard-shadow
 * language as the login card and the 選科目 grid: a pupil goes login → subject →
 * topic without the surface changing under them.
 *
 * All five subject pages were the same 130-line page with a different data
 * array and a router.push switch, so the layout lives here once and each page
 * supplies only its topics. Links are real `<Link>`s rather than buttons that
 * call router.push, which gives back prefetching, middle-click and the browser's
 * own affordances.
 *
 * Sizing follows the audience (primary school): every card is a single tap
 * target over 200px tall, icons repeat what the labels say, and no copy sits
 * below 14px.
 */

export type TopicCard = {
  /** Must match the key in lib/topics.ts — it is what 學校管理 switches. */
  id: string;
  label: string;
  labelEn: string;
  description: string;
  /** Where the card goes. Keep in step with the topic's `route` in lib/topics.ts. */
  href: string;
  icon: LucideIcon;
  accent: string;
  available?: boolean;
  /** Keeps a topic off every school's grid, regardless of 學校管理. */
  hidden?: boolean;
  /** Overrides the button wording, e.g. for a downloads page. */
  cta?: string;
  /**
   * Which band of the grid the card sits in: 課題 on top, 資源 underneath.
   * Omitted means 課題, so a new activity lands in the right place by default
   * and only download-style cards have to say so.
   */
  group?: "topic" | "resource";
};

type TopicPickerProps = {
  subject: SubjectValue;
  /** Subject名 shown as the page heading. */
  subjectLabel: string;
  subjectLabelEn: string;
  subjectIcon: LucideIcon;
  subjectAccent: string;
  topics: TopicCard[];
  /** One line under the heading. */
  intro?: string;
  defaultCta?: string;
  emptyTitle?: string;
  emptyBody?: string;
  comingSoonLabel?: string;
  /** Wording of the back link in the header. */
  backLabel?: string;
  /** Heading over the 課題 band. */
  topicsSectionLabel?: string;
  /** Heading over the 資源 band. */
  resourcesSectionLabel?: string;
};

/** `h-full` with `auto-rows-fr` below keeps every card identical whatever the
 *  length of its description. */
const CARD_BASE =
  "group relative flex h-full min-h-[236px] flex-col rounded-[18px] border-2 p-5 text-left sm:min-h-[252px] sm:p-6";

const CARD_GRID = "grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3";

/** Rotations cycled over the cards so the grid looks placed by hand. */
const TILTS = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6", "-rotate-3"];

const isResourceCard = (topic: TopicCard) => topic.group === "resource";

/**
 * Divider between the two bands. A real `<h2>` so the split is in the document
 * outline too, not just a visual grouping: a screen-reader user hears which
 * band a card belongs to.
 */
function BandHeading({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="size-4 shrink-0 -rotate-6 rounded-[5px] border-2 border-[#080808]"
        style={{ backgroundColor: accent }}
      />
      <h2 className="shrink-0 text-[22px] font-bold leading-[1.2] tracking-[-0.01em] sm:text-[24px]">
        {label}
      </h2>
      <span aria-hidden className="h-[3px] flex-1 rounded-full bg-[#080808]/15" />
    </div>
  );
}

export default function TopicPicker({
  subject,
  subjectLabel,
  subjectLabelEn,
  subjectIcon: SubjectIcon,
  subjectAccent,
  topics,
  intro = "選一個課題，就可以開始練習。",
  defaultCta = "開始這個課題",
  emptyTitle = "還沒有開放任何課題",
  emptyBody = "這一科現在沒有可以進入的課題。請告訴老師或管理員，幫你開通。",
  comingSoonLabel = "準備中",
  backLabel = "選科目",
  topicsSectionLabel = "課題",
  resourcesSectionLabel = "資源",
}: TopicPickerProps) {
  const { user, loading } = useAuth();

  // `hidden` is a code-level switch that applies to every school; 學校管理
  // closes topics per school. `topics` comes from /api/auth/me, resolved from the
  // database, and each route is guarded server-side as well (see the subject's
  // */layout.tsx), so this filter is presentation only.
  const visibleTopics = topics.filter(
    (t) => !t.hidden && (user?.topics ?? []).includes(topicKey(subject, t.id)),
  );

  // The two bands. A band with nothing in it renders nothing at all — no lone
  // heading over empty space — so a school with only 資源 opened still reads
  // correctly.
  const topicBand = visibleTopics.filter((t) => !isResourceCard(t));
  const resourceBand = visibleTopics.filter(isResourceCard);

  // Skeletons stand in the same two bands, so the headings don't jump into
  // place once /api/auth/me answers.
  const pendingCards = topics.filter((t) => !t.hidden);
  const pendingTopicBand = pendingCards.filter((t) => !isResourceCard(t));
  const pendingResourceBand = pendingCards.filter(isResourceCard);

  /**
   * `index` is the card's position across both bands, not within one, so the
   * hand-placed tilts keep cycling rather than restarting at 資源.
   */
  function renderCard(topic: TopicCard, index: number) {
    const { id, label, labelEn, description, href, icon: Icon, accent, cta } = topic;
    const available = topic.available !== false;
    const tilt = TILTS[index % TILTS.length];

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
            <span className="whitespace-nowrap rounded-full border-2 border-[#080808]/25 bg-white px-3 py-1 text-[14px] font-semibold text-[#5a5a5a]">
              {comingSoonLabel}
            </span>
          )}
        </span>

        <span className="mt-4 block">
          <span
            className={[
              "block text-[23px] font-bold leading-[1.25] tracking-[-0.01em] sm:text-[25px]",
              available ? "text-[#080808]" : "text-[#080808]/45",
            ].join(" ")}
          >
            {label}
          </span>
          <span className="mt-1 block text-[14px] font-medium text-[#767676]">{labelEn}</span>
        </span>

        {/* The row that absorbs the spare height, so the button lines up
            across every card. */}
        <span className="mt-3 block flex-1 text-[15px] leading-7 text-[#4d4d4d]">
          {description}
        </span>

        {/* 48px tall and full width: on a phone this is the part a child aims
            at, even though the whole card works. */}
        <span
          className={[
            "mt-5 flex h-12 items-center justify-between gap-2 rounded-[12px] border-2 px-4 text-[16px] font-bold",
            available ? "border-[#080808] text-white" : "border-[#080808]/20 bg-white text-[#8a8a8a]",
          ].join(" ")}
          style={available ? { backgroundColor: accent } : undefined}
        >
          <span className="truncate">{available ? (cta ?? defaultCta) : comingSoonLabel}</span>
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
            className={`${CARD_BASE} border-[#080808] bg-white shadow-[6px_6px_0px_#080808] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[9px_9px_0px_#080808] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0px_#080808] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#146ef5]`}
          >
            {inner}
          </Link>
        ) : (
          <div
            aria-disabled
            className={`${CARD_BASE} cursor-not-allowed border-[#080808]/25 bg-white/60`}
          >
            {inner}
          </div>
        )}
      </li>
    );
  }

  function renderSkeleton({ id }: TopicCard) {
    return (
      <li key={id}>
        <div className={`${CARD_BASE} animate-pulse border-[#080808]/15 bg-white/70`} aria-hidden>
          <div className="size-14 rounded-[12px] bg-[#ece5d5]" />
          <div className="mt-5 h-7 w-32 rounded-[6px] bg-[#ece5d5]" />
          <div className="mt-3 h-4 w-full rounded-[6px] bg-[#f2ece0]" />
          <div className="mt-2 h-4 w-4/5 rounded-[6px] bg-[#f2ece0]" />
          <div className="mt-auto h-12 rounded-[12px] bg-[#f2ece0]" />
        </div>
      </li>
    );
  }

  return (
    <>
      <Header backHref="/" backLabel={backLabel} />

      {/* app/layout.tsx puts `overflow-hidden` on <body>, so this page owns its
          own scrolling. The background is a flat paper colour — no dot texture,
          so the cards are the only thing competing for attention. */}
      <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[#fdf6e9] text-[#080808]">
        <div className="relative mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
          {/* ── Which subject you are in ─────────────────────────────────── */}
          <section className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-[12px] border-2 border-[#080808] text-white shadow-[3px_3px_0px_#080808] -rotate-3 sm:size-16"
              style={{ backgroundColor: subjectAccent }}
            >
              <SubjectIcon className="size-7 sm:size-8" strokeWidth={2.5} />
            </span>

            <div className="min-w-0">
              <h1 className="text-[30px] leading-[1.15] font-bold tracking-[-0.01em] sm:text-[38px]">
                {subjectLabel}
              </h1>
              {/* Hand-drawn-looking rule in the subject's own colour, instead of
                  a hairline: it belongs to the heading. */}
              <span
                aria-hidden
                className="mt-2 block h-[6px] w-20 rounded-full"
                style={{ backgroundColor: subjectAccent }}
              />
              <p className="mt-3 text-[15px] font-medium text-[#767676]">{subjectLabelEn}</p>
            </div>
          </section>

          <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#4d4d4d]">{intro}</p>

          {/* ── 課題 on top, 資源 underneath ─────────────────────────────── */}
          <section className="mt-7 pb-4 sm:mt-9">
            {loading ? (
              <div className="space-y-9 sm:space-y-11">
                {pendingTopicBand.length > 0 && (
                  <div>
                    <BandHeading label={topicsSectionLabel} accent={subjectAccent} />
                    <ul className={`${CARD_GRID} mt-5`}>
                      {pendingTopicBand.map((topic) => renderSkeleton(topic))}
                    </ul>
                  </div>
                )}
                {pendingResourceBand.length > 0 && (
                  <div>
                    <BandHeading label={resourcesSectionLabel} accent={subjectAccent} />
                    <ul className={`${CARD_GRID} mt-5`}>
                      {pendingResourceBand.map((topic) => renderSkeleton(topic))}
                    </ul>
                  </div>
                )}
              </div>
            ) : visibleTopics.length === 0 ? (
              <div className="rounded-[18px] border-2 border-dashed border-[#080808]/35 bg-white/70 p-6 sm:p-8">
                <h2 className="text-[24px] font-bold leading-[1.2] sm:text-[26px]">{emptyTitle}</h2>
                <p className="mt-3 max-w-lg text-[16px] leading-7 text-[#4d4d4d]">{emptyBody}</p>
              </div>
            ) : (
              <div className="space-y-9 sm:space-y-11">
                {topicBand.length > 0 && (
                  <div>
                    <BandHeading label={topicsSectionLabel} accent={subjectAccent} />
                    <ul className={`${CARD_GRID} mt-5`}>
                      {topicBand.map((topic, index) => renderCard(topic, index))}
                    </ul>
                  </div>
                )}
                {resourceBand.length > 0 && (
                  <div>
                    <BandHeading label={resourcesSectionLabel} accent={subjectAccent} />
                    <ul className={`${CARD_GRID} mt-5`}>
                      {resourceBand.map((topic, index) =>
                        renderCard(topic, topicBand.length + index),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
