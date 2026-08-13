"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  BookOpen,
  BookOpenCheck,
  Brain,
  Eye,
  FastForward,
  Globe,
  GraduationCap,
  Hash,
  HelpCircle,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  PenLine,
  Puzzle,
  RotateCcw,
  Scale,
  Search,
  Network,
  Star,
  Trophy,
} from "lucide-react";
import Header from "@/components/Header";
import { learningStyles } from "./styles";
import { questions, TOTAL_QUESTIONS, type PartId, type Question } from "./questions";
import { useReadingRecord } from "@/lib/english-reading-record";

type Section = "overview" | "part1" | "part2" | "summary";

interface ModalData {
  emoji: string;
  title: string;
  msg: string;
  ok: boolean;
}

const TABS: { id: Section; label: string; icon: typeof Eye }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "part1", label: "Part 1", icon: Megaphone },
  { id: "part2", label: "Part 2", icon: MessagesSquare },
  { id: "summary", label: "Summary", icon: Trophy },
];

export default function EnglishReadingComprehensionLearningPage() {
  const [section, setSection] = useState<Section>("overview");
  const [answered, setAnswered] = useState<Record<number, string>>({});
  const [hints, setHints] = useState<Record<number, boolean>>({});
  const [strategies, setStrategies] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState<Record<PartId, number>>({ part1: 0, part2: 0 });
  const [activeClues, setActiveClues] = useState<{ ids: string[]; badge: string }>({
    ids: [],
    badge: "",
  });
  const [modal, setModal] = useState<ModalData | null>(null);
  const [skillChecks, setSkillChecks] = useState<Record<string, boolean>>({});
  const { clearRecord } = useReadingRecord({
    readingId: "cycle-1-reading-1",
    title: "Cycle 1 · Reading 1: Sunshine Ice-cream Webpage",
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

  const handleAnswer = useCallback(
    (q: Question, val: string) => {
      if (answered[q.id]) return;
      setAnswered((prev) => ({ ...prev, [q.id]: val }));
      if (val === q.answer) {
        setModal({
          emoji: "🎉",
          title: "Correct!",
          msg: "Well done! You found the right answer.",
          ok: true,
        });
      } else {
        setModal({
          emoji: "🤔",
          title: "Not quite!",
          msg: "The correct answer is highlighted in green. Read the explanation below.",
          ok: false,
        });
      }
      highlightClues(q);
    },
    [answered, highlightClues],
  );

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
    setStep({ part1: 0, part2: 0 });
    clearHighlights();
    setSection("overview");
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [clearHighlights]);

  const part1Done = answered[1] && answered[2] && answered[3];
  const part2Done = answered[4] && answered[5] && answered[6];
  const allDone = Object.keys(answered).length === TOTAL_QUESTIONS;

  const isTabCompleted = (id: Section) => {
    if (id === "part1") return Boolean(part1Done);
    if (id === "part2") return Boolean(part2Done);
    if (id === "summary") return allDone;
    return false;
  };

  const summaryMsg =
    score === 6
      ? "Perfect score! You're a reading superstar!"
      : score >= 4
        ? "Great job! Keep up the good work!"
        : score >= 2
          ? "Good effort! Review the answers and try again."
          : "Keep practicing — use the hints to help you next time!";

  // Render a clue span that glows when active.
  const clueClass = (id: string) =>
    `highlight-clue${activeClues.ids.includes(id) ? " glow" : ""}${
      activeClues.badge === id ? " clue-badge" : ""
    }`;
  const setClueRef = (id: string) => (el: HTMLElement | null) => {
    clueRefs.current[id] = el;
  };
  const simActive = (part: "part1" | "part2") =>
    `webpage-sim${
      section === part && activeClues.ids.length > 0 ? " clue-active" : ""
    }`;

  function renderQuestions(part: "part1" | "part2") {
    const list = questions.filter((q) => q.part === part);
    const current = step[part];
    const currentQ = list[current];
    const currentAnswered = currentQ ? Boolean(answered[currentQ.id]) : false;
    const isLast = current >= list.length - 1;
    return (
      <>
        <div className="q-progress">
          <span className="q-progress-label">
            Question {Math.min(current + 1, list.length)} of {list.length}
          </span>
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
          const cardClass = picked
            ? picked === q.answer
              ? "question-card answered-correct"
              : "question-card answered-wrong"
            : "question-card";
          return (
            <div className={cardClass} key={q.id}>
              <div className="q-number">Question {q.id}</div>
              <div className="q-text">{q.text}</div>
              <ul className="options-list">
                {q.options.map((opt) => {
                  let cls = "option-btn";
                  if (picked) {
                    cls += " disabled";
                    if (opt.val === q.answer) cls += " correct";
                    else if (opt.val === picked) cls += " wrong";
                  }
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
              {picked && <div className="explain-box">{q.explain}</div>}
            </div>
          );
        })}
        {(current > 0 || (currentAnswered && !isLast)) && (
          <div className="q-nav-row">
            {current > 0 ? (
              <button
                type="button"
                className="q-nav-btn back"
                onClick={() => goBackStep(part)}
              >
                <ArrowLeft className="size-4" /> Previous
              </button>
            ) : (
              <span />
            )}
            {currentAnswered && !isLast ? (
              <button
                type="button"
                className="q-nav-btn next"
                onClick={() => advanceStep(part)}
              >
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

  return (
    <>
      <Header backHref="/english/reading-comprehension/modes" backLabel="Back" />

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="rc-learning">
          <style dangerouslySetInnerHTML={{ __html: learningStyles }} />

          <div className="app-shell">
            {/* Header */}
            <div className="app-header">
              <h1>
                <BookOpenCheck className="size-6" /> Cycle 1 — Reading 1: Sunshine Ice-cream Webpage
              </h1>
            </div>

            {/* Tabs */}
            <div className="nav-tabs">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`nav-tab${section === id ? " active" : ""}`}
                  onClick={() => switchSection(id)}
                >
                  <Icon className="size-3.5" /> {label}
                  {isTabCompleted(id) ? " ✓" : ""}
                </button>
              ))}
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
                        <HelpCircle className="size-4" /> How many parts are there in the webpage?
                      </li>
                      <li>
                        <HelpCircle className="size-4" /> Is the ice-cream shop in Hong Kong?
                      </li>
                    </ul>
                  </div>

                  {/* Full article preview */}
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-pink),var(--accent-orange))",
                        }}
                      >
                        <Globe className="size-4" />
                      </span>
                      The Webpage
                    </div>
                    <div className="webpage-sim">
                      <div className="webpage-topbar">
                        <span className="browser-dot r" />
                        <span className="browser-dot y" />
                        <span className="browser-dot g" />
                        <div className="url-bar">www.sunshineicecream.com.hk</div>
                      </div>
                      <div className="webpage-body">
                        <div className="ad-header">
                          <div className="ice-cream-deco">🌅🍦🏝️</div>
                          <h2>Welcome to the Tropical Wonderland!</h2>
                          <p className="ad-title">Enjoy the Tropical Sunshine Ice-cream</p>
                          <p className="ad-subtitle">
                            a mix of pineapple, banana, mango and passionfruit flavours
                          </p>
                        </div>
                        <div className="price-grid">
                          <div className="price-card">
                            <div className="label">Minicup</div>
                            <div className="price">$38</div>
                          </div>
                          <div className="price-card">
                            <div className="label">Stickbar</div>
                            <div className="price">$48</div>
                          </div>
                          <div className="price-card">
                            <div className="label">Family Pack</div>
                            <div className="price">$108</div>
                          </div>
                        </div>
                        <div className="special-banner">
                          <h3>Special Offer</h3>
                          <p>
                            (for the Tai Po branch only)
                            <br />
                            10–16 August
                            <br />
                            Buy 1 minicup and get 1 minicup FREE!
                          </p>
                        </div>
                        <div className="gift-banner">
                          🎁 <strong>FREE GIFT</strong> — Spend over $300 from 10–12 August to get a
                          pair of sunglasses for FREE! 😎
                        </div>
                        <div style={{ marginTop: 14 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              marginBottom: 6,
                              color: "var(--text-primary)",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <MessageCircle
                              className="size-3.5"
                              style={{ color: "var(--accent-purple)" }}
                            />
                            Customer Reviews:
                            <span
                              style={{
                                marginLeft: "auto",
                                fontWeight: 500,
                                color: "var(--text-secondary)",
                              }}
                            >
                              4 out of 100 reviews
                            </span>
                          </div>
                          {OVERVIEW_COMMENTS.map((c) => (
                            <div className="comment-item" key={c.user}>
                              <div className="comment-meta">
                                <span className="comment-user">{c.user}</span>
                                <span className="comment-date">{c.date}</span>
                              </div>
                              <p className="comment-text">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
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
                  {/* LEFT: Article */}
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
                          <Megaphone className="size-4" />
                        </span>
                        Part 1
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> Does the Tropical Sunshine Ice-cream
                          taste fruity?
                        </li>
                        <li>
                          <HelpCircle className="size-4" /> Is there any special offer?
                        </li>
                        <li>
                          <HelpCircle className="size-4" /> Is there any free gift?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      <div className={simActive("part1")}>
                        <div className="webpage-topbar">
                          <span className="browser-dot r" />
                          <span className="browser-dot y" />
                          <span className="browser-dot g" />
                          <div className="url-bar">www.sunshineicecream.com.hk</div>
                        </div>
                        <div className="webpage-body">
                          <div className="ad-header">
                            <div className="ice-cream-deco">🌅🍦🏝️</div>
                            <h2>Welcome to the Tropical Wonderland!</h2>
                            <p className="ad-title">Enjoy the Tropical Sunshine Ice-cream</p>
                            <p className="ad-subtitle">
                              a mix of{" "}
                              <span className={clueClass("q1")} ref={setClueRef("q1")}>
                                pineapple, banana, mango and passionfruit
                              </span>{" "}
                              flavours
                            </p>
                          </div>
                          <div className="price-grid">
                            <div className="price-card">
                              <div className="label">Minicup</div>
                              <div className="price">$38</div>
                            </div>
                            <div className="price-card">
                              <div className="label">Stickbar</div>
                              <div className="price">$48</div>
                            </div>
                            <div className="price-card">
                              <div className="label">Family Pack</div>
                              <div className="price">$108</div>
                            </div>
                          </div>
                          <div className="special-banner">
                            <h3>Special Offer</h3>
                            <p>
                              <span className={clueClass("q2")} ref={setClueRef("q2")}>
                                (for the Tai Po branch only)
                              </span>
                              <br />
                              <span className={clueClass("q3")} ref={setClueRef("q3")}>
                                10–16 August
                              </span>
                              <br />
                              Buy 1 minicup and get 1 minicup FREE!
                            </p>
                          </div>
                          <div className="gift-banner">
                            🎁 <strong>FREE GIFT</strong> — Spend over $300 from 10–12 August to get
                            a pair of sunglasses for FREE! 😎
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* RIGHT: Questions */}
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
                  {/* LEFT: Comments */}
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
                              "linear-gradient(135deg,var(--accent-purple),var(--accent-pink))",
                          }}
                        >
                          <MessagesSquare className="size-4" />
                        </span>
                        Part 2
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> How many people have written comments on
                          the webpage?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      <div className={simActive("part2")}>
                        <div className="webpage-topbar">
                          <span className="browser-dot r" />
                          <span className="browser-dot y" />
                          <span className="browser-dot g" />
                          <div className="url-bar">www.sunshineicecream.com.hk — Comments</div>
                        </div>
                        <div className="webpage-body">
                          <div className="comment-item">
                            <div className="comment-meta">
                              <span className="comment-user">Vicky2026</span>
                              <span className="comment-date">20 Aug 2026</span>
                            </div>
                            <p className="comment-text">
                              I like chocolate and strawberry flavours more. I prefer the{" "}
                              <span className={clueClass("q4")} ref={setClueRef("q4")}>
                                ordinary
                              </span>{" "}
                              flavours to the{" "}
                              <span className={clueClass("q4b")} ref={setClueRef("q4b")}>
                                strange
                              </span>{" "}
                              new mix.
                            </p>
                          </div>
                          <div className="comment-item">
                            <div className="comment-meta">
                              <span className="comment-user">Rebecca01</span>
                              <span className="comment-date">15 Aug 2026</span>
                            </div>
                            <p className="comment-text">
                              <span className={clueClass("q6")} ref={setClueRef("q6")}>
                                I&apos;m coming back for more!
                              </span>
                            </p>
                          </div>
                          <div className="comment-item">
                            <div className="comment-meta">
                              <span className="comment-user">Vera123</span>
                              <span className="comment-date">11 Aug 2026</span>
                            </div>
                            <p className="comment-text">Smells good, but tastes...</p>
                          </div>
                          <div className="comment-item">
                            <div className="comment-meta">
                              <span className="comment-user">HappyPeter</span>
                              <span className="comment-date">10 Aug 2026</span>
                            </div>
                            <p className="comment-text">
                              I ordered a family pack online. When I opened the delivery bag…{" "}
                              <span className={clueClass("q5")} ref={setClueRef("q5")}>
                                Yuck!
                              </span>{" "}
                              <span className={clueClass("q5c")} ref={setClueRef("q5c")}>
                                What a mess!
                              </span>{" "}
                              The ice-cream has already{" "}
                              <span className={clueClass("q5b")} ref={setClueRef("q5b")}>
                                melted
                              </span>
. It should be called &apos;
                              <span className={clueClass("q5d")} ref={setClueRef("q5d")}>
                                Tropical Cyclone Ice-cream
                              </span>
                              &apos; instead!
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* RIGHT: Questions */}
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
                        >
                          View Summary <Trophy className="size-4" />
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
                    <h2>Great Job!</h2>
                    <p>You&apos;ve completed Reading 1 for Level 1!</p>
                    <div className="final-score">
                      {score}/{TOTAL_QUESTIONS}
                    </div>
                    <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
                      {summaryMsg}
                    </p>
                  </div>
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-mint),var(--accent-blue))",
                        }}
                      >
                        <Star className="size-4" />
                      </span>
                      Reading Skills You Practiced
                    </div>
                    <ul className="summary-skills">
                      {SKILLS_PRACTICED.map(({ id, color, icon: Icon, label, indent }) => (
                        <li
                          key={id}
                          style={indent ? { marginLeft: 30 } : undefined}
                        >
                          <span className="skill-icon" style={{ background: color }}>
                            <Icon className="size-3" />
                          </span>
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={!!skillChecks[id]}
                            onChange={() => toggleSkill(id)}
                            aria-label="Mark skill as practiced"
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

          {/* Modal */}
          {modal && (
            <div className="modal-overlay" onClick={() => setModal(null)}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-emoji">{modal.emoji}</div>
                <div className="modal-title">{modal.title}</div>
                <div className="modal-msg">{modal.msg}</div>
                <button
                  type="button"
                  className={`modal-ok ${modal.ok ? "green" : "pink"}`}
                  onClick={() => setModal(null)}
                >
                  Got it!
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const OVERVIEW_COMMENTS = [
  {
    user: "Vicky2026",
    date: "20 Aug 2026",
    text: "I like chocolate and strawberry flavours more. I prefer the ordinary flavours to the strange new mix.",
  },
  { user: "Rebecca01", date: "15 Aug 2026", text: "I'm coming back for more!" },
  { user: "Vera123", date: "11 Aug 2026", text: "Smells good, but tastes..." },
  {
    user: "HappyPeter",
    date: "10 Aug 2026",
    text: "I ordered a family pack online. When I opened the delivery bag… Yuck! What a mess! The ice-cream has already melted. It should be called 'Tropical Cyclone Ice-cream' instead!",
  },
];

const SKILLS_PRACTICED: {
  id: string;
  color: string;
  icon: typeof Eye;
  label: React.ReactNode;
  indent?: boolean;
}[] = [
  {
    id: "skim",
    color: "var(--accent-blue)",
    icon: FastForward,
    label: (
      <>
        <strong>Skim</strong> the reading to have a general impression and get the main idea.
      </>
    ),
  },
  {
    id: "structure",
    color: "var(--accent-mint)",
    icon: Network,
    label: "Understand the titles and the structure of the text.",
  },
  {
    id: "scan",
    color: "var(--accent-orange)",
    icon: Search,
    label: (
      <>
        <strong>Scan</strong> in the reading to find the information you need.
      </>
    ),
  },
  {
    id: "keywords",
    color: "var(--accent-purple)",
    icon: MapPin,
    label: "Find the keywords and topic sentences.",
  },
  {
    id: "activate",
    color: "var(--accent-yellow)",
    icon: Eye,
    label: (
      <>
        <strong>Activate</strong> your <strong>background knowledge</strong> (or{" "}
        <strong>world knowledge</strong>) about the topic.
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
    id: "numerical",
    color: "var(--accent-purple)",
    icon: Hash,
    indent: true,
    label: (
      <>
        <strong>Numerical reasoning:</strong> work out something related to numbers, dates and time
        relations, etc.
      </>
    ),
  },
  {
    id: "contextual",
    color: "var(--accent-yellow)",
    icon: Book,
    indent: true,
    label: (
      <>
        <strong>Contextual inference:</strong> use surrounding information to guess the meaning of
        an unknown word.
      </>
    ),
  },
  {
    id: "interpret",
    color: "var(--accent-mint)",
    icon: Brain,
    label: (
      <>
        <strong>Interpret</strong> intentions, opinions, attitudes and feelings expressed in the
        text.
      </>
    ),
  },
  {
    id: "reread",
    color: "var(--accent-orange)",
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
