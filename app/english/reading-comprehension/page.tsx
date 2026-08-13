"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Lock } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";

type Reading = {
  id: string;
  label: string;
  title: string;
  description: string;
  /** Where selecting this reading takes the student. Required when available. */
  href?: string;
  available: boolean;
};

type Cycle = {
  id: string;
  label: string;
  readings: Reading[];
};

// Only Cycle 1 · Reading 1 has content today. Add an `href` and flip
// `available` to true as new readings are authored.
const cycles: Cycle[] = [
  {
    id: "cycle-1",
    label: "Cycle 1",
    readings: [
      {
        id: "reading-1",
        label: "Reading 1",
        title: "Sunshine Ice-cream Webpage",
        description:
          "An ice-cream shop webpage with an advertisement and a comments section.",
        href: "/english/reading-comprehension/modes",
        available: true,
      },
      {
        id: "reading-2",
        label: "Reading 2",
        title: "Amazing Animals",
        description:
          "An encyclopedia entry about two amazing animals: a sea creature and a bird.",
        href: "/english/reading-comprehension/reading-2",
        available: true,
      },
      {
        id: "reading-3",
        label: "Reading 3",
        title: "Pip the Dragon",
        description:
          "A story about a dragon, a swan, and a village that learns not to judge by looks.",
        href: "/english/reading-comprehension/reading-3",
        available: true,
      },
    ],
  },
  {
    id: "cycle-2",
    label: "Cycle 2",
    readings: [
      {
        id: "reading-1",
        label: "Reading 1",
        title: "Story Day Poster",
        description:
          "A school poster for Story Day, with a dress code and a list of reading activities.",
        href: "/english/reading-comprehension/cycle-2-reading-1",
        available: true,
      },
      {
        id: "reading-2",
        label: "Reading 2",
        title: "Chop Makers",
        description:
          "An informational article about Hong Kong chop makers — their history, their work, and their future.",
        href: "/english/reading-comprehension/cycle-2-reading-2",
        available: true,
      },
      {
        id: "reading-3",
        label: "Reading 3",
        title: "An Email",
        description:
          "An email about a graduation study tour in Iceland — school visits and sightseeing",
        href: "/english/reading-comprehension/cycle-2-reading-3",
        available: true,
      },
    ],
  },
  {
    id: "cycle-3",
    label: "Cycle 3",
    readings: [
      {
        id: "reading-1",
        label: "Reading 1",
        title: "Detective Lee and the Gold Watch",
        description:
          "A book blurb for a children's detective story — an introduction, book reviews, and a call to read the series.",
        href: "/english/reading-comprehension/cycle-3-reading-1",
        available: true,
      },
      {
        id: "reading-2",
        label: "Reading 2",
        title: "Make a Balloon Puff Up",
        description:
          "A science experiment sheet — materials, safety tips, steps, and the reaction.",
        href: "/english/reading-comprehension/cycle-3-reading-2",
        available: true,
      },
      {
        id: "reading-3",
        label: "Reading 3",
        title: "A Newspaper Article",
        description:
          "An information article about red tides — where they happened, what they are, why they form, and how to protect the sea.",
        href: "/english/reading-comprehension/cycle-3-reading-3",
        available: true,
      },
    ],
  },
];

export default function EnglishReadingComprehensionLandingPage() {
  const router = useRouter();

  function selectReading(reading: Reading) {
    if (!reading.available || !reading.href) return;
    router.push(reading.href);
  }

  return (
    <>
      <Header backHref="/english" backLabel="Back to English" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(165deg,_#ffffff_0%,_#f7fbff_52%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.14),_transparent_48%)]" />
        <div className="absolute right-0 top-20 h-56 w-56 translate-x-1/4 rounded-full bg-[#146ef5]/10 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-10 py-2">
            <section className="space-y-3 px-2 sm:px-0">
              <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#ababab]">
                Reading Comprehension
              </p>
              <h1 className="text-[34px] leading-[1.04] font-semibold tracking-[-0.03em] text-[#080808] sm:text-[40px]">
                Choose a reading to begin
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[#5a5a5a]">
                Pick a reading article first. Then you can learn reading comprehension skills with guided practice or join an AI role-play discussion.
              </p>
            </section>

            {cycles.map((cycle) => (
              <section key={cycle.id} className="space-y-4 px-2 sm:px-0">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#080808]">
                  {cycle.label}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cycle.readings.map((reading) => {
                    const Icon = reading.available ? BookOpen : Lock;
                    return (
                      <button
                        key={reading.id}
                        onClick={() => selectReading(reading)}
                        disabled={!reading.available}
                        className={`group relative flex min-h-[200px] flex-col overflow-hidden rounded-[8px] border p-6 text-left transition duration-200 ${
                          reading.available
                            ? "cursor-pointer border-[#d8d8d8] bg-white hover:translate-x-[6px] hover:-translate-y-[2px] hover:border-[#080808]"
                            : "cursor-not-allowed border-dashed border-[#e2e2e2] bg-[#fafafa]"
                        }`}
                      >
                        <div className="relative flex items-center justify-between gap-4">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-[4px] ${
                              reading.available
                                ? "bg-[#146ef5] text-white shadow-[6px_6px_0px_#080808]"
                                : "bg-[#e2e2e2] text-[#9a9a9a]"
                            }`}
                          >
                            <Icon className="size-5" />
                          </div>
                          {reading.available ? (
                            <Badge className="rounded-[4px] border-0 bg-[#146ef5]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#146ef5]">
                              Live
                            </Badge>
                          ) : (
                            <Badge className="rounded-[4px] border-0 bg-[#ededed] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#9a9a9a]">
                              Soon
                            </Badge>
                          )}
                        </div>

                        <div className="relative mt-6 space-y-2">
                          <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#ababab]">
                            {reading.label}
                          </p>
                          <h3
                            className={`text-[22px] leading-[1.1] font-semibold tracking-[-0.02em] ${
                              reading.available ? "text-[#080808]" : "text-[#9a9a9a]"
                            }`}
                          >
                            {reading.title}
                          </h3>
                          <p className="text-sm leading-6 text-[#5a5a5a]">
                            {reading.description}
                          </p>
                        </div>

                        {reading.available && (
                          <div className="relative mt-auto pt-5">
                            <span className="inline-flex items-center gap-2 text-sm font-medium text-[#080808] transition-transform duration-200 group-hover:translate-x-[6px]">
                              Select
                              <ArrowRight className="size-4 text-[#146ef5]" />
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
