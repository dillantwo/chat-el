"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  BookOpen,
  BookOpenCheck,
  Brain,
  Eye,
  FastForward,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Info,
  Lightbulb,
  ListOrdered,
  Lock,
  PenLine,
  Puzzle,
  Replace,
  RotateCcw,
  Scale,
  ScrollText,
  Search,
  ShieldAlert,
  Star,
  Trophy,
} from "lucide-react";
import Header from "@/components/Header";
import { basePath } from "@/lib/utils";
import { learningStyles } from "../../learning/styles";
import { questions, TOTAL_QUESTIONS, type PartId, type Question } from "./questions";
import { useReadingRecord } from "@/lib/english-reading-record";

type Section = "overview" | "part1" | "part2" | "part3" | "summary";

const TABS: { id: Section; label: string; icon: typeof Eye }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "part1", label: "Part 1", icon: Beaker },
  { id: "part2", label: "Part 2", icon: ListOrdered },
  { id: "part3", label: "Part 3", icon: ScrollText },
  { id: "summary", label: "Summary", icon: Trophy },
];

// Extra styles for the "Make a Balloon Puff Up" experiment sheet.
const sheetStyles = `
.rc-learning .sheet { background: #FEFEFE; border: 2px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; transition: border-color 0.4s ease, box-shadow 0.4s ease; }
.rc-learning .sheet.clue-active { border-color: var(--accent-orange) !important; box-shadow: 0 0 20px rgba(255,140,66,0.2); }
.rc-learning .sheet-inner { padding: 16px 18px 18px; }
.rc-learning .steps-block { background: #F2F7FC; border-radius: var(--radius-sm); padding: 12px 16px 16px; margin: 14px -18px -18px; }
.rc-learning .steps-block > .sheet-h:first-child { margin-top: 0; }
.rc-learning .sheet-title { text-align: center; font-weight: 800; font-size: 21px; color: var(--text-primary); }
.rc-learning .sheet-h { font-weight: 700; font-size: 15px; color: var(--accent-blue); margin: 14px 0 6px; }
.rc-learning .mat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.rc-learning .mat-grid li { list-style: none; font-size: 13.5px; line-height: 1.7; color: var(--text-secondary); padding: 2px 0; display: flex; align-items: flex-start; gap: 8px; }
.rc-learning .mat-grid li .dot { color: var(--accent-blue); font-weight: 800; }
.rc-learning .safety-box { background: rgba(255,140,66,0.08); border-radius: var(--radius-sm); padding: 8px 12px; margin-top: 8px; font-size: 13px; line-height: 1.7; color: var(--text-secondary); display: flex; gap: 8px; align-items: flex-start; }
.rc-learning .safety-box svg { color: var(--accent-orange); flex-shrink: 0; margin-top: 2px; }
.rc-learning .steps-list { margin: 0; padding-left: 24px; list-style: decimal outside; }
.rc-learning .steps-list li { font-size: 13.5px; line-height: 1.7; color: var(--text-secondary); padding: 2px 0; }
.rc-learning .steps-list li::marker { color: var(--accent-blue); font-weight: 700; }
.rc-learning .how-text, .rc-learning .tip-text { font-size: 13.5px; line-height: 1.7; color: var(--text-secondary); margin: 4px 0 0; }
.rc-learning .how-text > .highlight-clue { padding-left: 0; }
.rc-learning .tip-text { font-style: italic; }
.rc-learning .mat-grid.with-images li { align-items: center; min-height: 42px; }
.rc-learning .mat-grid.with-images li { justify-content: flex-start; }
.rc-learning .mat-img { margin-left: 12px; height: 40px; width: auto; max-width: 70px; object-fit: contain; flex-shrink: 0; }
.rc-learning .safety-img { margin-left: auto; height: 36px; width: auto; object-fit: contain; flex-shrink: 0; align-self: center; }
.rc-learning .puff-figure { float: right; width: 96px; margin: 0 4px 10px 16px; }
.rc-learning .puff-figure img { width: 100%; height: auto; object-fit: contain; }

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

export default function EnglishReadingComprehensionCycle3Reading2LearningPage() {
  const [section, setSection] = useState<Section>("overview");
  const [answered, setAnswered] = useState<Record<number, string>>({});
  const [hints, setHints] = useState<Record<number, boolean>>({});
  const [strategies, setStrategies] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState<Record<PartId, number>>({ part1: 0, part2: 0, part3: 0 });
  const [activeClues, setActiveClues] = useState<{ ids: string[]; badge: string }>({
    ids: [],
    badge: "",
  });
  const [skillChecks, setSkillChecks] = useState<Record<string, boolean>>({});
  const { clearRecord } = useReadingRecord({
    readingId: "cycle-3-reading-2",
    title: "Cycle 3 · Reading 2: Make a Balloon Puff Up",
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
    setStep({ part1: 0, part2: 0, part3: 0 });
    clearHighlights();
    setSection("overview");
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [clearHighlights]);

  // Part 1 covers Q1–Q2 (materials & safety); Part 2 covers Q3–Q5 (steps & how
  // it works); Part 3 covers Q6 (the whole text / text type).
  const part1Done = answered[1] && answered[2];
  const part2Done = answered[3] && answered[4] && answered[5];
  const part3Done = answered[6];
  const allDone = Object.keys(answered).length === TOTAL_QUESTIONS;

  const isTabCompleted = (id: Section) => {
    if (id === "part1") return Boolean(part1Done);
    if (id === "part2") return Boolean(part2Done);
    if (id === "part3") return Boolean(part3Done);
    if (id === "summary") return allDone;
    return false;
  };

  // Tabs unlock in order: Overview → Part 1 → Part 2 → Part 3 → Summary.
  const isTabUnlocked = (id: Section) => {
    if (id === "overview" || id === "part1") return true;
    if (id === "part2") return Boolean(part1Done);
    if (id === "part3") return Boolean(part2Done);
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
  const sheetActive = (part: PartId) =>
    `sheet${section === part && activeClues.ids.length > 0 ? " clue-active" : ""}`;

  function renderQuestions(part: PartId) {
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
              <ul className="options-list">
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

  // Small helper for the experiment-sheet illustrations in public/english.
  const sheetImg = (file: string, alt: string, className: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={`${basePath}/english/${encodeURIComponent(file)}`} alt={alt} />
  );

  // Materials list used in the overview preview and Part 1. When `withImages`
  // is set, each item shows its illustration (used in the overview).
  const materials = (withClues: boolean, withImages = false) => (
    <>
      <div className="sheet-h">
        {withClues ? (
          <span className={clueClass("q6")} ref={setClueRef("q6")}>
            Materials:
          </span>
        ) : (
          "Materials:"
        )}
      </div>
      <ul className={`mat-grid${withImages ? " with-images" : ""}`}>
        <li>
          <span className="dot">•</span> vinegar
          {withImages && sheetImg("vinegar.png", "A bottle of vinegar", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span> baking soda
          {withImages && sheetImg("soda.png", "A box of baking soda", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span> a small plastic bottle
          {withImages && sheetImg("bottle.png", "A small plastic bottle", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span> a funnel
          {withImages && sheetImg("funnel.png", "A funnel", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span> a spoon
          {withImages && sheetImg("spoon.png", "A spoon", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span> a tray
          {withImages && sheetImg("tray.png", "A tray", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span> a balloon
          {withImages && sheetImg("a ballon.png", "A balloon", "mat-img")}
        </li>
        <li>
          <span className="dot">•</span>{" "}
          {withClues ? (
            <span className={clueClass("q1")} ref={setClueRef("q1")}>
              a rubber band (helpful if you have one)
            </span>
          ) : (
            "a rubber band (helpful if you have one)"
          )}
          {withImages && sheetImg("rubber.png", "A rubber band", "mat-img")}
        </li>
      </ul>
    </>
  );

  const safety = (withClues: boolean, withImages = false) => (
    <div className="safety-box">
      <ShieldAlert className="size-4" />
      <span>
        <strong>
          {withClues ? (
            <span className={clueClass("q6")} ref={setClueRef("q6safety")}>
              Safety:
            </span>
          ) : (
            "Safety:"
          )}
        </strong>{" "}
        {withClues ? (
          <span className={clueClass("q2")} ref={setClueRef("q2")}>
            Ask an adult to help you.
          </span>
        ) : (
          "Ask an adult to help you."
        )}{" "}
        Wear safety goggles. If something gets in your eyes, wash them with clean water.
      </span>
      {withImages && sheetImg("goggles.png", "A pair of safety goggles", "safety-img")}
    </div>
  );

  // Steps / How It Works / Tip used in the preview and Part 2. When
  // `withImages` is set, the puffed-up balloon illustration is shown.
  const steps = (withClues: boolean, withImages = false) => (
    <div className="steps-block">
      <div className="sheet-h">
        {withClues ? (
          <span className={clueClass("q6")} ref={setClueRef("q6steps")}>
            Steps:
          </span>
        ) : (
          "Steps:"
        )}
      </div>
      <ol className="steps-list">
        <li>Put the plastic bottle on the tray.</li>
        <li>Pour some vinegar into the bottle.</li>
        <li>Take some baking soda with the spoon. Use the funnel to put the baking soda into the balloon.</li>
        <li>
          {withClues ? (
            <span className={clueClass("q3")} ref={setClueRef("q3")}>
              Carefully stretch the mouth of the balloon and wrap it around the neck of the bottle.
            </span>
          ) : (
            "Carefully stretch the mouth of the balloon and wrap it around the neck of the bottle."
          )}{" "}
          Do not let the baking soda fall into the bottle yet!
        </li>
        <li>Hold the mouth of the balloon tightly. Use the rubber band to tie it if you have one.</li>
        <li>When you are ready, lift the balloon so the baking soda drops into the bottle.</li>
        <li>Watch the balloon. What happens?</li>
      </ol>
      {withImages && (
        <div className="puff-figure">
          {sheetImg("mix bottle.png", "A balloon puffing up on top of a bottle", "")}
        </div>
      )}
      <div className="sheet-h">
        {withClues ? (
          <span className={clueClass("q6")} ref={setClueRef("q6how")}>
            How It Works:
          </span>
        ) : (
          "How It Works:"
        )}
      </div>
      <p className="how-text">
        {withClues ? (
          <span className={clueClass("q4")} ref={setClueRef("q4")}>
            When baking soda and vinegar mix, you can see some bubbles. This is a chemical
            reaction. It makes a gas called carbon dioxide. The gas moves into the balloon and makes
            it puff up!
          </span>
        ) : (
          "When baking soda and vinegar mix, you can see some bubbles. This is a chemical reaction. It makes a gas called carbon dioxide. The gas moves into the balloon and makes it puff up!"
        )}
      </p>
      <div className="sheet-h">
        {withClues ? (
          <span className={clueClass("q6")} ref={setClueRef("q6tip")}>
            Tip:
          </span>
        ) : (
          "Tip:"
        )}
      </div>
      <p className="tip-text">
        {withClues ? (
          <span className={clueClass("q5")} ref={setClueRef("q5")}>
            Try using more or less baking soda and vinegar next time. What will be different?
          </span>
        ) : (
          "Try using more or less baking soda and vinegar next time. What will be different?"
        )}
      </p>
    </div>
  );

  const sheetTop = (
    <div className={sheetActive("part1")}>
      <div className="sheet-inner">
        <div className="sheet-title">Make a Balloon Puff Up</div>
        {materials(true, true)}
        {safety(true, true)}
      </div>
    </div>
  );

  const sheetBottom = (
    <div className={sheetActive("part2")}>
      <div className="sheet-inner">{steps(true, true)}</div>
    </div>
  );

  // Part 3 shows the whole sheet with clue highlighting (so Q6's clue glows).
  const sheetWhole = (
    <div className={sheetActive("part3")}>
      <div className="sheet-inner">
        <div className="sheet-title">Make a Balloon Puff Up</div>
        {materials(true, true)}
        {safety(true, true)}
        {steps(true, true)}
      </div>
    </div>
  );

  // The complete, plain (no clue highlighting) sheet. Reused by the Overview
  // preview and the Summary's side-by-side Answer Review.
  const fullSheet = (
    <div className="sheet">
      <div className="sheet-inner">
        <div className="sheet-title">Make a Balloon Puff Up</div>
        {materials(false, true)}
        {safety(false, true)}
        {steps(false, true)}
      </div>
    </div>
  );

  return (
    <>
      <Header backHref="/english/reading-comprehension/cycle-3-reading-2" backLabel="Back" />

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="rc-learning">
          <style dangerouslySetInnerHTML={{ __html: learningStyles + sheetStyles }} />

          <div className="app-shell">
            {/* Header */}
            <div className="app-header">
              <h1>
                <BookOpenCheck className="size-6" /> Cycle 3 — Reading 2: Make a Balloon Puff Up (Experiment)
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
                      Pre-reading Question
                    </div>
                    <ul className="pre-reading-list">
                      <li>
                        <HelpCircle className="size-4" /> What is the title of the experiment?
                      </li>
                    </ul>
                  </div>

                  {/* Full sheet preview */}
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-pink),var(--accent-mint))",
                        }}
                      >
                        <FlaskConical className="size-4" />
                      </span>
                      The Experiment Sheet
                    </div>
                    {fullSheet}
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
                          <Beaker className="size-4" />
                        </span>
                        Part 1
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> How many kinds of materials are needed
                          for this experiment?
                        </li>
                        <li>
                          <HelpCircle className="size-4" /> What do you need to wear for this
                          experiment?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {sheetTop}
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
                          <ListOrdered className="size-4" />
                        </span>
                        Part 2
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> How many steps are there in this
                          experiment?
                        </li>
                        <li>
                          <HelpCircle className="size-4" /> What makes the balloon puff up?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {sheetBottom}
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
                          onClick={() => switchSection("part3")}
                          style={{
                            background:
                              "linear-gradient(135deg,var(--accent-blue),var(--accent-mint))",
                          }}
                        >
                          Continue to Part 3 <ArrowRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PART 3 */}
            {section === "part3" && (
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
                              "linear-gradient(135deg,var(--accent-mint),var(--accent-blue))",
                          }}
                        >
                          <ScrollText className="size-4" />
                        </span>
                        Part 3
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> Read the whole text again. Where would
                          you find this text?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {sheetWhole}
                    </div>
                  </div>
                  <div className="split-right">
                    <div className="pane-label questions">
                      <PenLine className="size-3.5" /> Questions
                    </div>
                    {renderQuestions("part3")}
                    {allDone && (
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
                    <h2>Reading 2 Completed!</h2>
                    <p>You have just completed Cycle 3 — Reading 2: Make a Balloon Puff Up.</p>
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
                      {fullSheet}
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
    label:
      "Contextual inference: use surrounding information to guess the meaning of an unknown word.",
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
    label:
      "Gap-filling inference: use your background knowledge to fill in the gap and make an inference.",
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
