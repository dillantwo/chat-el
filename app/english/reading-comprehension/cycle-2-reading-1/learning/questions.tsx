import type { ReactNode } from "react";
import { basePath } from "@/lib/utils";

export type PartId = "part1" | "part2";

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
  /** When true, the options are images shown in a 2x2 grid. */
  imageOptions?: boolean;
  options: Option[];
  answer: string;
  /** Clue ids highlighted in the poster when this question is hinted/answered. */
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
    text: "The school is holding the Story Day to ______.",
    options: [
      { val: "A", label: "celebrate its 22nd anniversary" },
      { val: "B", label: "make students become actors" },
      { val: "C", label: "get students to read more books" },
      { val: "D", label: "teach students how to dress well" },
    ],
    answer: "C",
    clues: ["q1"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look near the top of the poster:{" "}
        <em>&quot;{" "}We hope this special day will help you enjoy reading more books.&quot;</em>
        {" "}What is the school&apos;s real purpose?
      </>
    ),
    strategy: (
      <>
        Find the clue that tells you the purpose, then check
        each answer. Compare the answers. The one with most supporting evidence is the best answer.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. get students to read more books</strong>
        <br />
        <br />
        The clue <em>&quot;help you enjoy reading more books&quot;</em> matches{" "}
        <strong>&quot;get students to read more books&quot;</strong>. &quot;22nd March&quot; is a
        date, not an anniversary (A). Acting (B) and dressing up (D) are only activities, not the
        purpose.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: "Which student is wearing or bringing the right things on Story Day?",
    imageOptions: true,
    options: [
      {
        val: "A",
        label: <img className="opt-img" src={`${basePath}/english/A.png`} alt="Option A" />,
      },
      {
        val: "B",
        label: <img className="opt-img" src={`${basePath}/english/B.png`} alt="Option B" />,
      },
      {
        val: "C",
        label: <img className="opt-img" src={`${basePath}/english/C.png`} alt="Option C" />,
      },
      {
        val: "D",
        label: <img className="opt-img" src={`${basePath}/english/D.png`} alt="Option D" />,
      },
    ],
    answer: "C",
    clues: ["q2a", "q2b", "q2c", "q2d"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Check the <em>&quot;What You Can and Cannot Wear and Bring&quot;</em>{" "}
        list. The right answer must match the ✓ items and have nothing from the ✗ items (no
        sleeveless tops, no horror themes, no things used for fighting).
      </>
    ),
    strategy: (
      <>
        Look at what each student wears or
        carries, then match it against the rules. Activate your background knowledge: A sword is a thing used for fighting; a white
        cloth makes the student look liked a ghost (a horror theme).
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. A girl in a knee-length dress with sleeves</strong>
        <br />
        <br />
        Her dress matches <em>&quot;trousers, skirts and dresses (knee length)&quot;</em> and has
        sleeves. A breaks <em>&quot;things used for fighting&quot;</em> (sword and shield); B breaks{" "}
        <em>&quot;tops with no sleeves&quot;</em>; D dresses as a ghost — a{" "}
        <em>&quot;clothes with horror themes&quot;</em> problem.
      </>
    ),
  },
  {
    id: 3,
    part: "part2",
    text: "On the Story Day, all students will ______.",
    options: [
      { val: "A", label: "draw posters" },
      { val: "B", label: "perform in English class" },
      { val: "C", label: "write stories in the reading room" },
      { val: "D", label: "walk on the stage" },
    ],
    answer: "B",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> The keyword is <em>&quot;all students&quot;</em> — find something{" "}
        <strong>everyone</strong> will do. Re-read <em>&quot;Classroom Drama&quot;</em>:
        &quot;Everyone picks a short part... act it out in English class.&quot;
      </>
    ),
    strategy: (
      <>
        Check each answer and re-read relevant parts in the text. Activate your knowledge of synonyms. &quot;Perform&quot; and &quot;act
        out&quot; have similar meanings.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. perform in English class</strong>
        <br />
        <br />
        <em>&quot;Everyone picks a short part... Read it and act it out in English class.&quot;</em>{" "}
        means all students perform. &quot;Draw posters&quot; (A) is never mentioned; the reading
        room is for listening, not writing (C); only best-dressed students walk on the stage (D).
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: "______ will tell stories at recess?",
    options: [
      { val: "A", label: "Ms Lee" },
      { val: "B", label: "Peter Lam" },
      { val: "C", label: "Dillan Rumelhart" },
      { val: "D", label: "Lulu" },
    ],
    answer: "A",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find the activity at recess: <em>&quot;Story Corner with Ms
        Lee&quot;</em>. Who is the person to tell stories at the Story Corner?
      </>
    ),
    strategy: (
      <>
        Check each answer and re-read relevant parts in the text. Activate your knowledge about the topic. &quot;...written by Peter Lam&quot;
        means Peter Lam is the author of a book, not the storyteller. Lulu is a character in a book title.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. Ms Lee</strong>
        <br />
        <br />
        The activity <em>&quot;Story Corner with Ms Lee&quot;</em> tells us Ms Lee is there telling
        stories. Peter Lam (B) and Dillan Rumelhart (C) are the <em>writers</em> of the books, and
        Lulu (D) is a character in a book title.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: 'In the "Fashion Show" part, the word "costume" means ______.',
    options: [
      { val: "A", label: "book" },
      { val: "B", label: "clothes" },
      { val: "C", label: "short part" },
      { val: "D", label: "gift" },
    ],
    answer: "B",
    clues: ["q5", "q5b"],
    hint: (
      <>
        Scan for the keyword <em>&quot;Best Costume Award&quot;</em>. Read
        the sentence before it: <em>&quot;The best-dressed students... will walk proudly on the
        stage.&quot;</em> It is about what students <strong>wear</strong>.
      </>
    ),
    strategy: (
      <>
        When you do not know a word, use the words around it.
        &quot;Best-dressed&quot; and &quot;Fashion Show&quot; refer to clothing, so
        &quot;costume&quot; means something students wear to dress up.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. clothes</strong>
        <br />
        <br />
        The Fashion Show is about the <em>&quot;best-dressed students&quot;</em>, so
        &quot;costume&quot; means the <strong>clothes</strong> {" "}they wear to dress up. A &quot;short
        part&quot; belongs to Classroom Drama (C) and a &quot;gift&quot; is for watching the show
        (D) — neither answers the question.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: "This poster is about ______.",
    options: [
      { val: "A", label: "a school event" },
      { val: "B", label: "a recess activity" },
      { val: "C", label: "school rules" },
      { val: "D", label: "prizes for an award" },
    ],
    answer: "A",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Skim the whole poster. It has a title, a date, a purpose, dress
        rules, activities and prizes. Which answer can cover <strong>all</strong> of these?
      </>
    ),
    strategy: (
      <>
        The best answer summarises most of the poster.
        Activity, rules and prizes are each only one small part.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. a school event</strong>
        <br />
        <br />
        The whole poster introduces the Story Day, so <strong>&quot;a school event&quot;</strong>{" "}
        covers everything. A recess activity (B), school rules (C) and prizes (D) are each only a
        small part of the poster.
      </>
    ),
  },
];
