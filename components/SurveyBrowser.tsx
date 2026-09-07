"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import type { SubjectValue } from "@/lib/subjects";
import { SURVEY_PHASES, type SurveyGroupDTO, type SurveyPhase } from "@/lib/surveys";
import { basePath } from "@/lib/utils";

export interface SurveyBrowserProps {
  /** Subject key used for `GET /api/survey-links?subject=…`. */
  subject: SubjectValue;
  /** Back-link target in the page header. */
  backHref: string;
  /** Back-link label in the page header. */
  backLabel: string;
  /** Page heading. */
  heading?: string;
  /** UI copy language. English Language uses `"en"`; every other subject is `"zh"`. */
  lang?: "zh" | "en";
}

/** All UI strings, so the English section can run fully in English. */
const COPY = {
  zh: {
    phases: { pre: "前測", post: "後測" } as Record<SurveyPhase, string>,
    nav: "問卷列表",
    navToggle: "選擇問卷",
    loading: "正在載入問卷…",
    loadError: "無法載入問卷，請稍後再試。",
    empty: "還未設定這一科的前測／後測問卷。",
    openNewTab: "在新視窗開啟",
    embedHint: "如果右邊一片空白，按「在新視窗開啟」也可以完成問卷。",
    launchHint: "這份問卷需要在新視窗開啟。完成後回到這裏就可以繼續學習。",
    launch: "開始問卷",
    expandGroup: (name: string) => `展開類別「${name}」`,
    collapseGroup: (name: string) => `收合類別「${name}」`,
    /** e.g. 「2 份前測 · 1 份後測」 */
    phaseCount: (n: number, phase: string) => `${n} 份${phase}`,
    groupJoin: " · ",
  },
  en: {
    phases: { pre: "Pre-test", post: "Post-test" } as Record<SurveyPhase, string>,
    nav: "Questionnaires",
    navToggle: "Choose a questionnaire",
    loading: "Loading the questionnaire…",
    loadError: "Could not load the questionnaire. Please try again later.",
    empty: "No pre-test or post-test is currently available for this subject.",
    openNewTab: "Open in a new window",
    embedHint:
      "If the panel stays blank, use “Open in a new window” to fill the questionnaire in instead.",
    launchHint:
      "This questionnaire opens in a new window. Come back here when you have finished it.",
    launch: "Start the questionnaire",
    expandGroup: (name: string) => `Expand ${name}`,
    collapseGroup: (name: string) => `Collapse ${name}`,
    phaseCount: (n: number, phase: string) => `${n} ${phase}${n === 1 ? "" : "s"}`,
    groupJoin: " · ",
  },
} as const;

/**
 * How many 類別 stay open on arrival. A page with one or two 類別 reads better
 * fully open; beyond that the list is long enough that only the 類別 being
 * answered is worth showing.
 */
const AUTO_OPEN_GROUP_LIMIT = 2;

/**
 * One colour per phase, so 前測 and 後測 are told apart at a glance instead of by
 * reading two similar labels. Blue and amber both sit far enough from the teal
 * page colour to be read as a category rather than as page furniture, and neither
 * carries a right/wrong meaning the way green and red would.
 *
 * The same badge is used on the selected row, whose background is dark teal — a
 * light fill with dark text stays legible either way, so the phase never loses
 * its colour just because it is the one open.
 */
const PHASE_BADGE: Record<SurveyPhase, string> = {
  pre: "border-[#b6cdec] bg-[#e6effb] text-[#1b4b8c]",
  post: "border-[#eecfa0] bg-[#fcf1de] text-[#8a5000]",
};

/** Phase colour for plain text, e.g. the 「2 份前測」 counts under a 類別. */
const PHASE_TEXT: Record<SurveyPhase, string> = {
  pre: "text-[#1b4b8c]",
  post: "text-[#8a5000]",
};

