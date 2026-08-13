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
    text: "There is a mix of _____ flavours in Tropical Sunshine Ice-cream.",
    options: [
      { val: "A", label: "three" },
      { val: "B", label: "four" },
      { val: "C", label: "six" },
      { val: "D", label: "seven" },
    ],
    answer: "B",
    clues: ["q1"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look at clue. Count the
        flavours listed: <em>pineapple, banana, mango and passionfruit</em>. How many are there?
      </>
    ),
    strategy: (
      <>
        You cannot see the exact words &quot;four
        flavours&quot; in the reading, but you can scan for the keyword &quot;flavours&quot;,
        count them and get the sum. This is numerical reasoning.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. four</strong>
        <br />
        <br />
        The clue says &quot;a mix of <em>pineapple, banana, mango and passionfruit</em>{" "}
        flavours.&quot; Counting these gives us <strong>four</strong> flavours.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: "To enjoy the special offer, you have to ______.",
    options: [
      { val: "A", label: "buy two minicups of ice-cream" },
      { val: "B", label: "order the family pack" },
      { val: "C", label: "post a comment on the website" },
      { val: "D", label: "visit the Tai Po shop" },
    ],
    answer: "D",
    clues: ["q2"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read the special offer banner carefully. It says the offer is{" "}
        <em>&quot;for the Tai Po branch only&quot;</em>. What do you need to do to get this offer?
      </>
    ),
    strategy: (
      <>
        Find the special offer section and read all the
        conditions. Take out the answers with no evidence in the text, then compare the rest. The
        branch restriction tells you what action is required.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. visit the Tai Po shop</strong>
        <br />
        <br />
        The special offer states &quot;for the Tai Po branch only,&quot; so you must go to the Tai
        Po shop to enjoy the &quot;Buy 1 minicup and get 1 minicup FREE&quot; deal. You only need to
        buy <em>one</em> minicup, so A is wrong; There are no clues for B and C in the text.
      </>
    ),
  },
  {
    id: 3,
    part: "part1",
    text: "You can get a gift if you buy Tropical Sunshine Ice-cream on ______.",
    options: [
      { val: "A", label: "8 August" },
      { val: "B", label: "9 August" },
      { val: "C", label: "15 August" },
      { val: "D", label: "22 August" },
    ],
    answer: "C",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> The offer runs during <em>10–16 August</em>. Check which answer
        date falls <strong>within</strong> this period. 8 and 9 August are before it starts; 22
        August is after it ends!
      </>
    ),
    strategy: (
      <>
        Activate your knowledge of time relations. &quot;10–16
        August&quot; is a period of time. Check each option and decide whether the date falls inside
        the period.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. 15 August</strong>
        <br />
        <br />
        The clue says <strong>10–16 August</strong>. 8 and 9 August are <em>before</em> the period
        and 22 August is after. Only <strong>15 August</strong> falls within 10–16 August, so C is
        correct.
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: "In the comment from Vicky2026, the word 'ordinary' means ______.",
    options: [
      { val: "A", label: "common" },
      { val: "B", label: "special" },
      { val: "C", label: "new" },
      { val: "D", label: "strange" },
    ],
    answer: "A",
    clues: ["q4", "q4b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Vicky2026 says she prefers &quot;the ordinary flavours to the{" "}
        <em>strange</em> new mix.&quot; The word &quot;ordinary&quot; is <strong>the opposite of </strong>{" "}
        &quot;strange.&quot; What does &quot;ordinary&quot; mean?
      </>
    ),
    strategy: (
      <>
        When you don&apos;t know a word&apos;s meaning, look
        at the surrounding words for clues. &quot;Prefer…to…&quot; compares two things in contrast,
        so &quot;ordinary&quot; is the opposite of &quot;strange.&quot;
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. common</strong>
        <br />
        <br />
        Vicky2026 prefers the &quot;ordinary&quot; flavours (chocolate and strawberry) to the
        &quot;strange&quot; new mix. Since &quot;ordinary&quot; is the opposite of
        &quot;strange,&quot; it means <strong>common</strong>{" "} (normal, usual). These flavours are
        not &quot;special&quot; or &quot;new,&quot; so B and C are wrong.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: "In the comment from HappyPeter, 'Yuck!' is the sound of someone finding something ______.",
    options: [
      { val: "A", label: "interesting" },
      { val: "B", label: "expensive" },
      { val: "C", label: "delicious" },
      { val: "D", label: "horrible" },
    ],
    answer: "D",
    clues: ["q5", "q5b", "q5c", "q5d"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read what happens after &quot;Yuck!&quot; — the ice-cream{" "}
        <em>melted</em>, it was <em>&quot;What a mess!&quot;</em>, and HappyPeter calls it{" "}
        <em>&quot;Tropical Cyclone Ice-cream&quot;</em>. Was this a good or bad experience?
      </>
    ),
    strategy: (
      <>
        Connect the exclamation &quot;Yuck!&quot; with
        HappyPeter&apos;s overall attitude. &quot;What a mess!&quot;, &quot;melted&quot; and the
        sarcastic renaming to &quot;Tropical Cyclone Ice-cream&quot; all show{" "}
        <strong>negative feelings</strong>.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. horrible</strong>
        <br />
        <br />
        &quot;Yuck!&quot; expresses disgust. HappyPeter found the melted, messy ice-cream{" "}
        <strong>horrible</strong>. The context clues — &quot;melted,&quot; &quot;What a mess!&quot;
        and &quot;Tropical Cyclone Ice-cream&quot; — all point to a very negative experience.
        &quot;Expensive&quot; and &quot;delicious&quot; are not mentioned.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: "Who enjoyed Tropical Sunshine Ice-cream the most?",
    options: [
      { val: "A", label: "Vicky2026" },
      { val: "B", label: "Rebecca01" },
      { val: "C", label: "Vera123" },
      { val: "D", label: "HappyPeter" },
    ],
    answer: "B",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint: </strong>Look at each comment&apos;s attitude:
        <br />• Vicky2026 — prefers other flavours (not a fan)
        <br />• Rebecca01 — <em>&quot;I&apos;m coming back for more!&quot;</em> (very positive!)
        <br />• Vera123 — <em>&quot;Smells good, but tastes…&quot;</em> (mixed)
        <br />• HappyPeter — <em>&quot;What a mess!&quot;</em> (negative)
        <br />
        <br />
        Who sounds the most enthusiastic?
      </>
    ),
    strategy: (
      <>
        Understand each person&apos;s attitude to the ice-cream.
        Compare the <strong>feelings</strong>{" "} in each comment. &quot;Coming back for more&quot; is
        the most positive statement of all four comments.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. Rebecca01</strong>
        <br />
        <br />
        Rebecca01 says <em>&quot;I&apos;m coming back for more!&quot;</em> — this shows she enjoyed
        it so much she wants to buy it again. Vicky2026 and HappyPeter did not like it, and Vera123
        thought it was not very good.
      </>
    ),
  },
];
