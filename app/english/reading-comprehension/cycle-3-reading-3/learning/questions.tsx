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
  /** Clue ids highlighted in the article when this question is hinted/answered. */
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
    text: "What happened at Stanley Bay in April 2026?",
    options: [
      { val: "A", label: "Many people went swimming there." },
      { val: "B", label: "A red tide happened there." },
      { val: "C", label: "Three red tides appeared there." },
      { val: "D", label: "Many fish died there." },
    ],
    answer: "B",
    clues: ["q1"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look for the keywords <em>&quot;Stanley Bay&quot;</em> and{" "}
        <em>&quot;April 2026&quot;</em>:{" "}
        <em>&quot;In April 2026, a red tide appeared at Stanley Bay.&quot;</em>
      </>
    ),
    strategy: (
      <>
        Scan for the keywords and read the first sentence. A red tide{" "}
        <em>appeared</em> at Stanley Bay — that is the clue. People were told <em>not</em> to swim, the three red tides were in different places.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. A red tide happened there.</strong>
        <br />
        <br />
        The text says <em>&quot;In April 2026, a red tide appeared at Stanley Bay.&quot;</em> People
        were told not to swim, so A is wrong. Only one red tide was at Stanley Bay — the other two
        were in Sai Kung and in May (C). <em>&quot;Luckily, no fish died&quot;</em> makes D wrong.
      </>
    ),
  },
  {
    id: 2,
    part: "part1",
    text: "What did the government do after the red tides appeared?",
    options: [
      { val: "A", label: "It told people to swim carefully." },
      { val: "B", label: "It told people not to swim there." },
      { val: "C", label: "It closed all beaches in Hong Kong." },
      { val: "D", label: "It asked people not to eat fish in Hong Kong." },
    ],
    answer: "B",
    clues: ["q2"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find the keyword <em>&quot;government&quot;</em>:{" "}
        <em>
          &quot;The government warned the public about the problem. People were told not to swim
          there until it was safe again.&quot;
        </em>
      </>
    ),
    strategy: (
      <>
        Scan for <em>&quot;government&quot;</em> and read the sentences after
        it. People were told <em>not</em> to swim. Closing all beaches and not
        eating fish are not in the text.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. It told people not to swim there.</strong>
        <br />
        <br />
        <em>&quot;People were told not to swim there until it was safe again.&quot;</em> A is the
        opposite. C (closing all beaches) is never said. D may seem possible, but there is no
        evidence for it in the text.
      </>
    ),
  },
  {
    id: 3,
    part: "part1",
    text: "People stay out of the sea when there is a red tide because ______.",
    options: [
      { val: "A", label: "some algal blooms may harm people." },
      { val: "B", label: "some fish may attack people." },
      { val: "C", label: "there are not many people at the beach." },
      { val: "D", label: "the sea becomes too hot." },
    ],
    answer: "A",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read paragraph 2:{" "}
        <em>
          &quot;Some algal blooms can kill fish and harm people. People should stay out of the sea
          when there is a red tide because it may be unsafe.&quot;
        </em>{" "}
        Why is the sea unsafe?
      </>
    ),
    strategy: (
      <>
        The text says the sea <em>&quot;may be unsafe&quot;</em>. Re-read the
        nearby sentences to find <em>why</em>: some algal blooms can harm people. Fish attacks 
        are never mentioned.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. some algal blooms may harm people.</strong>
        <br />
        <br />
        The sea <em>&quot;may be unsafe&quot;</em> because{" "}
        <em>&quot;some algal blooms can kill fish and harm people.&quot;</em> Fish attacking people
        (B) is not in the text. C and D may be true, but they do not answer why the sea is unsafe.
      </>
    ),
  },
  {
    id: 4,
    part: "part1",
    text: "Paragraph 2 is mainly about ______.",
    options: [
      { val: "A", label: "the algal blooms around the world" },
      { val: "B", label: "what algae look like" },
      { val: "C", label: "the dangers of red tides" },
      { val: "D", label: "how to swim safely when there is a red tide" },
    ],
    answer: "C",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read the whole of paragraph 2 again to get the{" "}
        <strong>main idea</strong>. It talks about algae being <em>dangerous</em>, blooms that{" "}
        <em>kill fish and harm people</em>, and staying out of the <em>unsafe</em> sea.
      </>
    ),
    strategy: (
      <>
        Skim for the main idea, not one small detail. Blooms around the
        world is only one line; the paragraph never describes what algae look like; it says
        to stay <em>out</em> of the sea, not how to swim safely.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. the dangers of red tides</strong>
        <br />
        <br />
        Paragraph 2 is mostly about how red tides can be dangerous — algae can be harmful, blooms
        can kill fish and harm people, and the sea can be unsafe. A and B are small details, and D
        is wrong because the text says to stay <em>out</em> of the sea.
      </>
    ),
  },
  {
    id: 5,
    part: "part2",
    text: "What is an algal bloom?",
    options: [
      { val: "A", label: "a place where fish and plants live" },
      { val: "B", label: "the quick growth of algae in the water" },
      { val: "C", label: "dirty water from farms and gardens" },
      { val: "D", label: "a kind of living thing in the sea" },
    ],
    answer: "B",
    clues: ["q5"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find <em>&quot;algal bloom&quot;</em> in paragraph 2:{" "}
        <em>
          &quot;They occur when tiny living things called algae grow very quickly in the water. This
          sudden growth is called an algal bloom.&quot;
        </em>
      </>
    ),
    strategy: (
      <>
        Look for the exact words <em>&quot;algal bloom&quot;</em>. The sentence
        before it explains it is the <em>sudden growth</em> of algae. Be careful: <em>algae</em>{" "}
        are the living things, not the bloom.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. the quick growth of algae in the water</strong>
        <br />
        <br />
        The text says algae <em>&quot;grow very quickly in the water. This sudden growth is called
        an algal bloom.&quot;</em> A is not correct; C is about nutrients (paragraph 3); D describes{" "}
        <em>algae</em>, not the <em>bloom</em>.
      </>
    ),
  },
  {
    id: 6,
    part: "part2",
    text: 'In paragraph 3, what does the word "nutrients" mean?',
    options: [
      { val: "A", label: "things in water that help algae grow" },
      { val: "B", label: "small animals that eat algae" },
      { val: "C", label: "dirty things found only on beaches" },
      { val: "D", label: "colours that make the sea look red" },
    ],
    answer: "A",
    clues: ["q6"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find the word <em>&quot;nutrients&quot;</em> in paragraph 3:{" "}
        <em>
          &quot;Warm water, a lot of sunlight, and too many nutrients in the sea can help red tides
          form.&quot;
        </em>{" "}
        What do nutrients do?
      </>
    ),
    strategy: (
      <>
        Activate your background knowledge of the topic. Use the words around <em>&quot;nutrients&quot;</em> to guess its
        meaning. They <em>help red tides form</em> (help algae grow). Colours cannot help algae grow.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. things in water that help algae grow</strong>
        <br />
        <br />
        Nutrients <em>&quot;can help red tides form&quot;</em>, so they help algae grow. B is not in
        the text; nutrients come from dirty water, farms and gardens too, not <em>only</em> beaches
        (C); and colours cannot make algae grow (D).
      </>
    ),
  },
  {
    id: 7,
    part: "part2",
    text: "The writer is ______ red tides.",
    options: [
      { val: "A", label: "excited about" },
      { val: "B", label: "worried about" },
      { val: "C", label: "bored with" },
      { val: "D", label: "surprised by" },
    ],
    answer: "B",
    clues: ["q7", "q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Think about the writer&apos;s feeling. The writer talks about{" "}
        <em>danger</em>, <em>safety and protecting the environment.</em>
      </>
    ),
    strategy: (
      <>
        Interpret the writer&apos;s attitude: is it positive, neutral or
        negative? There is no evidence of excitement or boredom; red tides are a
        known problem, not a surprise.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. worried about</strong>
        <br />
        <br />
        The writer warns about danger and safety and asks us to keep the sea clean, which shows
        worry. There is no sign of excitement (A) or boredom (C). The text calls red tides a known
        problem, so the writer is not surprised (D).
      </>
    ),
  },
  {
    id: 8,
    part: "part3",
    text: "______ is the best title for this article.",
    options: [
      { val: "A", label: "The Sea Water Turns Red" },
      { val: "B", label: "Red Tides in Hong Kong" },
      { val: "C", label: "How Algae Grow in the Sea" },
      { val: "D", label: "Warnings at Hong Kong Beaches" },
    ],
    answer: "B",
    clues: [],
    hint: (
      <>
        <strong>💡 Hint:</strong> A good title covers the <strong>whole</strong> article. This
        article is about red tides — where they happened, what they are, why they
        happen, and what we can do.
      </>
    ),
    strategy: (
      <>
        Skim the whole text for the main idea. The best title must cover
        everything, not just one part.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. Red Tides in Hong Kong</strong>
        <br />
        <br />
        The whole article is about red tides in Hong Kong, so B fits best. A (&quot;The Sea Water
        Turns Red&quot;) and C (&quot;How Algae Grow&quot;) are too narrow, and D
        (&quot;Warnings&quot;) covers only one part of the article.
      </>
    ),
  },
];
