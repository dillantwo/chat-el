"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarDays,
  Drama,
  Eye,
  FastForward,
  GraduationCap,
  HelpCircle,
  Info,
  Lightbulb,
  Lock,
  PenLine,
  Puzzle,
  Replace,
  RotateCcw,
  Scale,
  Search,
  Shirt,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import Header from "@/components/Header";
import { basePath } from "@/lib/utils";
import { learningStyles } from "../../learning/styles";
import { questions, TOTAL_QUESTIONS, type PartId, type Question } from "./questions";
import { useReadingRecord } from "@/lib/english-reading-record";

type Section = "overview" | "part1" | "part2" | "summary";

const TABS: { id: Section; label: string; icon: typeof Eye }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "part1", label: "Part 1", icon: Shirt },
  { id: "part2", label: "Part 2", icon: Drama },
  { id: "summary", label: "Summary", icon: Trophy },
];

// Extra styles for the Story Day poster.
const posterStyles = `
.rc-learning .poster { background: #ffffff; border: 2px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; transition: border-color 0.4s ease, box-shadow 0.4s ease; }
.rc-learning .poster.clue-active { border-color: var(--accent-orange) !important; box-shadow: 0 0 20px rgba(255,140,66,0.2); }
.rc-learning .poster-inner { padding: 16px 16px 18px; }
.rc-learning .poster-title { text-align: center; font-weight: 800; font-size: 22px; color: var(--text-primary); }
.rc-learning .poster-date { text-align: center; font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-top: 2px; }
.rc-learning .poster-intro { text-align: center; font-size: 13.5px; line-height: 1.7; color: var(--text-secondary); margin: 12px 0; }
.rc-learning .poster-h { font-weight: 700; font-size: 14px; color: var(--text-primary); margin: 10px 0 6px; }
.rc-learning .wear-group { width: fit-content; max-width: 100%; margin: 0 auto; }
.rc-learning .wear-list { list-style: none; padding: 0; margin: 0; }
.rc-learning .wear-list li { font-size: 13px; line-height: 1.6; color: var(--text-secondary); padding: 2px 0; display: flex; align-items: flex-start; gap: 8px; }
.rc-learning .wear-list .tick { color: var(--accent-mint); font-weight: 800; }
.rc-learning .wear-list .cross { color: var(--wrong-border); font-weight: 800; }
.rc-learning .wear-row { display: flex; gap: 20px; align-items: center; justify-content: center; }
.rc-learning .wear-row .wear-list { flex: 0 1 auto; min-width: 0; }
.rc-learning .poster-figure { flex: 0 0 auto; width: 120px; align-self: center; }
.rc-learning .poster-figure img { width: 100%; height: auto; display: block; border-radius: var(--radius-sm); }
@media (max-width: 520px) { .rc-learning .poster-figure { width: 90px; } }
.rc-learning .activities-bar { background: #6b7280; color: #fff; font-weight: 700; text-align: center; padding: 8px 12px; font-size: 16px; }
.rc-learning .activities-figure { float: right; width: 120px; margin: 0 40px 6px 14px; shape-outside: margin-box; }
.rc-learning .activities-figure img { width: 100%; height: auto; display: block; }
@media (max-width: 520px) { .rc-learning .activities-figure { width: 90px; } }
.rc-learning .activity { padding: 10px 14px 4px; }
.rc-learning .activity-name { font-weight: 700; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; gap: 7px; }
.rc-learning .activity-name svg { color: var(--accent-purple); flex-shrink: 0; }
.rc-learning .activity-text { font-size: 13px; line-height: 1.6; color: var(--text-secondary); margin: 4px 0 0; padding-left: 24px; }
.rc-learning .book-list { margin: 4px 0 0; padding-left: 40px; font-size: 12.5px; color: var(--text-muted); font-style: normal; }
.rc-learning .award-table { clear: both; width: calc(100% - 28px); margin: 8px 14px 4px; border-collapse: collapse; font-size: 12.5px; }
.rc-learning .award-table caption { font-weight: 700; font-size: 13px; color: var(--text-primary); padding: 4px; }
.rc-learning .award-table th, .rc-learning .award-table td { border: 1px solid var(--border-light); padding: 6px 8px; text-align: left; color: var(--text-secondary); }
.rc-learning .award-table th { font-weight: 700; color: var(--text-primary); white-space: nowrap; }
.rc-learning .poster-note { font-size: 12px; font-style: italic; color: var(--text-muted); padding: 8px 14px 2px; }
.rc-learning .q-image { margin: 0 0 14px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-card); }
.rc-learning .q-image img { display: block; width: 100%; height: auto; }
.rc-learning .options-list.image-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rc-learning .options-list.image-grid li { margin: 0; }
.rc-learning .options-list.image-grid .option-btn { flex-direction: column; align-items: center; gap: 8px; height: 100%; padding: 12px; margin-bottom: 0; }
.rc-learning .option-btn .opt-img { width: 100%; height: auto; max-height: 180px; object-fit: contain; border-radius: 8px; display: block; background: #fff; }
@media (max-width: 520px) { .rc-learning .options-list.image-grid { grid-template-columns: 1fr; } }
.rc-learning .options-list.letter-only { display: flex; flex-wrap: wrap; gap: 10px; }
.rc-learning .options-list.letter-only li { flex: 1 1 0; min-width: 64px; }
.rc-learning .options-list.letter-only .option-btn { justify-content: center; padding: 12px 10px; margin-bottom: 0; }
.rc-learning .options-list.letter-only .opt-letter { width: 32px; height: 32px; font-size: 15px; }

/* Locked tabs: greyed out and not clickable until the previous part is done. */
.rc-learning .nav-tab.locked { opacity: 0.45; cursor: not-allowed; }
.rc-learning .nav-tab.locked:hover { border-color: var(--border-light); color: var(--text-muted); }

/* Neutral "selected" state for options while answering (no right/wrong reveal). */
.rc-learning .option-btn.selected { border-color: var(--accent-blue); background: rgba(20,110,245,0.08); }
.rc-learning .option-btn.selected .opt-letter { background: var(--accent-blue); color: #fff; }
.rc-learning .question-card.answered { border-color: var(--accent-blue); }

/* Answer Review list shown on the Summary tab. */
.rc-learning .answer-review { list-style: none; padding: 0; margin: 0; }
.rc-learning .answer-review > li {
  padding: 14px 14px; margin-bottom: 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-light); border-left: 4px solid var(--border-light);
  background: var(--bg-article);
}
.rc-learning .answer-review > li.correct { border-left-color: var(--correct-border); background: var(--bg-card); }
.rc-learning .answer-review > li.wrong { border-left-color: var(--wrong-border); background: var(--bg-card); }
.rc-learning .answer-review .ar-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.rc-learning .answer-review .ar-badge {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: #fff; background: var(--wrong-border);
}
.rc-learning .answer-review .ar-badge.ok { background: var(--correct-border); }
.rc-learning .answer-review .ar-qtext { font-size: 14px; font-weight: 600; line-height: 1.5; color: var(--text-primary); }
.rc-learning .answer-review .ar-options { list-style: none; padding: 0; margin: 0 0 8px 34px; display: flex; flex-direction: column; gap: 5px; }
.rc-learning .answer-review .ar-option { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); background: transparent; font-size: 13px; color: var(--text-secondary); }
.rc-learning .answer-review .ar-option.correct { border-color: var(--correct-border); background: var(--correct-bg); color: var(--text-primary); }
.rc-learning .answer-review .ar-option.wrong { border-color: var(--wrong-border); background: var(--wrong-bg); color: var(--text-primary); }
.rc-learning .answer-review .ar-opt-letter { width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; font-size: 12px; background: var(--border-light); color: var(--text-primary); }
.rc-learning .answer-review .ar-option.correct .ar-opt-letter { background: var(--correct-border); color: #fff; }
.rc-learning .answer-review .ar-option.wrong .ar-opt-letter { background: var(--wrong-border); color: #fff; }
.rc-learning .answer-review .ar-opt-label { flex: 1; }
.rc-learning .answer-review .ar-tag { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.rc-learning .answer-review .ar-tag.ok { background: var(--correct-border); color: #fff; }
.rc-learning .answer-review .ar-tag.you { background: var(--accent-blue); color: #fff; }
.rc-learning .answer-review .explain-box { margin-left: 34px; }
`;

