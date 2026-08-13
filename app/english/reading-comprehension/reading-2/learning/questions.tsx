import type { ReactNode } from "react";

export type PartId = "part1" | "part2";

export interface Option {
  val: string;
  label: string;
}

export interface Question {
  id: number;
  part: PartId;
  text: string;
  /** Optional rich block (e.g. a dictionary entry) shown above the options. */
  extra?: ReactNode;
  options: Option[];
  answer: string;
  /** Clue ids highlighted in the passage when this question is hinted/answered. */
  clues: string[];
  hint: ReactNode;
  strategy: ReactNode;
  explain: ReactNode;
}

export const TOTAL_QUESTIONS = 6;

export const questions: Question[] = [
  {
    id: 1,
    part: "part1",
    text: 'The underlined word "intelligent" means ______.',
    options: [
      { val: "A", label: "beautiful" },
      { val: "B", label: "clever" },
      { val: "C", label: "dangerous" },
      { val: "D", label: "shy" },
    ],
    answer: "B",
    clues: ["q1", "q1b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Scan for the keyword <em>&quot;intelligent&quot;</em>, then read
        one more sentence after it: <em>&quot;It can remember things and learn from its
        mistakes.&quot;</em> An animal that does this must be very smart.
      </>
    ),
    strategy: (
      <>
        Find the keyword, read the clue right after it, then
        activate your world knowledge — remembering and learning from mistakes means the animal is
        smart. Compare the answers to pick the best.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. clever</strong>
        <br />
        <br />
        The clue <em>&quot;It can remember things and learn from its mistakes&quot;</em> shows the
        cuttlefish is smart, so <strong>&quot;intelligent&quot; means &quot;clever&quot;</strong>.
        &quot;Beautiful&quot; is about looks, while &quot;dangerous&quot; and &quot;shy&quot; are
        not relevant to this clue.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: 'A common cuttlefish is a "hiding master" because it ______.',
    options: [
      { val: "A", label: "has blue blood" },
      { val: "B", label: "has many hearts" },
      { val: "C", label: "is good at remembering things" },
      { val: "D", label: "can change colour" },
    ],
    answer: "D",
    clues: ["q2", "q2b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> The keyword is <em>&quot;hide&quot;</em>. Read the sentences near
        &quot;hiding master&quot;: it can shoot ink, escape, and{" "}
        <em>&quot;change its skin colour to look like the sand.&quot;</em>
      </>
    ),
    strategy: (
      <>
        &quot;Hiding master&quot; is a
        personification — it means the cuttlefish is very good at hiding. Look for the detail that is
        about <em>hiding</em>, then compare the options.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. can change colour</strong>
        <br />
        <br />
        Changing its skin colour to look like the sand helps the cuttlefish hide, so it is
        a &quot;hiding master&quot;. Blue blood, many hearts and remembering things are mentioned in
        the text, but none of them is about hiding — they are distractors.
      </>
    ),
  },
  {
    id: 3,
    part: "part1",
    text: '"This helps it escape." The word "This" refers to ______.',
    options: [
      { val: "A", label: "firing out its longer arms" },
      { val: "B", label: "losing a heart" },
      { val: "C", label: "shooting ink" },
      { val: "D", label: "remembering things" },
    ],
    answer: "C",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint: </strong>&quot;This&quot; is a reference word — it usually refers to
        something just before it. Read the sentence right before:{" "}
        <em>&quot;It can shoot ink when it is in danger.&quot;</em>
      </>
    ),
    strategy: (
      <>
        Words like &quot;this&quot;, &quot;that&quot;,
        &quot;it&quot; and &quot;these&quot; refer to something near them. Look at the sentence
        before &quot;This&quot; to find what it means.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. shooting ink</strong>
        <br />
        <br />
        The sentence before says <em>&quot;It can shoot ink when it is in danger,&quot; </em>so
        &quot;This&quot; refers to <strong>shooting ink</strong>. Firing out its arms is for catching
        prey, and remembering things is about being clever — neither is about escaping. Losing a heart is never mentioned in the text.
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: "Bar-tailed godwits are famous for ______.",
    options: [
      { val: "A", label: "flying a long way" },
      { val: "B", label: "flying fast" },
      { val: "C", label: "having the longest beaks" },
      { val: "D", label: "loving winter" },
    ],
    answer: "A",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> &quot;Famous&quot; has a similar meaning to{" "}
        <em>&quot;well known&quot;</em>. Find that phrase:{" "}
        <em>&quot;It is well known for having one of the longest trips without stopping.&quot;</em>
      </>
    ),
    strategy: (
      <>
        &quot;Well known&quot; means &quot;famous&quot;, and a long
        &quot;trip&quot; is the same as a long &quot;way&quot;. Find the answer with similar meaning with the clue.
        Take out the answers with no supporting evidence.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. flying a long way</strong>
        <br />
        <br />
        The text says it is <em>&quot;well known for having one of the longest trips without
        stopping&quot;</em> — that is flying a long way. &quot;Flying fast&quot; and &quot;loving
        winter&quot; are not in the text (it actually enjoys the warm season), and the text only says
        it has a long beak, not the longest.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: "Bar-tailed godwits fly north back to Alaska to enjoy ______.",
    options: [
      { val: "A", label: "spring" },
      { val: "B", label: "summer" },
      { val: "C", label: "autumn" },
      { val: "D", label: "winter" },
    ],
    answer: "B",
    clues: ["q5"],
    hint: (
      <>
        <strong>💡 Hint:</strong> The clue is a little far from the keyword. When it returns to
        Alaska, <em>&quot;it enjoys the warmest time of the year.&quot;</em> Which season is the
        warmest?
      </>
    ),
    strategy: (
      <>
        Link two pieces of information — it returns to Alaska,
        and there it enjoys the warmest time of the year. Fill the gap with your world knowledge:
        the warmest season is summer.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. summer</strong>
        <br />
        <br />
        Back in Alaska it enjoys <em>&quot;the warmest time of the year&quot;</em>. From your
        background knowledge, the warmest season is <strong>summer</strong>.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: 'In the last sentence, what does "nest" mean? The best answer is ______.',
    extra: (
      <div className="dict-entry">
        <div className="dict-head">
          <span className="dict-word">nest</span>
          <span className="dict-phon">/nest/</span>
        </div>
        <div className="dict-pos">noun</div>
        <ol className="dict-list">
          <li>
            a place where a bird lays eggs
            <span className="dict-eg">The bird built a nest in the tree.</span>
          </li>
          <li>
            the home
            <span className="dict-eg">Her son left the nest and moved to another country.</span>
          </li>
        </ol>
        <div className="dict-pos">verb</div>
        <ol className="dict-list" start={3}>
          <li>
            to build a place to lay eggs
            <span className="dict-eg">Some birds like to nest near the river.</span>
          </li>
          <li>
            to fit something inside another thing
            <span className="dict-eg">We can nest the smaller box inside the larger box.</span>
          </li>
        </ol>
      </div>
    ),
    options: [
      { val: "A", label: "Meaning 1 — a place where a bird lays eggs (noun)" },
      { val: "B", label: "Meaning 2 — the home (noun)" },
      { val: "C", label: "Meaning 3 — to build a place to lay eggs (verb)" },
      { val: "D", label: "Meaning 4 — to fit something inside another thing (verb)" },
    ],
    answer: "C",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read the sentence:{" "}
        <em>&quot;It often finds a dry, open place to nest and raise its babies.&quot;</em> Here
        &quot;nest&quot; is an action (a verb), and it is about making a place for babies.
      </>
    ),
    strategy: (
      <>
        Notice that a verb is needed
        in the sentence, so meanings 1 and 2 (nouns) are out. Then use your knowledge that birds
        build a nest to raise babies to pick the best verb meaning.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. Meaning 3</strong>
        <br />
        <br />
        In the sentence, &quot;nest&quot; is used as a <strong>verb</strong> meaning{" "}
        <em>&quot;to build a place to lay eggs&quot;</em>. Meanings 1 and 2 are nouns, so they do not
        fit, and meaning 4 (&quot;to fit something inside another thing&quot;) does not match the
        idea of a bird raising its babies.
      </>
    ),
  },
];
