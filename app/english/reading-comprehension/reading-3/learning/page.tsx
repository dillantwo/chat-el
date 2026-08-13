"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bird,
  Book,
  BookOpen,
  BookOpenCheck,
  Brain,
  Eye,
  FastForward,
  Flame,
  GraduationCap,
  HelpCircle,
  Info,
  Lightbulb,
  Link2,
  Network,
  PenLine,
  Puzzle,
  RotateCcw,
  Scale,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import Header from "@/components/Header";
import { learningStyles } from "../../learning/styles";
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
  { id: "part1", label: "Part 1", icon: Flame },
  { id: "part2", label: "Part 2", icon: Bird },
  { id: "summary", label: "Summary", icon: Trophy },
];

// Extra styles for the story passage.
const reading3Styles = `
.rc-learning .story-doc { background: var(--bg-article); border: 2px solid var(--border-light); border-radius: var(--radius-sm); padding: 8px 14px 14px; transition: border-color 0.4s ease, box-shadow 0.4s ease; }
.rc-learning .story-doc.clue-active { border-color: var(--accent-orange) !important; box-shadow: 0 0 20px rgba(255,140,66,0.2); }
.rc-learning .story-title { text-align: center; font-weight: 800; font-size: 20px; color: var(--text-primary); padding: 6px 4px 10px; }
.rc-learning .story-part-label { display: inline-block; margin: 12px 0 4px; font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--accent-purple); }
.rc-learning .story-part-label:first-child { margin-top: 4px; }
.rc-learning .story-text { font-size: 14px; line-height: 1.9; color: var(--text-primary); margin: 0 0 10px; }
.rc-learning .story-text:last-child { margin-bottom: 0; }
.rc-learning .story-text > .highlight-clue:first-child { padding-left: 0; }
.rc-learning .doc-underline { text-decoration: underline; font-weight: 600; }
`;

