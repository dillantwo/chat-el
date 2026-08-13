import type { ReactNode } from "react";

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
  options: Option[];
  answer: string;
  /** Clue ids highlighted in the blurb when this question is hinted/answered. */
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
    text: "How did the watch disappear from the study?",
    options: [
      { val: "A", label: "Mr Chan left the door open." },
      { val: "B", label: "One visitor had the key." },
      { val: "C", label: "Nobody knows yet." },
      { val: "D", label: "The police took it away." },
    ],
    answer: "C",
    clues: ["q1", "q1b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look for the keyword <em>&quot;study&quot;</em>:{" "}
        <em>
          &quot;Mr Chan has the only key to the study. The door was locked...&quot;
        </em>{" "}
        Then read <em>&quot;It is a real mystery. The police have no idea where to start.&quot;</em>
      </>
    ),
    strategy: (
      <>
        The door was locked and Mr Chan has the only key. Even the police
        don&apos;t know where to start. The answer is implied. Link up the information across the text and make a reasonable guess.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. Nobody knows yet.</strong>
        <br />
        <br />
        The watch disappeared from a <em>locked</em> study and{" "}
        <em>&quot;the police have no idea where to start&quot;</em>, so nobody knows how yet. A is
        wrong (the door was locked); B is wrong (Mr Chan has the only key); D is never mentioned.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: 'The word "mystery" means ______.',
    options: [
      { val: "A", label: "a small room" },
      { val: "B", label: "a useful plan" },
      { val: "C", label: "something hard to understand" },
      { val: "D", label: "something funny" },
    ],
    answer: "C",
    clues: ["q2", "q1b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read around the word <em>&quot;mystery&quot;</em>:{" "}
        <em>
          &quot;Where is the watch now? Who took it? How was the door opened? It is a real mystery.
          The police have no idea where to start.&quot;
        </em>{" "}
        What feeling do these sentences give?
      </>
    ),
    strategy: (
      <>
        Use the sentences around the word "mystery". They are all about
        something strange and hard to solve — even the police are stuck.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. something hard to understand</strong>
        <br />
        <br />
        The questions and <em>&quot;the police have no idea where to start&quot;</em> show a strange,
        hard problem. A &quot;small room&quot; (A) is a place; the police have no plan, so B is
        wrong; the moment is puzzling, not funny (D).
      </>
    ),
  },
  {
    id: 3,
    part: "part1",
    text: "This story is about ______.",
    options: [
      { val: "A", label: "crime" },
      { val: "B", label: "cooking" },
      { val: "C", label: "history" },
      { val: "D", label: "travel" },
    ],
    answer: "A",
    clues: ["q3a", "q1", "q1b", "q3b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Skim the whole story part. Something is <strong>stolen</strong>,
        the <strong>police</strong> cannot solve it, and a <strong>detective</strong> comes to help.
        What kind of story has all of these?
      </>
    ),
    strategy: (
      <>
        Activate your background knowledge of the topic. What kind of story usually has these: something stolen, the police and a detective?
        Food is not the most important idea of the story.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. crime</strong>
        <br />
        <br />
        A missing watch, the police and Detective Lee are all <strong>crime </strong>story elements.
        &quot;Cooking&quot; (B) and &quot;history&quot; (C) are not there; &quot;travel&quot; (D) is
        a distractor.
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: "______ is the author of the book.",
    options: [
      { val: "A", label: "Mr Chan" },
      { val: "B", label: "Dillan Rumelhart" },
      { val: "C", label: "David Wong" },
      { val: "D", label: "Jocelyn Chow" },
    ],
    answer: "C",
    clues: ["q4", "q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look at the reviews and the last line:{" "}
        <em>&quot;This story by David Wong...&quot;</em> and{" "}
        <em>&quot;Don&apos;t miss David Wong&apos;s Detective Lee series!&quot;</em> Who wrote the
        book?
      </>
    ),
    strategy: (
      <>
        Activate your background knowledge of the topic. A blurb has review comments. Dillan Rumelhart wrote <em>Lulu and the Moon Rocket</em> and only left a
        comment; Jocelyn Chow is a reviewer.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. David Wong</strong>
        <br />
        <br />
        <em>&quot;This story by David Wong...&quot;</em> and{" "}
        <em>&quot;David Wong&apos;s Detective Lee series&quot;</em> tell us he is the author. Mr Chan
        is a character (A); Dillan Rumelhart (B) and Jocelyn Chow (D) only wrote review comments.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: "There are ______ books in the Detective Lee series.",
    options: [
      { val: "A", label: "two" },
      { val: "B", label: "three" },
      { val: "C", label: "four" },
      { val: "D", label: "five" },
    ],
    answer: "B",
    clues: ["q5"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find <em>&quot;Detective Lee series&quot;</em>:{" "}
        <em>&quot;I want to read the other two books in the Detective Lee series soon.&quot;</em>{" "}
        Don&apos;t forget to count <strong>this</strong> book too!
      </>
    ),
    strategy: (
      <>
        &quot;The other two books&quot; means
        two more <em>besides</em> this one. Use numerical reasoning to get the sum.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. three</strong>
        <br />
        <br />
        <em>&quot;the other two books&quot;</em> means two more <em>besides</em> the book you are
        reading. 1 book + 2 other books = <strong>3 books</strong> in total.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: "The main purpose of this text is ______.",
    options: [
      { val: "A", label: "to tell readers how to solve a crime" },
      { val: "B", label: "to ask readers to read the book" },
      { val: "C", label: "to teach readers how to write stories" },
      { val: "D", label: "to describe a real theft in detail" },
    ],
    answer: "B",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> This text is a <em>book blurb</em>. Think about why a blurb is
        written. Read the last line:{" "}
        <em>&quot;Don&apos;t miss David Wong&apos;s Detective Lee series!&quot;</em>
      </>
    ),
    strategy: (
      <>
        Activate your background knowledge of the topic. A blurb uses an exciting summary and
        good reviews to make readers want the book.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. to ask readers to read the book</strong>
        <br />
        <br />
        The exciting summary, the good reviews, and{" "}
        <em>&quot;Don&apos;t miss David Wong&apos;s Detective Lee series!&quot;</em> all try to make
        readers interested. It does not teach how to solve a crime (A) or write stories (C), and it
        is a story blurb, not a real report (D).
      </>
    ),
  },
];