/**
 * The 前測-後測 page every subject lands on.
 *
 * The questionnaires are configured per school in 後台 → 問卷範本 as named 類別,
 * each holding any number of 前測 and 後測, so this component only asks
 * `/api/survey-links?subject=…` what applies to the caller and frames whatever
 * comes back. The API has already dropped empty 類別, so every group here has at
 * least one questionnaire to show.
 *
 * The picker lives in a sidebar rather than above the questionnaire: a survey is a
 * tall form in a frame, and rows of tabs stacked on top of it cost the height that
 * matters most. On narrow screens the same list collapses into one bar.
 *
 * The sidebar mirrors the 後台 structure: one collapsible section per 類別, each
 * holding its own 前測／後測. A course with several units otherwise turns into one
 * long run of similarly named links.
 *
 * Two things about embedding a third-party questionnaire are worth knowing:
 *  1. Providers may refuse to be framed (X-Frame-Options / CSP), which shows up
 *     as an empty box with nothing this code can catch — hence the always-present
 *     "open in a new window" link, and the per-link `embed` switch in the admin
 *     UI for the ones that are known to block it.
 *  2. The frame is sandboxed. Every capability a survey actually needs is granted
 *     (scripts, forms, its own origin, popups, downloads); what stays blocked is
 *     navigating the top-level page, which no questionnaire has a reason to do.
 */
