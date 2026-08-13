import type { ReactNode } from "react";

export type PartId = "part1" | "part2" | "part3";

export interface Option {
  val: string;
  label: ReactNode;
}

export interface Question {
  id: number;
  part: PartId;
  text: string;
  /** Optional rich block (e.g. a picture grid) shown above the options. */
  extra?: ReactNode;
  options: Option[];
  answer: string;
  /** Clue ids highlighted in the sheet when this question is hinted/answered. */
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
    text: "Which of the following is NOT a must-have for the activity?",
    options: [
      { val: "A", label: "baking soda" },
      { val: "B", label: "a funnel" },
      { val: "C", label: "a balloon" },
      { val: "D", label: "a rubber band" },
    ],
    answer: "D",
    clues: ["q1"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look at the materials list carefully. One item has extra words
        after it: <em>&quot;a rubber band (helpful if you have one)&quot;</em>. What do those words
        tell you?
      </>
    ),
    strategy: (
      <>
        Understand the different between must-have and extra things. All four items are in the list, so
        find the one that is only <em>helpful</em>, not a must. The note{" "}
        <em>&quot;helpful if you have one&quot;</em> means it is okay without it.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. a rubber band</strong>
        <br />
        <br />
        The list says <em>&quot;a rubber band (helpful if you have one)&quot;</em>. It is helpful
        but not a must-have. Baking soda (A), a funnel (B) and a balloon (C) are all needed for the
        experiment.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: "For this experiment, children should ask an adult to help them because ______.",
    options: [
      { val: "A", label: "adults like balloons" },
      { val: "B", label: "adults can help them stay safe" },
      { val: "C", label: "adults know how to use the spoon" },
      { val: "D", label: "adults need to wash the tray" },
    ],
    answer: "B",
    clues: ["q2"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find the keyword <em>&quot;adult&quot;</em> in the{" "}
        <em>Safety</em> part: <em>&quot;Ask an adult to help you.&quot;</em>{" "}Why is this in the safety part?
      </>
    ),
    strategy: (
      <>
        Connect your knowledges with the clue and make a reasonable guess. The advice sits under{" "}
        <em>Safety</em>. Children can use a spoon too, and washing the
        tray is not the main reason to ask for help — those answers have no evidence from the text.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. adults can help them stay safe</strong>
        <br />
        <br />
        <em>&quot;Ask an adult to help you&quot;</em> is in the <em>Safety</em> part, so it is about
        staying safe. A, C and D are not the reason and have no supporting evidence in the text.
      </>
    ),
  },
  {
    id: 3,
    part: "part2",
    text: 'In Step 4, the word "stretch" means ______.',
    options: [
      { val: "A", label: "to make something longer or pull it wider" },
      { val: "B", label: "to wash something carefully" },
      { val: "C", label: "to cut something into two parts" },
      { val: "D", label: "to make something smaller so it fits into other things" },
    ],
    answer: "A",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read Step 4:{" "}
        <em>
          &quot;Carefully stretch the mouth of the balloon and wrap it around the neck of the
          bottle.&quot;
        </em>{" "}
        Imagine pulling the balloon&apos;s mouth to cover the bottle.
      </>
    ),
    strategy: (
      <>
        Picture the action. To{" "}
        <em>&quot;wrap it around the neck of the bottle&quot;</em>, the balloon&apos;s mouth must be
        pulled <em>wider</em>, not washed, cut, or made smaller.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. to make something longer or pull it wider</strong>
        <br />
        <br />
        To cover the neck of the bottle, you pull the balloon&apos;s mouth wider. Washing (B) and
        cutting (C) make no sense here, and D is the opposite — the mouth must get{" "}
        <em>wider</em>, not smaller.
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: "What happens after Step 6? Which statement is NOT correct?",
    options: [
      { val: "A", label: "The liquid in the bottle becomes less clear." },
      { val: "B", label: "There are bubbles in the bottle." },
      { val: "C", label: "The balloon puffs up." },
      { val: "D", label: "The bottle becomes smaller." },
    ],
    answer: "D",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> After Step 6 the baking soda and vinegar mix. Read{" "}
        <em>How It Works</em>:{" "}
        <em>
          &quot;you can see some bubbles... a gas... The gas moves into the balloon and makes it
          puff up!&quot;
        </em>{" "}
        Which answer does NOT match?
      </>
    ),
    strategy: (
      <>
        Link Step 6 with <em>How It Works</em>. Bubbles and
        the balloon puffing up are stated. Look for evidence to support your understanding. The liquid turning less clear matches the milky
        colour in the picture. 
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. The bottle becomes smaller.</strong>
        <br />
        <br />
        The bottle shrinking is not mentioned anywhere. Bubbles (B) and the balloon puffing up (C)
        are stated in <em>How It Works</em>, and the liquid becoming less clear (A) matches the
        milky picture. D is the statement that is NOT correct.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: "What may happen if you use more baking soda and more vinegar next time?",
    options: [
      { val: "A", label: "The liquid may become pink." },
      { val: "B", label: "There may not be any bubbles." },
      { val: "C", label: "The balloon may become smaller." },
      { val: "D", label: "The balloon may puff up more." },
    ],
    answer: "D",
    clues: ["q5", "q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read the <em>Tip</em>:{" "}
        <em>&quot;Try using more or less baking soda and vinegar next time.&quot;</em> Then think:
        more baking soda and vinegar make more gas — so what happens to the balloon?
      </>
    ),
    strategy: (
      <>
        Connect the <em>Tip</em> with <em>How It Works</em>.
        More baking soda and more vinegar will make more gas, and gas puffs up the balloon. Pink liquid is never
        mentioned.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. The balloon may puff up more.</strong>
        <br />
        <br />
        More baking soda and vinegar make more gas, so the balloon puffs up more. The text never
        mentions pink liquid (A); bubbles always appear (B is wrong); and gas makes the balloon
        bigger, not smaller (C is wrong).
      </>
    ),
  },
  {
    id: 6,
    part: "part3",
    text: "This information would most likely be found in the ______ section of a magazine.",
    options: [
      { val: "A", label: "Story Corner" },
      { val: "B", label: "Best Cooks" },
      { val: "C", label: "Little Scientist" },
      { val: "D", label: "Sports Fun" },
    ],
    answer: "C",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Think about the text type. It has materials, safety, steps and a{" "}
        <em>How It Works</em> about a <em>chemical reaction</em>. What kind of magazine section is
        that?
      </>
    ),
    strategy: (
      <>
        Understand the purpose of the text. This is a science experiment, not a story, not about cooking food, and not sports.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. Little Scientist</strong>
        <br />
        <br />
        The text is a science experiment about a chemical reaction, so it fits{" "}
        <strong>Little Scientist</strong>. It is not a story (A), not about cooking food (B), and
        not about games or sports (D).
      </>
    ),
  },
];