export default function EnglishReadingComprehensionReading3LearningPage() {
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
    readingId: "cycle-1-reading-3",
    title: "Cycle 1 · Reading 3: Pip the Dragon",
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

  const clueClass = (id: string) =>
    `highlight-clue${activeClues.ids.includes(id) ? " glow" : ""}${
      activeClues.badge === id ? " clue-badge" : ""
    }`;
  const setClueRef = (id: string) => (el: HTMLElement | null) => {
    clueRefs.current[id] = el;
  };
  const docActive = (part: "part1" | "part2") =>
    `story-doc${section === part && activeClues.ids.length > 0 ? " clue-active" : ""}`;

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
          const cardClass = picked
            ? picked === q.answer
              ? "question-card answered-correct"
              : "question-card answered-wrong"
            : "question-card";
          return (
            <div className={cardClass} key={q.id}>
              <div className="q-number">Question {q.id}</div>
              <div className="q-text">{q.text}</div>
              {q.extra}
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

  // Part 1 of the story (paragraphs 1–3). Clue spans glow on hint/answer.
  const part1Passage = (
    <div className={docActive("part1")}>
      <p className="story-text">
        Once upon a time, a young dragon named Pip came to live near a small village. He lived in a
        cave on the hill. There was always grey smoke above his cave.
      </p>
      <p className="story-text">
        <span className={clueClass("q1")} ref={setClueRef("q1")}>
          Pip had big wings and sharp teeth.
        </span>{" "}
        <span className={clueClass("q1b")} ref={setClueRef("q1b")}>
          &quot;Look at that scary dragon!&quot; the villagers whispered. &quot;He must be
          dangerous!
        </span>{" "}
        I&apos;ve heard that dragons like to burn houses with the fire from their mouths.&quot;
      </p>
      <p className="story-text">
        Opposite to what the villagers thought, Pip was kind.{" "}
        <span className={clueClass("q3")} ref={setClueRef("q3")}>
          He was like sunlight.
        </span>{" "}
        He could make bad weather nice again by flapping his wings.{" "}
        <span className={clueClass("q2")} ref={setClueRef("q2")}>
          He could cure sick plants and animals, and mend broken things
        </span>{" "}
        by breathing fire on them gently. Although Pip was good at magic, he was not confident. He
        usually hid from the villagers.
      </p>
    </div>
  );

  // Part 2 of the story (paragraphs 4–6).
  const part2Passage = (
    <div className={docActive("part2")}>
      <p className="story-text">
        One day, a swan named Greta came to the village. The villagers welcomed her because she
        looked beautiful. Much to their shock, she created a lot of trouble. With her magic, she
        brought a storm. The storm broke the houses and pulled up all the plants. Then, she walked
        near the cows.{" "}
        <span className={clueClass("q4")} ref={setClueRef("q4")}>
          &quot;Moo!&quot; The cows suddenly could not move. The villagers were frightened.
        </span>
      </p>
      <p className="story-text">
        <span className={clueClass("q5")} ref={setClueRef("q5")}>
        Pip came to help.
        </span>{" "}
        He flapped his wings and the storm stopped. He gently breathed fire on the cows. Soon, they
        could walk again. Then he breathed fire on the houses and plants. He stopped all of
        Greta&apos;s evil tricks. Greta was very angry but had to leave the village.{" "}
        <span className={clueClass("q6")} ref={setClueRef("q6")}>
          She knew he could not beat Pip.
        </span>
      </p>
      <p className="story-text">
        The villagers knew that they were wrong about Pip. They became friends with him and welcomed
        him to the village.
      </p>
    </div>
  );

  return (
    <>
      <Header backHref="/english/reading-comprehension/reading-3" backLabel="Back" />

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="rc-learning">
          <style dangerouslySetInnerHTML={{ __html: learningStyles + reading3Styles }} />

          <div className="app-shell">
            {/* Header */}
            <div className="app-header">
              <h1>
                <BookOpenCheck className="size-6" /> Cycle 1 — Reading 3: Pip the Dragon (Story)
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
                        <HelpCircle className="size-4" /> What is the story about?
                      </li>
                      <li>
                        <HelpCircle className="size-4" /> How many paragraphs are there?
                      </li>
                    </ul>
                  </div>

                  {/* Full story preview */}
                  <div className="card">
                    <div className="card-title">
                      <span
                        className="icon"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--accent-pink),var(--accent-mint))",
                        }}
                      >
                        <BookOpen className="size-4" />
                      </span>
                      The Story
                    </div>
                    <div className="story-doc">
                      <div className="story-title">Pip the Dragon</div>
                      <p className="story-text">
                        Once upon a time, a young dragon named Pip came to live near a small village.
                        He lived in a cave on the hill. There was always grey smoke above his cave.
                      </p>
                      <p className="story-text">
                        Pip had big wings and sharp teeth. &quot;Look at that scary dragon!&quot; the
                        villagers whispered. &quot;He must be dangerous! I&apos;ve heard that dragons
                        like to burn houses with the fire from their mouths.&quot;
                      </p>
                      <p className="story-text">
                        Opposite to what the villagers thought, Pip was kind. He was like sunlight. He
                        could make bad weather nice again by flapping his wings. He could cure sick
                        plants and animals, and mend broken things by breathing fire on them gently.
                        Although Pip was good at magic, he was not confident. He usually hid from the
                        villagers.
                      </p>
                      <p className="story-text">
                        One day, a swan named Greta came to the village. The villagers welcomed her
                        because she looked beautiful. Much to their shock, she created a lot of
                        trouble. With her magic, she brought a storm. The storm broke the houses and
                        pulled up all the plants. Then, she walked near the cows. &quot;Moo!&quot; The
                        cows suddenly could not move. The villagers were frightened.
                      </p>
                      <p className="story-text">
                        Pip came to help. He flapped his wings and the storm stopped. He gently
                        breathed fire on the cows. Soon, they could walk again. Then he breathed fire
                        on the houses and plants. He stopped all of Greta&apos;s evil tricks. Greta
                        was very angry but had to leave the village. She knew he could not beat Pip.
                      </p>
                      <p className="story-text">
                        The villagers knew that they were wrong about Pip. They became friends with
                        him and welcomed him to the village.
                      </p>
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
                              "linear-gradient(135deg,var(--accent-orange),var(--accent-yellow))",
                          }}
                        >
                          <Flame className="size-4" />
                        </span>
                        Part 1
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> What was the dragon&apos;s name?
                        </li>
                        <li>
                          <HelpCircle className="size-4" /> Was the dragon kind or evil?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {part1Passage}
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
                          <Bird className="size-4" />
                        </span>
                        Part 2
                      </div>
                      <ul className="pre-reading-list">
                        <li>
                          <HelpCircle className="size-4" /> What was the name of the swan?
                        </li>
                        <li>
                          <HelpCircle className="size-4" /> Did Pip come to help?
                        </li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: "14px 12px" }}>
                      {part2Passage}
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
                    <h2>Reading 3 Completed!</h2>
                    <p>You have just completed Reading 3 — the story of Pip the dragon.</p>
                    <div className="final-score">
                      {score} / {TOTAL_QUESTIONS}
                    </div>
                    <p>{summaryMsg}</p>
                    <button type="button" className="restart-btn" onClick={resetAll}>
                      <RotateCcw className="size-4" /> Start Over
                    </button>
                  </div>

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
                      {SKILLS_USED.map(({ id, color, icon: Icon, label, indent }) => (
                        <li key={id} style={indent ? { marginLeft: 30 } : undefined}>
                          <span className="skill-icon" style={{ background: color }}>
                            <Icon className="size-3" />
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
                </div>
              </div>
            )}
          </div>

          {/* Feedback modal */}
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
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const SKILLS_USED: {
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
    id: "activate-bg",
    color: "var(--accent-yellow)",
    icon: Eye,
    label: (
      <>
        <strong>Activate</strong> your <strong>background knowledge</strong> or{" "}
        <strong>world knowledge</strong> about the topic.
      </>
    ),
  },
  {
    id: "activate-lang",
    color: "var(--accent-orange)",
    icon: Info,
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
    id: "bridging",
    color: "var(--accent-mint)",
    icon: Link2,
    indent: true,
    label: (
      <>
        <strong>Bridging inference:</strong> link up the information across the text to make an
        inference.
      </>
    ),
  },
  {
    id: "gap-filling",
    color: "var(--accent-purple)",
    icon: Network,
    indent: true,
    label: (
      <>
        <strong>Gap-filling inference:</strong> use your background knowledge to fill in the gap and
        make an inference.
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
