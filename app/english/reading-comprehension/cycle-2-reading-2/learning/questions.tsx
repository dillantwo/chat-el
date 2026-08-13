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
  /** Optional rich block (e.g. a dictionary entry) shown above the options. */
  extra?: ReactNode;
  options: Option[];
  answer: string;
  /** Clue ids highlighted in the article when this question is hinted/answered. */
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
    text: "In the past, people went to chop makers because they ______.",
    options: [
      { val: "A", label: "needed chops for papers and other things" },
      { val: "B", label: "could not paint pictures" },
      { val: "C", label: "only used computers at work" },
      { val: "D", label: "were too busy to write their names" },
    ],
    answer: "A",
    clues: ["q1", "q1b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read Paragraph 1 again. It says people used seals (chops) on{" "}
        <em>&quot;letters, business documents and paintings&quot;</em>, and{" "}
        <em>&quot;went to chop makers to help them make chops.&quot;</em> Why did they need a chop
        maker?
      </>
    ),
    strategy: (
      <>
        Look at the clues in the text, then check each answer. The best answer has the most
        supporting details in the clues. People in the old days did not use computer. &quot;Could
        not paint pictures&quot; or &quot;were too busy to write their names&quot; are not mentioned
        in the text.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. needed chops for papers and other things</strong>
        <br />
        <br />
        The paragraph lists <em>&quot;letters, business documents and paintings&quot;</em>, so people
        needed chops for papers and other things. &quot;Could not paint&quot; (B) and &quot;too
        busy&quot; (D) are never mentioned, and computers (C) belong to today, not the past.
      </>
    ),
  },
  {
    id: 2,
    part: "part2",
    text: "Before carving, a chop maker asked customers to ______ first.",
    options: [
      { val: "A", label: "pay" },
      { val: "B", label: "draw a painting" },
      { val: "C", label: "show a business document" },
      { val: "D", label: "tell them what kind of chop they want" },
    ],
    answer: "D",
    clues: ["q2"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Look for the clue about what happens{" "}
        <em>before carving</em>:{" "}
        <em>&quot;they asked customers what materials, words and styles they wanted.&quot;</em>
      </>
    ),
    strategy: (
      <>
        &quot;Materials, words and styles&quot; is the same as
        deciding what kind of chop you want. &quot;Pay&quot; is never mentioned, and painting or a
        business document is only for some customers, not everyone.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: D. tell them what kind of chop they want</strong>
        <br />
        <br />
        The clue <em>&quot;asked customers what materials, words and styles they wanted&quot;</em>{" "}
        matches telling the chop maker what kind of chop you want. &quot;Pay&quot; (A) is never
        mentioned; a painting (B) or business document (C) may only be needed by some customers, and they are not necessary before having a chop made.
      </>
    ),
  },
  {
    id: 3,
    part: "part2",
    text: "Paragraph 2 is mainly about ______.",
    options: [
      { val: "A", label: "customers of chop makers" },
      { val: "B", label: "how to make a chop" },
      { val: "C", label: "things chop makers did" },
      { val: "D", label: "why Chop Alley became famous" },
    ],
    answer: "C",
    clues: ["q3"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Skim Paragraph 2 and look for a topic sentence. The first sentence
        is <em>&quot;Chop makers did many kinds of work.&quot;</em>
      </>
    ),
    strategy: (
      <>
        You can look for a topic sentence. The best answer covers most of the paragraph.
        Customers, the steps of making a chop, and Chop Alley are each only a small part.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. things chop makers did</strong>
        <br />
        <br />
        The topic sentence <em>&quot;Chop makers did many kinds of work&quot;</em> tells us the
        paragraph is about their work. Customers (A) and Chop Alley (D) are only small parts, and the
        paragraph never explains the steps of how to make a chop (B).
      </>
    ),
  },
  {
    id: 4,
    part: "part2",
    text: 'In this paragraph, what does the underlined word "peak" mean?',
    extra: (
      <div className="dict-entry">
        <div className="dict-head">
          <span className="dict-word">peak</span>
          <span className="dict-pos">noun</span>
          <span className="dict-pron">/piːk/</span>
        </div>
        <ol className="dict-senses">
          <li>
            the time when something is best, most successful, etc.
            <span className="dict-eg">The football player reached his peak at 30.</span>
          </li>
          <li>
            the mountain or the pointed part of the mountain
            <span className="dict-eg">This is the most difficult peak to climb in the world.</span>
          </li>
          <li>
            any arrow and pointed shape
            <span className="dict-eg">Beat the egg whites until soft peaks form.</span>
          </li>
          <li>
            the front part of a cap that is above your eyes
            <span className="dict-eg">There is a special design on the peak of the cap.</span>
          </li>
        </ol>
      </div>
    ),
    options: [
      { val: "A", label: "1" },
      { val: "B", label: "2" },
      { val: "C", label: "3" },
      { val: "D", label: "4" },
    ],
    answer: "A",
    clues: ["q4"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Find the sentence with &quot;peak&quot;:{" "}
        <em>&quot;At its peak, there were many chop maker stalls in Man Wa Lane...&quot;</em> Man Wa
        Lane is a place, not a mountain. Which meaning fits?
      </>
    ),
    strategy: (
      <>
        Use the words around &quot;peak&quot;. Because there
        were <em>many</em> stalls, it was the time when chop makers were most successful. Use your background knowledge to fill in the gap and make an inference.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: A. 1 (the time when something is best, most successful)</strong>
        <br />
        <br />
        <em>&quot;At its peak, there were many chop maker stalls&quot;</em> means the time when chop
        makers were most successful. Man Wa Lane is a place, not a mountain (2), and shapes (3) and
        caps (4) are not relevant here.
      </>
    ),
  },
  {
    id: 5,
    part: "part3",
    text: "In the future, chop makers will ______.",
    options: [
      { val: "A", label: "open more stalls" },
      { val: "B", label: "have fewer customers" },
      { val: "C", label: "learn to use pens" },
      { val: "D", label: "move all their shops to offices" },
    ],
    answer: "B",
    clues: ["q5", "q5b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Read the end of this paragraph:{" "}
        <em>&quot;fewer people need chops every day&quot;</em> and{" "}
        <em>&quot;chop makers may slowly disappear from Hong Kong.&quot;</em> What does this mean?
      </>
    ),
    strategy: (
      <>
        Link the clues together. If fewer people need chops, chop
        makers will have fewer customers. &quot;Open more stalls&quot; is the opposite of the text,
        and pens and offices are not what the text says about chop makers.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: B. have fewer customers</strong>
        <br />
        <br />
        The clues <em>&quot;fewer people need chops&quot;</em> and{" "}
        <em>&quot;Fewer and fewer chop makers still work in Chop Alley&quot;</em> show they will have
        fewer customers. &quot;Open more stalls&quot; (A) is the opposite; pens (C) and offices (D)
        are just distractors.
      </>
    ),
  },
  {
    id: 6,
    part: "part3",
    text:
      "Based on all three paragraphs, it is around Chinese New Year and an old shop owner goes to a chop maker to help him ______.",
    options: [
      { val: "A", label: "draw a traditional Chinese painting for his shop" },
      { val: "B", label: "carve a stone fortune cat to put in his shop" },
      { val: "C", label: "make a new company chop for his shop" },
      { val: "D", label: "write an email to his grandson living overseas" },
    ],
    answer: "C",
    clues: ["q6a", "q6b"],
    hint: (
      <>
        <strong>💡 Hint:</strong> Choose the answer with the strongest support across the text.
        Chop makers <em>&quot;made personal name chops and company chops&quot;</em>, and most of
        their customers are <em>&quot;older people or small shop owners&quot;</em>.
      </>
    ),
    strategy: (
      <>
        Link clues from more than one paragraph. Chop makers do
        not draw paintings or carve fortune cats, and writing emails is not their work — The correct answer
        matches both what they do and who their customers are.
      </>
    ),
    explain: (
      <>
        <strong>✅ Correct: C. make a new company chop for his shop</strong>
        <br />
        <br />
        This matches <em>&quot;They made personal name chops and company chops&quot;</em> and{" "}
        <em>&quot;Most of their customers are older people or small shop owners&quot;</em>. The text
        never says chop makers draw paintings (A), carve fortune cats (B), or write emails (D).
      </>
    ),
  },
];
