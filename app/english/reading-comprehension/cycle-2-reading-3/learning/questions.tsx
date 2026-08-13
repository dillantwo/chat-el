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
  /** Optional rich block shown above the options. */
  extra?: ReactNode;
  options: Option[];
  answer: string;
  /** Clue ids highlighted in the email when this question is hinted/answered. */
  clues: string[];
  hint: ReactNode;
  strategy: ReactNode;
  explain: ReactNode;
}

export const TOTAL_QUESTIONS = 8;

export const questions: Question[] = [
  {
    id: 1,
    part: "part1",
    text: "Who joined the study tour?",
    options: [
      { val: "A", label: "Primary 3 students" },
      { val: "B", label: "Primary 4 students" },
      { val: "C", label: "Primary 5 students" },
      { val: "D", label: "Primary 6 students" },
    ],
    answer: "D",
    clues: ["q1"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read the opening again:{" "}
        <em>&quot;I want to tell you about my graduation school study tour.&quot;</em> When do
        students usually graduate from primary school?
      </>
    ),
    strategy: (
      <>
        The word &quot;graduation&quot; is the keyword. Activate your background knowledge: in
        primary school, a graduation study tour usually happens in students&apos; last year.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. Primary 6 students</strong>
        <br />
        <br />
        The clue <em>&quot;graduation school study tour&quot; </em>tells us these are students in
        their last primary year — Primary 6. The other grades (A, B, C) do not fit
        &quot;graduation&quot;.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: 'In paragraph 2, "shaking like a leaf" means Susan was ______.',
    options: [
      { val: "A", label: "calm" },
      { val: "B", label: "excited" },
      { val: "C", label: "nervous" },
      { val: "D", label: "sick" },
    ],
    answer: "C",
    clues: ["q2"],
    hint: (
      <>
        <strong>💡 Hint:</strong> &quot;Shaking like a leaf&quot; is a simile. Read around it:{" "}
        <em>&quot;When my turn came, I could not speak... The students smiled and clapped their
        hands to encourage me.&quot;</em> How did Susan feel?
      </>
    ),
    strategy: (
      <>
        Susan had to speak in front of others, but she could not speak and needed encouragement —
        these are signs that she felt worried, not calm or sick. Activate your background knowledge:
        how may people feel if they have to speak in front of a lot of strangers?
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. nervous</strong>
        <br />
        <br />
        She <em>&quot;could not speak&quot;</em> and needed the students to encourage her, so
        &quot;shaking like a leaf&quot; means she was <strong>nervous</strong>. A calm person would
        not shake (A); &quot;excited&quot;(B) and &quot;sick&quot; (D) are not
        supported.
      </>
    ),
  },
  {
    id: 3,
    part: "part1",
    text: "Who did Susan meet on the first day of the tour?",
    options: [
      { val: "A", label: "new teachers from Hong Kong" },
      { val: "B", label: "new friends from Reykjavík" },
      { val: "C", label: "her cousin in Iceland" },
      { val: "D", label: "her friend Rebecca" },
    ],
    answer: "B",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Scan the first-day paragraph for the keyword. It says:{" "}
        <em>&quot;we played games together and I made a few new Icelandic friends.&quot;</em>
      </>
    ),
    strategy: (
      <>
        Reykjavík is a city in Iceland, so &quot;new friends from Reykjavík
        &quot; can be &quot;new Iceland friends&quot;. Rebecca is the person Susan is
        writing to, not someone she met; teachers and a cousin are never mentioned.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. new friends from Reykjavík</strong>
        <br />
        <br />
        <em>&quot;I made a few new Icelandic friends&quot;</em> matches answer B. Teachers from Hong Kong
        (A) and a cousin (C) are never mentioned, and Rebecca (D) is the reader of the email, not
        someone Susan met on the trip.
      </>
    ),
  },
  {
    id: 4,
    part: "part1",
    text: "Susan thought the second day was interesting because ______.",
    options: [
      { val: "A", label: "everyone clapped for her" },
      { val: "B", label: "everyone introduced themselves in front of the class" },
      { val: "C", label: "she learnt about school life in Iceland" },
      { val: "D", label: "she could play games in every lesson" },
    ],
    answer: "C",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find the paragraph about the second day:{" "}
        <em>&quot;We joined lessons with the local students... I learnt about their school life and
        what they did after school.&quot;</em>
      </>
    ),
    strategy: (
      <>
        Reread some parts to confirm your understanding. Check each answer. Be careful — clapping and introducing themselves
        happened on the <em>first</em> day, not the second. Games were on the first{" "}day too, not
        &quot;every lesson&quot;.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. she learnt about school life in Iceland</strong>
        <br />
        <br />
        The second-day clue is <em>&quot;I learnt about their school life and what they did after
        school&quot;</em>. Clapping (A) and introducing themselves (B) happened on the first day, and
        games were on the first day, not every lesson (D).
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: 'In the whale-watching part, "I bought a postcard of one for you." The word "one" refers to a ______.',
    options: [
      { val: "A", label: "whale" },
      { val: "B", label: "boat" },
      { val: "C", label: "puffin" },
      { val: "D", label: "city" },
    ],
    answer: "A",
    clues: ["q5"],
    hint: (
      <>
        <strong>💡 Hint: </strong> A word like &quot;one&quot; points back to a noun just before it.
        Read: <em>&quot;We saw whales breaching the surface. They were beautiful! I bought a postcard
        of one for you.&quot;</em>
      </>
    ),
    strategy: (
      <>
        &quot;They&quot; and &quot;one&quot; both
        refer to the nearest noun. The boat is only transport; the puffin appears
        later and Susan never saw one.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. whale</strong>
        <br />
        <br />
        The sentence just before says <em>&quot;We saw whales... They were beautiful!&quot;</em>, so
        &quot;one&quot; means one whale. The boat (B) is only transport, the puffin (C) was never
        seen, and the city (D) is too far from &quot;one&quot;.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: "Susan was disappointed because the ______.",
    options: [
      { val: "A", label: "whales did not swim" },
      { val: "B", label: "puffins were not there yet" },
      { val: "C", label: "Arctic foxes were hiding" },
      { val: "D", label: "Icelandic horses were not there yet" },
    ],
    answer: "B",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint: </strong> The word &quot;disappointed&quot; is not in the text, but a related
        feeling is: <em>&quot;Sadly, I did not see any puffins. It was not the right season
        yet.&quot;</em>
      </>
    ),
    strategy: (
      <>
        Interpret the feelings expressed by the writer. &quot;Sadly&quot; shows a negative feeling
        like disappointment. Susan <em>saw</em> whales breaching (so they swam) and <em>saw</em>{" "}
        Arctic foxes (so they were not hiding).
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. puffins were not there yet</strong>
        <br />
        <br />
        <em>&quot;Sadly, I did not see any puffins. It was not the right season yet&quot;</em> is the
        clue. The whales were breaching, so they swam (A); the foxes were seen, so not hiding (C);
        and horses (D) are never mentioned.
      </>
    ),
  },
  {
    id: 7,
    part: "part3",
    text: "What might Susan and Rebecca do in the future? ______ is the best answer.",
    options: [
      { val: "A", label: "design a postcard" },
      { val: "B", label: "go on a trip together" },
      { val: "C", label: "open a zoo" },
      { val: "D", label: "visit Hong Kong Park" },
    ],
    answer: "B",
    clues: ["q7"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look near the end of the email:{" "}
        <em>&quot;I hope we can travel together one day.&quot;</em>
      </>
    ),
    strategy: (
      <>
        If Susan hopes they can travel together, then going
        on a trip together is the most reasonable future plan. Check each answer. Some of them are never mentioned in the text.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. go on a trip together</strong>
        <br />
        <br />
        <em>&quot;I hope we can travel together one day&quot;</em> supports B. The email only says
        Susan <em>bought</em> a postcard, not designed one (A); opening a zoo (C) and Hong Kong Park
        (D) are never mentioned.
      </>
    ),
  },
  {
    id: 8,
    part: "part3",
    text: "What is the best subject for Susan's email?",
    options: [
      { val: "A", label: "A Wonderful School Trip" },
      { val: "B", label: "Animals in Iceland" },
      { val: "C", label: "My New Icelandic Friends" },
      { val: "D", label: "Tasty Food in Reykjavík" },
    ],
    answer: "A",
    clues: ["q8"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Skim the whole email. It is about a school study tour with many
        parts — a school visit, new friends, classes, famous places, animals and food. Which title
        covers <strong>all</strong> of it?
      </>
    ),
    strategy: (
      <>
        Skim the whole email again to get the main idea. The best subject covers the whole email. Animals,
        friends and food are each only one part of the trip.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. A Wonderful School Trip</strong>
        <br />
        <br />
        The whole email describes Susan&apos;s graduation study tour, so &quot;A Wonderful School
        Trip&quot; covers all the main ideas. Animals (B), friends (C) and food (D) are each only one
        small part of the trip.
      </>
    ),
  },
];