export default function EnglishReadingComprehensionCycle2Reading1LearningPage() {
  const [section, setSection] = useState<Section>("overview");
  const [answered, setAnswered] = useState<Record<number, string>>({});
  const [hints, setHints] = useState<Record<number, boolean>>({});
  const [strategies, setStrategies] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState<Record<PartId, number>>({ part1: 0, part2: 0 });
  const [activeClues, setActiveClues] = useState<{ ids: string[]; badge: string }>({
    ids: [],
    badge: "",
  });
  const [skillChecks, setSkillChecks] = useState<Record<string, boolean>>({});
  const { clearRecord } = useReadingRecord({
    readingId: "cycle-2-reading-1",
    title: "Cycle 2 · Reading 1: Story Day Poster",
    questions,
    answered,
    section,
    step,
    skillChecks,
    setAnswered,
    setSection,
    setStep,
    setSkillChecks,
  });

  const toggleSkill = useCallback(
    (id: string) => setSkillChecks((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );

  const clueRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainRef = useRef<HTMLElement | null>(null);

  const score = useMemo(
    () =>
      questions.reduce(
        (acc, q) => (answered[q.id] && answered[q.id] === q.answer ? acc + 1 : acc),
        0,
      ),
    [answered],
  );

  const clearHighlights = useCallback(() => setActiveClues({ ids: [], badge: "" }), []);

  const highlightClues = useCallback((q: Question) => {
    setActiveClues({ ids: q.clues, badge: q.clues[0] ?? "" });
    const first = q.clues[0];
    if (first) {
      window.setTimeout(() => {
        clueRefs.current[first]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
  }, []);

  const switchSection = useCallback(
    (id: Section) => {
      setSection(id);
      clearHighlights();
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [clearHighlights],
  );

  // Record the student's choice without revealing whether it is right or wrong.
  // Feedback (correct/wrong + explanations) is deferred to the Summary tab.
  // Students may change their choice until they move on.
  const handleAnswer = useCallback((q: Question, val: string) => {
    setAnswered((prev) => ({ ...prev, [q.id]: val }));
  }, []);

  const toggleHint = useCallback(
    (q: Question) => {
      const opening = !hints[q.id];
      setHints((prev) => ({ ...prev, [q.id]: opening }));
      if (opening) highlightClues(q);
      else clearHighlights();
    },
    [hints, highlightClues, clearHighlights],
  );

  const toggleStrategy = useCallback((id: number) => {
    setStrategies((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const advanceStep = useCallback(
    (part: PartId) => {
      setStep((prev) => ({ ...prev, [part]: prev[part] + 1 }));
      clearHighlights();
    },
    [clearHighlights],
  );

  const goBackStep = useCallback(
    (part: PartId) => {
      setStep((prev) => ({ ...prev, [part]: Math.max(0, prev[part] - 1) }));
      clearHighlights();
    },
    [clearHighlights],
  );

  const resetAll = useCallback(() => {
    setAnswered({});
    clearRecord();
    setHints({});
    setStrategies({});
    setSkillChecks({});
    setStep({ part1: 0, part2: 0 });
    clearHighlights();
    setSection("overview");
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [clearHighlights]);

  // Part 1 covers Q1–Q2 (the poster basics); Part 2 covers Q3–Q6 (activities).
  const part1Done = answered[1] && answered[2];
  const part2Done = answered[3] && answered[4] && answered[5] && answered[6];
  const allDone = Object.keys(answered).length === TOTAL_QUESTIONS;

  const isTabCompleted = (id: Section) => {
    if (id === "part1") return Boolean(part1Done);
    if (id === "part2") return Boolean(part2Done);
    if (id === "summary") return allDone;
    return false;
  };

  // Tabs unlock in order: Overview → Part 1 → Part 2 → Summary. Part 2 opens
  // once Part 1 is fully answered; Summary opens once every question is answered.
  const isTabUnlocked = (id: Section) => {
    if (id === "overview" || id === "part1") return true;
    if (id === "part2") return Boolean(part1Done);
    if (id === "summary") return allDone;
    return false;
  };

  const summaryMsg =
    score === TOTAL_QUESTIONS
      ? "Perfect score! You're a reading superstar!"
      : score >= 4
        ? "Great job! Keep up the good work!"
        : score >= 2
          ? "Good effort! Review the answers and try again."
          : "Keep practicing — use the hints to help you next time!";

  const clueClass = (id: string) =>
    `highlight-clue${activeClues.ids.includes(id) ? " glow" : ""}${
      activeClues.badge === id ? " clue-badge" : ""
    }`;
  const setClueRef = (id: string) => (el: HTMLElement | null) => {
    clueRefs.current[id] = el;
  };
  const posterActive = (part: "part1" | "part2") =>
    `poster${section === part && activeClues.ids.length > 0 ? " clue-active" : ""}`;

  function renderQuestions(part: "part1" | "part2") {
    const list = questions.filter((q) => q.part === part);
    const current = step[part];
    const currentQ = list[current];
    const currentAnswered = currentQ ? Boolean(answered[currentQ.id]) : false;
    const isLast = current >= list.length - 1;
    return (
      <>
        <div className="q-progress">
          <span className="q-progress-track">
            {list.map((q, i) => (
              <span
                key={q.id}
                className={`q-progress-dot${i <= current ? " active" : ""}${
                  answered[q.id] ? " done" : ""
                }`}
              />
            ))}
          </span>
        </div>
        {list.slice(current, current + 1).map((q) => {
          const picked = answered[q.id];
          const cardClass = picked ? "question-card answered" : "question-card";
          return (
            <div className={cardClass} key={q.id}>
              <div className="q-number">Question {q.id}</div>
              <div className="q-text">{q.text}</div>
              {q.extra}
              <ul
                className={`options-list${
                  q.imageOptions
                    ? " image-grid"
                    : q.options.every((o) => !o.label)
                      ? " letter-only"
                      : ""
                }`}
              >
                {q.options.map((opt) => {
                  let cls = "option-btn";
                  if (picked === opt.val) cls += " selected";
                  return (
                    <li key={opt.val}>
                      <button
                        type="button"
                        className={cls}
                        onClick={() => handleAnswer(q, opt.val)}
                      >
                        <span className="opt-letter">{opt.val}</span> {opt.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="hint-row">
                <button type="button" className="hint-btn" onClick={() => toggleHint(q)}>
                  <Lightbulb className="size-3.5" /> Show Clue
                </button>
                <button
                  type="button"
                  className="hint-btn strategy-btn"
                  onClick={() => toggleStrategy(q.id)}
                >
                  <GraduationCap className="size-3.5" /> Tips &amp; Key Reading Skills
                </button>
              </div>
              {hints[q.id] && <div className="hint-box">{q.hint}</div>}
              {strategies[q.id] && (
                <div className="reading-strategy">
                  <GraduationCap className="size-3.5" />
                  <span>{q.strategy}</span>
                </div>
              )}
            </div>
          );
        })}
        {(current > 0 || (currentAnswered && !isLast)) && (
          <div className="q-nav-row">
            {current > 0 ? (
              <button type="button" className="q-nav-btn back" onClick={() => goBackStep(part)}>
                <ArrowLeft className="size-4" /> Previous
              </button>
            ) : (
              <span />
            )}
            {currentAnswered && !isLast ? (
              <button type="button" className="q-nav-btn next" onClick={() => advanceStep(part)}>
                Next Question <ArrowRight className="size-4" />
              </button>
            ) : (
              <span />
            )}
          </div>
        )}
      </>
    );
  }

  // Top half of the poster (basic information + dress code). Clue spans glow
  // when a Part 1 question is hinted or answered.
  const posterBasics = (
    <div className={posterActive("part1")}>
      <div className="poster-inner">
        <div className="poster-title">Story Day</div>
        <div className="poster-date">22nd March 2026</div>
        <p className="poster-intro">
          <span className={clueClass("q1")} ref={setClueRef("q1")}>
            We hope this special day will help you enjoy reading more books.
          </span>
          <br />
          Come and dress up as your favourite story character!
        </p>
        <div className="wear-group">
        <div className="poster-h">What You Can and Cannot Wear and Bring:</div>
        <div className="wear-row">
          <ul className="wear-list">
            <li>
              <span className="tick">✓</span> school-friendly clothes that are easy to move in
            </li>
            <li>
              <span className="tick">✓</span>
              <span className={clueClass("q2a")} ref={setClueRef("q2a")}>
                trousers, skirts and dresses (knee length)
              </span>
            </li>
            <li>
              <span className="tick">✓</span> face paint
            </li>
            <li>
              <span className="tick">✓</span> toy accessories (e.g. necklaces and rings)
            </li>
            <li>
              <span className="cross">✗</span>
              <span className={clueClass("q2b")} ref={setClueRef("q2b")}>
                tops with no sleeves
              </span>
            </li>
            <li>
              <span className="cross">✗</span>
              <span className={clueClass("q2c")} ref={setClueRef("q2c")}>
                clothes with horror themes
              </span>
            </li>
            <li>
              <span className="cross">✗</span>
              <span className={clueClass("q2d")} ref={setClueRef("q2d")}>
                things used for fighting
              </span>
            </li>
          </ul>
          <div className="poster-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${basePath}/english/story%20day%201.png`} alt="A student dressed up as a fairy story character" />
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  // Bottom half of the poster (the activities). Used for Part 2.
  const posterActivities = (
    <div className={posterActive("part2")}>
      <div className="activities-bar">Activities:</div>
      <div className="activity">
        <div className="activity-name">
          <Drama className="size-4" /> Classroom Drama
        </div>
        <p className="activity-text">
          <span className={clueClass("q3")} ref={setClueRef("q3")}>
            Everyone picks a short part from his or her favourite story. Read it and act it out in
            English class.
          </span>
        </p>
      </div>
      <div className="activities-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${basePath}/english/story%20day%202.png`} alt="A stack of colourful storybooks" />
      </div>
      <div className="activity">
        <div className="activity-name">
          <BookOpen className="size-4" />
          <span className={clueClass("q4")} ref={setClueRef("q4")}>
            Story Corner with Ms Lee
          </span>
        </div>
        <p className="activity-text">Go to the reading room at recess and listen to exciting stories.</p>
        <ul className="book-list">
          <li><em>The Hidden Island</em> written by Peter Lam</li>
          <li><em>Lulu and the Moon Rocket</em> written by Dillan Rumelhart</li>
        </ul>
      </div>
      <div className="activity">
        <div className="activity-name">
          <Sparkles className="size-4" /> Fashion Show
        </div>
        <p className="activity-text">
          <span className={clueClass("q5b")} ref={setClueRef("q5b")}>
            The best-dressed students from each class will walk proudly on the stage.
          </span>
        </p>
      </div>
      <table className="award-table">
        <caption className={clueClass("q5")} ref={setClueRef("q5")}>
          Best Costume Award
        </caption>
        <tbody>
          <tr>
            <th>1st Prize</th>
            <td>a $500 bookshop coupon</td>
          </tr>
          <tr>
            <th>2nd Prize</th>
            <td>a set of adventure books</td>
          </tr>
          <tr>
            <th>3rd Prize</th>
            <td>a storybook</td>
          </tr>
        </tbody>
      </table>
      <p className="poster-note">
        Note: Students who watch the fashion show will get a small gift.
      </p>
    </div>
  );

  // The complete, plain (no clue highlighting) poster. Reused by the Overview
  // preview and the Summary's side-by-side Answer Review.
  const fullPoster = (
    <div className="poster">
      <div className="poster-inner">
        <div className="poster-title">Story Day</div>
        <div className="poster-date">22nd March 2026</div>
        <p className="poster-intro">
          We hope this special day will help you enjoy reading more books.
          <br />
          Come and dress up as your favourite story character!
        </p>
        <div className="wear-group">
          <div className="poster-h">What You Can and Cannot Wear and Bring:</div>
          <div className="wear-row">
            <ul className="wear-list">
              <li>
                <span className="tick">✓</span> school-friendly clothes that are easy to move in
              </li>
              <li>
                <span className="tick">✓</span> trousers, skirts and dresses (knee length)
              </li>
              <li>
                <span className="tick">✓</span> face paint
              </li>
              <li>
                <span className="tick">✓</span> toy accessories (e.g. necklaces and rings)
              </li>
              <li>
                <span className="cross">✗</span> tops with no sleeves
              </li>
              <li>
                <span className="cross">✗</span> clothes with horror themes
              </li>
              <li>
                <span className="cross">✗</span> things used for fighting
              </li>
            </ul>
            <div className="poster-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/english/story%20day%201.png`}
                alt="A student dressed up as a fairy story character"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="activities-bar">Activities:</div>
      <div className="activity">
        <div className="activity-name">
          <Drama className="size-4" /> Classroom Drama
        </div>
        <p className="activity-text">
          Everyone picks a short part from his or her favourite story. Read it and act it out in
          English class.
        </p>
      </div>
      <div className="activities-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${basePath}/english/story%20day%202.png`} alt="A stack of colourful storybooks" />
      </div>
      <div className="activity">
        <div className="activity-name">
          <BookOpen className="size-4" /> Story Corner with Ms Lee
        </div>
        <p className="activity-text">
          Go to the reading room at recess and listen to exciting stories.
        </p>
        <ul className="book-list">
          <li><em>The Hidden Island</em> written by Peter Lam</li>
          <li><em>Lulu and the Moon Rocket</em> written by Dillan Rumelhart</li>
        </ul>
      </div>
      <div className="activity">
        <div className="activity-name">
          <Sparkles className="size-4" /> Fashion Show
        </div>
        <p className="activity-text">
          The best-dressed students from each class will walk proudly on the stage.
        </p>
      </div>
      <table className="award-table">
        <caption>Best Costume Award</caption>
        <tbody>
          <tr>
            <th>1st Prize</th>
            <td>a $500 bookshop coupon</td>
          </tr>
          <tr>
            <th>2nd Prize</th>
            <td>a set of adventure books</td>
          </tr>
          <tr>
            <th>3rd Prize</th>
            <td>a storybook</td>
          </tr>
        </tbody>
      </table>
      <p className="poster-note">
        Note: Students who watch the fashion show will get a small gift.
      </p>
    </div>
  );

  return (
    <>
      <Header backHref="/english/reading-comprehension/cycle-2-reading-1" backLabel="Back" />

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="rc-learning">
          <style dangerouslySetInnerHTML={{ __html: learningStyles + posterStyles }} />

          <div className="app-shell">
            {/* Header */}
            <div className="app-header">
              <h1>
                <BookOpenCheck className="size-6" /> Cycle 2 — Reading 1: Story Day (Poster)
              </h1>
            </div>

            {/* Tabs */}
            <div className="nav-tabs">
              {TABS.map(({ id, label, icon: Icon }) => {
                const unlocked = isTabUnlocked(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`nav-tab${section === id ? " active" : ""}${
                      unlocked ? "" : " locked"
                    }`}
                    onClick={() => unlocked && switchSection(id)}
                    disabled={!unlocked}
                    aria-disabled={!unlocked}
                    title={unlocked ? undefined : "Finish the previous part to unlock"}
                  >
                    <Icon className="size-3.5" /> {label}
                    {isTabCompleted(id) ? " ✓" : !unlocked ? <Lock className="size-3" /> : ""}
                  </button>
                );
              })}
            </div>

            {/* OVERVIEW */}
            {section === "overview" && (
              <div className="section-panel">
                <div className="narrow">
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-yellow),var(--accent-orange))",
                        }}
                      >
                        <Lightbulb className="size-4" />
                      </span>
                      Pre-reading Questions
                    </div>
                    <ul className="pre-reading-list">
                      <li>
                        <HelpCircle className="size-4" /> How many parts are there on the poster?
                      </li>
                      <li>
                        <HelpCircle className="size-4" /> In which month is the Story Day happening?
                      </li>
                    </ul>
                  </div>

                  {/* Full poster preview */}
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-pink),var(--accent-mint))",
                        }}
                      >
                        <CalendarDays className="size-4" />
                      </span>
                      The Poster
                    </div>
                    {fullPoster}
                  </div>

                  <div style={{ textAlign: "center", marginTop: 6 }}>
                    <button
                      type="button"
                      className="restart-btn"
                      onClick={() => switchSection("part1")}
                      style={{
                        background:
                          "linear-gradient(135deg,var(--accent-mint),var(--accent-blue))",
                      }}
                    >
                      Start Part 1 <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PART 1 */}
            {section === "part1" && (
              <div className="section-panel">
                <div className="split-layout">
                  <div className="split-left">
                    <div className="pane-label">
                      <BookOpen className="size-3.5" /> Reading Passage
                    </div>
                    <div className="card" style={{ marginBottom: 10 }}>
                      <div className="card-title" style={{ fontSize: 15 }}>
                        <span
                          className="icon"
                          style={{
                            background:
                              "linear-gradient(135deg,var(--accent-pink),var(--accent-orange))",
                          }}
                        >
                          <Shirt className="size-4" />
                        </span>
                        Part 1
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> Can students wear whatever they want for
                          the Story Day?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {posterBasics}
                    </div>
                  </div>
                  <div className="split-right">
                    <div className="pane-label questions">
                      <PenLine className="size-3.5" /> Questions
                    </div>
                    {renderQuestions("part1")}
                    {part1Done && (
                      <div style={{ textAlign: "center", marginTop: 6 }}>
                        <button
                          type="button"
                          className="restart-btn"
                          onClick={() => switchSection("part2")}
                          style={{
                            background:
                              "linear-gradient(135deg,var(--accent-purple),var(--accent-pink))",
                          }}
                        >
                          Continue to Part 2 <ArrowRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PART 2 */}
            {section === "part2" && (
              <div className="section-panel">
                <div className="split-layout">
                  <div className="split-left">
                    <div className="pane-label">
                      <BookOpen className="size-3.5" /> Reading Passage
                    </div>
                    <div className="card" style={{ marginBottom: 10 }}>
                      <div className="card-title" style={{ fontSize: 15 }}>
                        <span
                          className="icon"
                          style={{
                            background:
                              "linear-gradient(135deg,var(--accent-purple),var(--accent-blue))",
                          }}
                        >
                          <Drama className="size-4" />
                        </span>
                        Part 2
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> How many activities are there on the
                          Story Day?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {posterActivities}
                    </div>
                  </div>
                  <div className="split-right">
                    <div className="pane-label questions">
                      <PenLine className="size-3.5" /> Questions
                    </div>
                    {renderQuestions("part2")}
                    {part2Done && (
                      <div style={{ textAlign: "center", marginTop: 6 }}>
                        <button
                          type="button"
                          className="restart-btn"
                          onClick={() => switchSection("summary")}
                          style={{
                            background:
                              "linear-gradient(135deg,var(--accent-yellow),var(--accent-orange))",
                          }}
                        >
                          See Summary <ArrowRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUMMARY */}
            {section === "summary" && (
              <div className="section-panel">
                <div className="narrow">
                  <div className="card celebration-card">
                    <div className="trophy">🏆</div>
                    <h2>Reading 1 Completed!</h2>
                    <p>You have just completed Cycle 2 — Reading 1: Story Day.</p>
                    <div className="final-score">
                      {score} / {TOTAL_QUESTIONS}
                    </div>
                    <p>{summaryMsg}</p>
                    <button type="button" className="restart-btn" onClick={resetAll}>
                      <RotateCcw className="size-4" /> Start Over
                    </button>
                  </div>
                </div>

                <div className="split-layout">
                  <div className="split-left">
                    <div className="pane-label">
                      <BookOpen className="size-3.5" /> Reading Passage
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {fullPoster}
                    </div>
                  </div>
                  <div className="split-right">
                    <div className="pane-label questions">
                      <BookOpenCheck className="size-3.5" /> Answer Review
                    </div>
                    <ul className="answer-review">
                      {questions.map((q) => {
                        const picked = answered[q.id];
                        const isCorrect = picked === q.answer;
                        return (
                          <li key={q.id} className={isCorrect ? "correct" : "wrong"}>
                            <div className="ar-head">
                              <span className={`ar-badge${isCorrect ? " ok" : ""}`}>
                                {isCorrect ? "✓" : "✗"}
                              </span>
                              <span className="ar-qtext">
                                <strong>Q{q.id}.</strong> {q.text}
                              </span>
                            </div>
                            <ul className="ar-options">
                              {q.options.map((opt) => {
                                const optCorrect = opt.val === q.answer;
                                const optPicked = opt.val === picked;
                                let cls = "ar-option";
                                if (optCorrect) cls += " correct";
                                else if (optPicked) cls += " wrong";
                                return (
                                  <li key={opt.val} className={cls}>
                                    <span className="ar-opt-letter">{opt.val}</span>
                                    <span className="ar-opt-label">{opt.label}</span>
                                    {optCorrect && <span className="ar-tag ok">✓ Correct</span>}
                                    {optPicked && <span className="ar-tag you">Your answer</span>}
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="explain-box">{q.explain}</div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="narrow">
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-purple),var(--accent-blue))",
                        }}
                      >
                        <Star className="size-4" />
                      </span>
                      Reading Skills You Used
                    </div>
                    <ul className="summary-skills">
                      {SKILLS_PRACTICED.map(({ id, color, icon: Icon, label, indent }) => (
                        <li key={id} style={indent ? { marginLeft: 30 } : undefined}>
                          <span className="skill-icon" style={{ background: color }}>
                            <Icon className="size-3.5" />
                          </span>
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={!!skillChecks[id]}
                            onChange={() => toggleSkill(id)}
                            aria-label="Mark skill as used"
                            style={{
                              marginLeft: "auto",
                              marginTop: 2,
                              width: 18,
                              height: 18,
                              accentColor: color,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ textAlign: "center", marginTop: 6 }}>
                    <button type="button" className="restart-btn" onClick={resetAll}>
                      <RotateCcw className="size-4" /> Start Over
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

const SKILLS_PRACTICED: {
  id: string;
  color: string;
  icon: typeof Eye;
  label: ReactNode;
  indent?: boolean;
}[] = [
  {
    id: "skim",
    color: "var(--accent-blue)",
    icon: FastForward,
    label: (
      <>
        <strong>Skim</strong> the reading to get an overview and get the main idea.
      </>
    ),
  },
  {
    id: "scan",
    color: "var(--accent-mint)",
    icon: Search,
    label: (
      <>
        <strong>Scan</strong> in the reading to find the information you need.
      </>
    ),
  },
  {
    id: "activate-background",
    color: "var(--accent-orange)",
    icon: Eye,
    label: (
      <>
        <strong>Activate</strong> your <strong>background knowledge</strong> or{" "}
        <strong>world knowledge</strong> about the topic.
      </>
    ),
  },
  {
    id: "activate-language",
    color: "var(--accent-purple)",
    icon: Brain,
    label: (
      <>
        <strong>Activate</strong> your <strong>knowledge</strong> about{" "}
        <strong>language features</strong> and <strong>devices</strong>.
      </>
    ),
  },
  {
    id: "details",
    color: "var(--accent-pink)",
    icon: BookOpenCheck,
    label: (
      <>
        <strong>Find the details</strong> in the reading to support your understanding.
      </>
    ),
  },
  {
    id: "inferences",
    color: "var(--accent-blue)",
    icon: Puzzle,
    label: (
      <>
        <strong>Make inferences</strong>
      </>
    ),
  },
  {
    id: "contextual",
    color: "var(--accent-yellow)",
    icon: BookOpen,
    indent: true,
    label: "Contextual inference: use surrounding information to guess the meaning of an unknown word.",
  },
  {
    id: "bridging",
    color: "var(--accent-mint)",
    icon: Replace,
    indent: true,
    label: "Bridging inference: link up the information across the text to make an inference.",
  },
  {
    id: "gap-filling",
    color: "var(--accent-orange)",
    icon: Lightbulb,
    indent: true,
    label: "Gap-filling inference: use your background knowledge to fill in the gap and make an inference.",
  },
  {
    id: "reread",
    color: "var(--accent-purple)",
    icon: RotateCcw,
    label: (
      <>
        <strong>Re-read</strong> the relevant parts to confirm your understanding.
      </>
    ),
  },
  {
    id: "compare",
    color: "var(--accent-pink)",
    icon: Scale,
    label: (
      <>
        <strong>Compare</strong> the answers to find the best one.
      </>
    ),
  },
];
