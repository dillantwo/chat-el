"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Drama } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";

const modes = [
  {
    id: "learning",
    label: "Learn Reading Comprehension",
    subtitle: "Guided Learning",
    description:
      "Learn skimming, scanning, and inference skills through interactive web examples and step-by-step practice.",
    icon: BookOpen,
    color: "#ff6b00",
  },
  {
    id: "roleplay",
    label: "AI Role-Play Practice",
    subtitle: "Reciprocal Reading",
    description:
      "Choose your role and join a reciprocal reading discussion with AI, taking turns to summarise, question, and explain new words.",
    icon: Drama,
    color: "#146ef5",
  },
];

export default function EnglishReadingComprehensionModesPage() {
  const router = useRouter();

  function navigateToMode(modeId: string) {
    if (modeId === "roleplay") {
      router.push("/english/reading-comprehension/roleplay");
      return;
    }
    if (modeId === "learning") {
      router.push("/english/reading-comprehension/learning");
    }
  }

  return (
    <>
      <Header backHref="/english/reading-comprehension" backLabel="Back to Readings" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(165deg,_#ffffff_0%,_#f7fbff_52%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.14),_transparent_48%)]" />
        <div className="absolute right-0 top-20 h-56 w-56 translate-x-1/4 rounded-full bg-[#146ef5]/10 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-10 py-2">
            <section className="space-y-3 px-2 sm:px-0">
              <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#ababab]">
                Cycle 1 · Reading 1 — Sunshine Ice-cream Webpage
              </p>
              <h1 className="text-[34px] leading-[1.04] font-semibold tracking-[-0.03em] text-[#080808] sm:text-[40px]">
                Choose how you want to learn
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[#5a5a5a]">
                Start with guided practice to learn reading comprehension skills, or jump straight into an AI role-play to reinforce what you have learned.
              </p>
            </section>

            <section className="grid gap-4 px-2 sm:px-0 md:grid-cols-2">
              {modes.map(({ id, label, subtitle, description, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => navigateToMode(id)}
                  className="group relative flex min-h-[320px] cursor-pointer flex-col overflow-hidden rounded-[8px] border border-[#d8d8d8] bg-white p-6 text-left transition duration-200 hover:translate-x-[6px] hover:-translate-y-[2px] hover:border-[#080808]"
                >
                  <div
                    className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl"
                    style={{ backgroundColor: `${color}22` }}
                  />

                  <div className="relative flex items-center justify-between gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                      style={{ backgroundColor: color }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <Badge className="rounded-[4px] border-0 bg-[#146ef5]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#146ef5]">
                      Live
                    </Badge>
                  </div>

                  <div className="relative mt-10 space-y-4">
                    <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#ababab]">
                      {subtitle}
                    </p>
                    <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] text-[#080808]">
                      {label}
                    </h2>
                    <p className="text-sm leading-7 text-[#5a5a5a]">{description}</p>
                  </div>

                  <div className="relative mt-auto border-t border-[#d8d8d8] pt-5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#080808] transition-transform duration-200 group-hover:translate-x-[6px]">
                      Start
                      <ArrowRight className="size-4 text-[#146ef5]" />
                    </span>
                  </div>
                </button>
              ))}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
