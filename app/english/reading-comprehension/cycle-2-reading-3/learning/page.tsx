"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Brain,
  Eye,
  FastForward,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  PenLine,
  Puzzle,
  Quote,
  Replace,
  RotateCcw,
  Scale,
  School,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import Header from "@/components/Header";
import { learningStyles } from "../../learning/styles";
import { questions, TOTAL_QUESTIONS, type PartId, type Question } from "./questions";
import { useReadingRecord } from "@/lib/english-reading-record";

type Section = "overview" | "part1" | "part2" | "part3" | "summary";

const TABS: { id: Section; label: string; icon: typeof Eye }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "part1", label: "Part 1", icon: School },
  { id: "part2", label: "Part 2", icon: MapPin },
  { id: "part3", label: "Part 3", icon: Mail },
  { id: "summary", label: "Summary", icon: Trophy },
];

// Extra styles for the email layout.
const emailStyles = `
.rc-learning .email { background: var(--bg-article); border: 2px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; transition: border-color 0.4s ease, box-shadow 0.4s ease; }
.rc-learning .email.clue-active { border-color: var(--accent-orange) !important; box-shadow: 0 0 20px rgba(255,140,66,0.2); }
.rc-learning .email-head { background: linear-gradient(90deg,#f0f0f0,#e8e8e8); border-bottom: 1px solid var(--border-light); padding: 9px 12px; }
.rc-learning .email-row { display: flex; gap: 8px; padding: 2px 0; font-size: 12px; color: var(--text-secondary); }
.rc-learning .email-label { font-weight: 700; color: var(--text-muted); min-width: 50px; }
.rc-learning .email-body { padding: 14px 16px; }
.rc-learning .email-body p { font-size: 13.5px; line-height: 1.85; color: var(--text-secondary); margin: 0 0 11px; }
.rc-learning .email-body p:last-child { margin-bottom: 0; }
.rc-learning .email-greeting { font-weight: 600; color: var(--text-primary); }
.rc-learning .email-sign { margin-top: 2px; font-weight: 600; color: var(--text-primary); }

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

export default function EnglishReadingComprehensionCycle2Reading3LearningPage() {
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
    readingId: "cycle-2-reading-3",
    title: "Cycle 2 · Reading 3: An Email",
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

  // Part 1 covers Q1–Q4 (school days); Part 2 covers Q5–Q6 (sightseeing);
  // Part 3 covers Q7–Q8 (the whole email).
  const part1Done = answered[1] && answered[2] && answered[3] && answered[4];
  const part2Done = answered[5] && answered[6];
  const part3Done = answered[7] && answered[8];
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
      : score >= 6
        ? "Great job! Keep up the good work!"
        : score >= 3
          ? "Good effort! Review the answers and try again."
          : "Keep practicing — use the hints to help you next time!";

  const clueClass = (id: string) =>
    `highlight-clue${activeClues.ids.includes(id) ? " glow" : ""}${
      activeClues.badge === id ? " clue-badge" : ""
    }`;
  const setClueRef = (id: string) => (el: HTMLElement | null) => {
    clueRefs.current[id] = el;
  };
  const emailActive = (part: PartId) =>
    `email${section === part && activeClues.ids.length > 0 ? " clue-active" : ""}`;

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

  const emailHead = (
    <div className="email-head">
      <div className="email-row">
        <span className="email-label">From</span>
        <span>susan123321@mail.com.hk</span>
      </div>
      <div className="email-row">
        <span className="email-label">To</span>
        <span>rebeccawong@mail.com.hk</span>
      </div>
      <div className="email-row">
        <span className="email-label">Subject</span>
        <span />
      </div>
    </div>
  );

  // Part 1 — school days (Q1–Q4).
  const emailPart1 = (
    <div className={emailActive("part1")}>
      {emailHead}
      <div className="email-body">
        <p className="email-greeting">Hi Rebecca,</p>
        <p>
          How are you? How&apos;s your family?{" "}
          <span className={clueClass("q1")} ref={setClueRef("q1")}>
            I want to tell you about my graduation school study tour.
          </span>{" "}
          I came back from Iceland yesterday, and I had a wonderful time there.
        </p>
        <p>
          On the first day, we visited a local school in Reykjavík. In the morning, we had to stand
          up and introduce ourselves.{" "}
          <span className={clueClass("q2")} ref={setClueRef("q2")}>
            When my turn came, I could not speak and I was shaking like a leaf. The students smiled
            and clapped their hands to encourage me.
          </span>{" "}
          <span className={clueClass("q3")} ref={setClueRef("q3")}>
            After that, we played games together and I made a few new Icelandic friends.
          </span>
        </p>
        <p>
          The second day was also interesting. We joined lessons with the local students. I sat in
          their English and Maths classes.{" "}
          <span className={clueClass("q4")} ref={setClueRef("q4")}>
            I learnt about their school life and what they did after school.
          </span>{" "}
          We were quite different, but we also had something in common. We all liked music.
        </p>
      </div>
    </div>
  );

  // Part 2 — sightseeing (Q5–Q6). No email header here; content only.
  const emailPart2 = (
    <div className={emailActive("part2")}>
      <div className="email-body">
        <p>
          We visited some famous places. On the third day, we went to Perlan and enjoyed the
          beautiful city view. Later, we went on a boat for a whale and puffin watching tour. It was
          awesome!{" "}
          <span className={clueClass("q5")} ref={setClueRef("q5")}>
            We saw whales breaching the surface. They were beautiful! I bought a postcard of one for
            you.
          </span>{" "}
          <span className={clueClass("q6")} ref={setClueRef("q6")}>
            Sadly, I did not see any puffins. It was not the right season yet.
          </span>
        </p>
        <p>
          On the last day, we went to the Reykjavík Family Park and Zoo. We saw reindeer, seals and
          Arctic foxes. Before we went to the airport, we had Icelandic hot dogs. They were
          delicious.
        </p>
      </div>
    </div>
  );

  // Part 3 — the whole email (Q7–Q8).
  const emailPart3 = (
    <div className={emailActive("part3")}>
      {emailHead}
      <div className="email-body">
        <p className="email-greeting">Hi Rebecca,</p>
        <p>
          How are you? How&apos;s your family? I want to tell you about my graduation school study
          tour. I came back from Iceland yesterday, and{" "}
          <span className={clueClass("q8")} ref={setClueRef("q8")}>
            I had a wonderful time there.
          </span>
        </p>
        <p>
          On the first day, we visited a local school in Reykjavík. In the morning, we had to stand
          up and introduce ourselves. When my turn came, I could not speak and I was shaking like a
          leaf. The students smiled and clapped their hands to encourage me. After that, we played
          games together and I made a few new Icelandic friends.
        </p>
        <p>
          The second day was also interesting. We joined lessons with the local students. I sat in
          their English and Maths classes. I learnt about their school life and what they did after
          school. We were quite different, but we also had something in common. We all liked music.
        </p>
        <p>
          We visited some famous places. On the third day, we went to Perlan and enjoyed the
          beautiful city view. Later, we went on a boat for a whale and puffin watching tour. It was
          awesome! We saw whales breaching the surface. They were beautiful! I bought a postcard of
          one for you. Sadly, I did not see any puffins. It was not the right season yet.
        </p>
        <p>
          On the last day, we went to the Reykjavík Family Park and Zoo. We saw reindeer, seals and
          Arctic foxes. Before we went to the airport, we had Icelandic hot dogs. They were
          delicious.
        </p>
        <p>
          <span className={clueClass("q7")} ref={setClueRef("q7")}>
            I hope we can travel together one day.
          </span>{" "}
          Write back soon and tell me when your next school holiday is.
        </p>
        <p className="email-sign">
          Best wishes,
          <br />
          Susan
        </p>
      </div>
    </div>
  );

  // The complete, plain (no clue highlighting) email. Reused by the Overview
  // preview and the Summary's side-by-side Answer Review.
  const fullEmail = (
    <div className="email">
      {emailHead}
      <div className="email-body">
        <p className="email-greeting">Hi Rebecca,</p>
        <p>
          How are you? How&apos;s your family? I want to tell you about my graduation school study
          tour. I came back from Iceland yesterday, and I had a wonderful time there.
        </p>
        <p>
          On the first day, we visited a local school in Reykjavík. In the morning, we had to stand
          up and introduce ourselves. When my turn came, I could not speak and I was shaking like a
          leaf. The students smiled and clapped their hands to encourage me. After that, we played
          games together and I made a few new Icelandic friends.
        </p>
        <p>
          The second day was also interesting. We joined lessons with the local students. I sat in
          their English and Maths classes. I learnt about their school life and what they did after
          school. We were quite different, but we also had something in common. We all liked music.
        </p>
        <p>
          We visited some famous places. On the third day, we went to Perlan and enjoyed the
          beautiful city view. Later, we went on a boat for a whale and puffin watching tour. It was
          awesome! We saw whales breaching the surface. They were beautiful! I bought a postcard of
          one for you. Sadly, I did not see any puffins. It was not the right season yet.
        </p>
        <p>
          On the last day, we went to the Reykjavík Family Park and Zoo. We saw reindeer, seals and
          Arctic foxes. Before we went to the airport, we had Icelandic hot dogs. They were
          delicious.
        </p>
        <p>
          I hope we can travel together one day. Write back soon and tell me when your next school
          holiday is.
        </p>
        <p className="email-sign">
          Best wishes,
          <br />
          Susan
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Header backHref="/english/reading-comprehension/cycle-2-reading-3" backLabel="Back" />

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="rc-learning">
          <style dangerouslySetInnerHTML={{ __html: learningStyles + emailStyles }} />

          <div className="app-shell">
            {/* Header */}
            <div className="app-header">
              <h1>
                <BookOpenCheck className="size-6" /> Cycle 2 — Reading 3: An Email
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
                        <HelpCircle className="size-4" /> How many paragraphs are there in the email?
                      </li>
                      <li>
                        <HelpCircle className="size-4" /> Who wrote the email?
                      </li>
                      <li>
                        <HelpCircle className="size-4" /> Who is going to receive the email?
                      </li>
                    </ul>
                  </div>

                  {/* Full email preview */}
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-pink),var(--accent-mint))",
                        }}
                      >
                        <Mail className="size-4" />
                      </span>
                      The Email
                    </div>
                    {fullEmail}
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
                          <School className="size-4" />
                        </span>
                        Part 1
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> Did Susan spend only one day in Iceland
                          for her study tour?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {emailPart1}
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
                          <MapPin className="size-4" />
                        </span>
                        Part 2
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> Did Susan visit any famous places or see
                          any animals in Iceland?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {emailPart2}
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
                              "linear-gradient(135deg,var(--accent-yellow),var(--accent-orange))",
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
                          <Mail className="size-4" />
                        </span>
                        Part 3
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> Read the whole email again. What is it
                          mainly about?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {emailPart3}
                    </div>
                  </div>
                  <div className="split-right">
                    <div className="pane-label questions">
                      <PenLine className="size-3.5" /> Questions
                    </div>
                    {renderQuestions("part3")}
                    {part3Done && (
                      <div style={{ textAlign: "center", marginTop: 6 }}>
                        <button
                          type="button"
                          className="restart-btn"
                          onClick={() => switchSection("summary")}
                          style={{
                            background:
                              "linear-gradient(135deg,var(--accent-blue),var(--accent-purple))",
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
                    <h2>Reading 3 Completed!</h2>
                    <p>You have just completed Cycle 2 — Reading 3: A Wonderful School Trip.</p>
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
                      {fullEmail}
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
    icon: Quote,
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