export default function SurveyBrowser({
  subject,
  backHref,
  backLabel,
  heading = "前測 / 後測問卷",
  lang = "zh",
}: SurveyBrowserProps) {
  const copy = COPY[lang];
  const [groups, setGroups] = useState<SurveyGroupDTO[]>([]);
  const [loading, setLoading] = useState(true);
  // Kept as a flag rather than a message, so the copy follows `lang` at render.
  const [failed, setFailed] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [surveyIndex, setSurveyIndex] = useState(0);
  // Narrow screens only: the collapsed list above the questionnaire.
  const [navOpen, setNavOpen] = useState(false);
  // Which 類別 sections are expanded, by index.
  const [openGroups, setOpenGroups] = useState<number[]>([0]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/survey-links?subject=${subject}`);
        if (!res.ok) {
          if (active) setFailed(true);
          return;
        }
        const data = await res.json();
        if (!active) return;
        const list: SurveyGroupDTO[] = data.groups ?? [];
        setGroups(list);
        // The first questionnaire of the first 類別: the admin controls both
        // orders, so the first thing listed is the one meant to be answered first.
        setGroupIndex(0);
        setSurveyIndex(0);
        setOpenGroups(list.length <= AUTO_OPEN_GROUP_LIMIT ? list.map((_, i) => i) : [0]);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subject]);

  const group = groups[groupIndex] ?? null;
  const surveys = group?.surveys ?? [];
  const active = surveys[surveyIndex] ?? surveys[0] ?? null;
  const showGroupNames = groups.length > 1;

  function select(gi: number, si: number) {
    setGroupIndex(gi);
    setSurveyIndex(si);
    setNavOpen(false);
  }

  function toggleGroup(gi: number) {
    setOpenGroups((open) => (open.includes(gi) ? open.filter((i) => i !== gi) : [...open, gi]));
  }

  /**
   * What a 類別 says about itself, e.g. 「1 份前測 · 2 份後測」, each count in its
   * phase colour so a collapsed 類別 still shows what it holds.
   */
  function groupSummary(g: SurveyGroupDTO) {
    const parts = SURVEY_PHASES.filter((phase) =>
      g.surveys.some((s) => s.phase === phase),
    ).map((phase) => (
      <span key={phase} className={PHASE_TEXT[phase]}>
        {copy.phaseCount(g.surveys.filter((s) => s.phase === phase).length, copy.phases[phase])}
      </span>
    ));

    return parts.flatMap((part, i) =>
      i === 0 ? [part] : [<span key={`sep-${i}`}>{copy.groupJoin}</span>, part],
    );
  }

  /** The 前測／後測 pill, in the phase's own colour wherever it appears. */
  function phaseBadge(phase: SurveyPhase, size: "sm" | "md" = "sm") {
    return (
      <span
        className={[
          "shrink-0 rounded-[4px] border px-1.5 font-semibold",
          size === "sm" ? "py-0.5 text-[11px]" : "py-[3px] text-[12px]",
          PHASE_BADGE[phase],
        ].join(" ")}
      >
        {copy.phases[phase]}
      </span>
    );
  }

  /** The questionnaires of one 類別. Also the whole list when there is only one. */
  function surveyList(g: SurveyGroupDTO, gi: number) {
    return (
      <ul className="space-y-1">
        {g.surveys.map((s, si) => {
          const isActive = gi === groupIndex && si === surveyIndex;
          return (
            <li key={`${s.url}-${si}`}>
              <button
                type="button"
                onClick={() => select(gi, si)}
                aria-current={isActive ? "true" : undefined}
                className={[
                  "flex w-full items-center gap-2 rounded-[6px] border-2 px-2.5 py-2 text-left transition duration-200",
                  isActive
                    ? "border-[#123c34] bg-[#0f766e] text-white"
                    : "border-transparent text-[#2f4c45] hover:border-[#cadfd9] hover:bg-[#f1f8f6]",
                ].join(" ")}
              >
                {phaseBadge(s.phase)}
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  /**
   * The whole picker, used by both the sidebar and the collapsed mobile bar.
   *
   * With a single 類別 there is nothing to separate, so its questionnaires are
   * listed flat — a lone section header would only be a label with no siblings.
   */
  const navList = !showGroupNames ? (
    // groups may still be empty while loading, before this list is ever shown.
    groups.length === 1 && surveyList(groups[0], 0)
  ) : (
    <ul className="space-y-2">
      {groups.map((g, gi) => {
        const open = openGroups.includes(gi);
        const holdsActive = gi === groupIndex;
        return (
          <li
            key={`${g.name}-${gi}`}
            className={[
              "overflow-hidden rounded-[8px] border-2",
              holdsActive ? "border-[#123c34] bg-white" : "border-[#cadfd9] bg-[#fbfdfc]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => toggleGroup(gi)}
              aria-expanded={open}
              aria-label={open ? copy.collapseGroup(g.name) : copy.expandGroup(g.name)}
              className={[
                "flex w-full items-center gap-1.5 px-2 py-2 text-left transition-colors duration-200",
                holdsActive ? "bg-[#e5f2ef]" : "hover:bg-[#f1f8f6]",
              ].join(" ")}
            >
              <ChevronDown
                className={[
                  "size-4 shrink-0 text-[#0f766e] transition-transform duration-200",
                  open ? "" : "-rotate-90",
                ].join(" ")}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold tracking-[-0.01em] text-[#12312b]">
                  {g.name}
                </span>
                {/* Kept visible when open too: it is the only place the make-up
                    of a 類別 is stated, and it costs one line. */}
                <span className="block truncate text-[11px] font-medium text-[#5c736c]">
                  {groupSummary(g)}
                </span>
              </span>
            </button>
            {open && <div className="border-t-2 border-[#dceae6] p-1.5">{surveyList(g, gi)}</div>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <Header backHref={backHref} backLabel={backLabel} />

      {/* Flat paper colour, no dot texture: the bordered cards carry the page. */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden bg-[#f1f8f6] text-[#12312b]">
        {loading || failed || !active ? (
          <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
            <h1 className="text-[24px] leading-tight font-bold tracking-[-0.02em] sm:text-[30px]">
              {heading}
            </h1>
            {loading ? (
              <p className="inline-flex items-center gap-3 rounded-[10px] border-2 border-dashed border-[#b9d6ce] bg-white/80 px-6 py-5 text-[15px] text-[#4c645d]">
                <Loader2 className="size-5 animate-spin text-[#0f766e]" />
                {copy.loading}
              </p>
            ) : failed ? (
              <p className="rounded-[10px] border-2 border-[#e5b9b9] bg-[#fdf4f4] px-5 py-4 text-[15px] text-[#b42318]">
                {copy.loadError}
              </p>
            ) : (
              <div className="rounded-[10px] border-2 border-dashed border-[#b9d6ce] bg-white/80 px-8 py-10">
                <ClipboardList className="mx-auto size-10 text-[#9dc4bb]" strokeWidth={1.5} />
                <p className="mt-4 text-[15px] text-[#4c645d]">{copy.empty}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex min-h-0 w-full flex-1 gap-3 overflow-y-auto p-3 sm:p-4 lg:gap-4 lg:overflow-hidden">
            {/* ── Sidebar picker (wide screens) ──────────────────────────── */}
            <aside className="hidden w-[248px] shrink-0 flex-col overflow-hidden rounded-[10px] border-2 border-[#123c34] bg-white shadow-[4px_4px_0_#d6e9e4] lg:flex">
              <div className="flex shrink-0 items-center gap-2 border-b-2 border-[#123c34] bg-[#0f766e] px-3 py-3 text-white">
                <ClipboardList className="size-4 shrink-0" strokeWidth={2} />
                <h1 className="text-[15px] leading-tight font-bold tracking-[-0.01em]">
                  {heading}
                </h1>
              </div>
              <nav aria-label={copy.nav} className="min-h-0 flex-1 overflow-y-auto p-2">
                {navList}
              </nav>
            </aside>

            {/* ── Questionnaire ─────────────────────────────────────────── */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              {/* Same list, collapsed into one bar where a sidebar would not fit. */}
              <div className="shrink-0 lg:hidden">
                <h1 className="mb-2 text-[19px] leading-tight font-bold tracking-[-0.02em]">
                  {heading}
                </h1>
                <button
                  type="button"
                  onClick={() => setNavOpen((open) => !open)}
                  aria-expanded={navOpen}
                  className="flex w-full items-center gap-2 rounded-[8px] border-2 border-[#123c34] bg-white px-3 py-2 text-left shadow-[3px_3px_0_#d6e9e4]"
                >
                  <ClipboardList className="size-4 shrink-0 text-[#0f766e]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-[#12312b]">
                      {active.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {phaseBadge(active.phase)}
                      {showGroupNames && group && (
                        <span className="min-w-0 truncate text-[12px] text-[#5c736c]">
                          {group.name}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronDown
                    className={[
                      "size-4 shrink-0 text-[#0f766e] transition-transform duration-200",
                      navOpen ? "" : "-rotate-90",
                    ].join(" ")}
                    aria-hidden
                  />
                </button>
                {navOpen && (
                  <nav
                    aria-label={copy.nav}
                    className="mt-2 max-h-[45vh] overflow-y-auto rounded-[8px] border-2 border-[#123c34] bg-white p-2 shadow-[3px_3px_0_#d6e9e4]"
                  >
                    {navList}
                  </nav>
                )}
              </div>

              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border-2 border-[#123c34] bg-white shadow-[4px_4px_0_#d6e9e4]">
                <div className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-[#123c34] bg-[#e5f2ef] px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[17px] font-bold tracking-[-0.02em] text-[#12312b] sm:text-[19px]">
                      {active.title}
                    </h2>
                    <div className="mt-1 flex items-center gap-2">
                      {phaseBadge(active.phase, "md")}
                      {showGroupNames && group && (
                        <span className="min-w-0 truncate text-[12px] font-medium text-[#4c645d]">
                          {group.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Always offered, even when the frame works: a provider can
                      start refusing to be framed without anyone editing a link. */}
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border-2 border-[#123c34] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0b5c55] transition-colors hover:bg-[#0f766e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                  >
                    <ExternalLink className="size-4" />
                    {copy.openNewTab}
                  </a>
                </div>

                {active.description && (
                  <p className="max-h-24 shrink-0 overflow-y-auto border-b-2 border-[#dceae6] px-4 py-2.5 text-[14px] leading-6 text-[#3c554e]">
                    {active.description}
                  </p>
                )}

                {active.embed ? (
                  <>
                    <iframe
                      // Keyed by url so switching questionnaire loads a fresh
                      // frame instead of reusing the previous one's session.
                      key={active.url}
                      src={active.url}
                      title={active.title}
                      className="min-h-[60vh] w-full flex-1 border-0 bg-[#f7fbfa] lg:min-h-0"
                      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                    />
                    <p className="shrink-0 border-t-2 border-[#dceae6] px-4 py-2 text-[12px] text-[#5c736c]">
                      {copy.embedHint}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
                    <p className="max-w-md text-[15px] leading-7 text-[#3c554e]">
                      {copy.launchHint}
                    </p>
                    <a
                      href={active.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-[8px] border-2 border-[#123c34] bg-[#0f766e] px-5 text-[16px] font-bold text-white shadow-[4px_4px_0_#123c34] transition hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#123c34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                    >
                      <ExternalLink className="size-5" />
                      {copy.launch}
                    </a>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
