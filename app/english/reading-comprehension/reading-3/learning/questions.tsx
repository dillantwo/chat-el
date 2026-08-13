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
  /** Optional rich block shown above the options. */
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
    text: "The villagers thought Pip was a dangerous dragon because he ______.",
    options: [
      { val: "A", label: "did evil things" },
      { val: "B", label: "looked scary" },
      { val: "C", label: "burned houses" },
      { val: "D", label: "was not kind to others" },
    ],
    answer: "B",
    clues: ["q1", "q1b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Scan the second paragraph:{" "}
        <em>&quot;Pip had big wings and sharp teeth&quot;</em> and{" "}
        <em>&quot;Look at that scary dragon!&quot;</em> The villagers reacted to how Pip{" "}
        <em>looked</em>.
      </>
    ),
    strategy: (
      <>
        The question asks what really made the villagers think Pip
        was dangerous — his appearance. &quot;Burned houses&quot; is only what they{" "}
        <em>heard</em>, and &quot;did evil things&quot; / &quot;not kind&quot; are just their
        guesses, not facts in the text.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. looked scary</strong>
        <br />
        <br />
        The clue <em>&quot;big wings and sharp teeth&quot;</em> and{" "}
        <em>&quot;Look at that scary dragon!&quot;</em> shows the villagers judged Pip by his
        appearance. The other options are distractors.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: 'In paragraph 3, the word "mend" means ______.',
    options: [
      { val: "A", label: "build" },
      { val: "B", label: "damage" },
      { val: "C", label: "repair" },
      { val: "D", label: "touch" },
    ],
    answer: "C",
    clues: ["q2"],
    hint: (
      <>
        <strong>💡 Hint:</strong> The clue is{" "}
        <em>&quot;cure sick plants and animals, and mend broken things&quot;</em>. &quot;Cure&quot;
        makes sick things well again, so &quot;mend&quot; does something similar. It makes something good again.
      </>
    ),
    strategy: (
      <>
        Put each option into &quot;___ broken
        things&quot;. You would not <em>damage</em>{" "} something already broken, and &quot;build&quot;
        or &quot;touch&quot; do not fit. &quot;Repair&quot; means to make it good again.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. repair</strong>
        <br />
        <br />
        Pip fixes broken things by breathing fire on them gently, so &quot;mend&quot; means{" "}
        <strong>repair</strong> — to make them good again. &quot;Damage&quot; is the opposite, and
        &quot;build&quot; and &quot;touch&quot; do not match the idea of fixing.
      </>
    ),
  },
  {
    id: 3,
    part: "part1",
    text: 'In Paragraph 2, "like sunlight" means Pip was ______.',
    options: [
      { val: "A", label: "warm-hearted" },
      { val: "B", label: "healthy" },
      { val: "C", label: "confident" },
      { val: "D", label: "shy" },
    ],
    answer: "A",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> <em>&quot;Pip was kind. He was like sunlight.&quot;</em> is a
        simile. Sunlight is warm, and Pip helped others — he brought warmth and healing.
      </>
    ),
    strategy: (
      <>
        &quot;Warm-hearted&quot; is{" "}
        <em>warm</em> + <em>heart</em>. It means kind and it matches the clue. &quot;Confident&quot; is wrong (the text says he was{" "}
        <em>not</em>{" "}confident), and &quot;shy&quot; is true about Pip but does not answer this
        question — it is a distractor.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. warm-hearted</strong>
        <br />
        <br />
        Comparing Pip to sunlight shows he was kind and caring — <strong>warm-hearted</strong>.
        &quot;Healthy&quot; is not relevant, &quot;confident&quot; contradicts the text, and
        &quot;shy&quot; describes Pip but is not what &quot;like sunlight&quot; means.
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: 'In Paragraph 1 of Part 2, "Moo!" is the sound made by the ______ cows.',
    options: [
      { val: "A", label: "scared" },
      { val: "B", label: "excited" },
      { val: "C", label: "calm" },
      { val: "D", label: "bored" },
    ],
    answer: "A",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Right after <em>&quot;Moo!&quot;</em> the cows{" "}
        <em>could not move</em>, and <em>&quot;The villagers were frightened.&quot;</em> The whole
        scene feels frightening.
      </>
    ),
    strategy: (
      <>
        &quot;Moo!&quot; is the cows&apos; sound
        during Greta&apos;s evil magic. &quot;Scared&quot; matches &quot;frightened&quot;.
        &quot;Excited&quot; and &quot;calm&quot; are not negative, and &quot;bored&quot; does not fit
        the scary setting.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. scared</strong>
        <br />
        <br />
        The cows were frozen by Greta&apos;s magic and the villagers were{" "}
        <em>frightened</em>, so the cows were <strong>scared</strong>. &quot;Scared&quot; and
        &quot;frightened&quot; have a similar meaning. The other options do not match the frightening
        atmosphere.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: "Paragraph 2 of Part 2 is mainly about how ______.",
    options: [
      { val: "A", label: "the villagers fixed their houses" },
      { val: "B", label: "Greta scared the villagers" },
      { val: "C", label: "Pip helped the villagers" },
      { val: "D", label: "Greta and Pip argued" },
    ],
    answer: "C",
    clues: ["q5"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Skim the paragraph and look at the topic sentence:{" "}
        <em>&quot;Pip came to help.&quot;</em> The whole paragraph tells what Pip did to help.
      </>
    ),
    strategy: (
      <>
        The main idea covers the whole paragraph.
        It was Pip (not the villagers) who fixed things, so &quot;the villagers fixed their houses&quot; is only a small and wrong detail.
        &quot;Greta scared the villagers&quot; is Part 2&apos;s first paragraph, and &quot;argued&quot;
        is never mentioned.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. Pip helped the villagers</strong>
        <br />
        <br />
        The topic sentence <em>&quot;Pip came to help&quot;</em> and the whole paragraph (stopping the
        storm, curing the cows, fixing the houses and plants) are about how{" "}
        <strong>Pip helped the villagers</strong>.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: "In the end, Greta left the village because ______.",
    options: [
      { val: "A", label: "she became sick" },
      { val: "B", label: "she could not make any friends" },
      { val: "C", label: "the villagers broke her house" },
      { val: "D", label: "Pip was better at magic than she was" },
    ],
    answer: "D",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Scan for <em>&quot;leave the village&quot;</em>. The sentences
        nearby say <em>&quot;He stopped all of Greta&apos;s evil tricks&quot;</em> and{" "}
        <em>&quot;She knew he could not beat Pip.&quot;</em>
      </>
    ),
    strategy: (
      <>
        Link the two clues — Pip stopped all her tricks, and she
        knew she could not beat him. Together they show Pip&apos;s magic was stronger. The other
        options are not mentioned or not supported.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. Pip was better at magic than she was</strong>
        <br />
        <br />
        Pip <em>&quot;stopped all of Greta&apos;s evil tricks&quot;</em> and she{" "}
        <em>&quot;knew he could not beat Pip&quot;</em>, so she had to leave because his magic was
        stronger. Becoming sick, making no friends and a broken house are never mentioned.
      </>
    ),
  },
];
