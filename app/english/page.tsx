"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Compass, FolderDown, Landmark, Route, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import { topicKey } from "@/lib/topics";

const topics = [
  {
    id: "location-direction",
    label: "Location and Direction",
    subtitle: "Map Language Lab",
    description: "Practice giving directions through map-based tasks.",
    icon: Route,
    color: "#146ef5",
    available: true,
  },
  {
    id: "thank-you-letter",
    label: "Thank-you Letter",
    subtitle: "Writing Practice",
    description: "Learn to draft sincere thank-you letters with proper structure, tone, and polite expressions.",
    icon: Landmark,
    color: "#00d722",
    available: true,
  },
  {
    id: "reading-comprehension",
    label: "Reading Comprehension",
    subtitle: "Reading Skills",
    description: "Strengthen reading skills through guided passages, key idea spotting, and inference practice.",
    icon: Compass,
    color: "#ff6b00",
    available: true,
  },
  {
    id: "learning-materials",
    label: "Learning Materials",
    subtitle: "Resource Library",
    description: "Download supplementary worksheets, references, and class resources for English.",
    icon: FolderDown,
    color: "#7a3dff",
    available: true,
  },
];

export default function EnglishPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Topics the school closed in 學校管理 are not rendered at all; the routes are
  // guarded server-side as well (see app/english/*/layout.tsx).
  const visibleTopics = topics.filter((t) =>
    (user?.topics ?? []).includes(topicKey("english", t.id)),
  );

  function navigateToTopic(topicId: string, available: boolean) {
    if (!available) return;
    if (topicId === "thank-you-letter") {
      router.push("/english/thankyouletter");
      return;
    }
    if (topicId === "reading-comprehension") {
      router.push("/english/reading-comprehension");
      return;
    }
    if (topicId === "learning-materials") {
      router.push("/english/materials");
      return;
    }

    router.push(`/english/dashboard?topic=${topicId}`);
  }

  return (
    <>
      <Header backHref="/" backLabel="Select Subject" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(165deg,_#ffffff_0%,_#f7fbff_52%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.14),_transparent_48%)]" />
        <div className="absolute right-0 top-20 h-56 w-56 translate-x-1/4 rounded-full bg-[#146ef5]/10 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-10 py-2">
            <section className="grid gap-4 px-2 sm:px-0 md:grid-cols-2 xl:grid-cols-3">
              {!loading && visibleTopics.length === 0 && (
                <p className="rounded-[8px] border border-dashed border-[#d8d8d8] p-6 text-sm text-[#5a5a5a] md:col-span-2 xl:col-span-3">
                  No topics are open for this subject yet. Please contact your administrator.
                </p>
              )}
              {visibleTopics.map(({ id, label, subtitle, description, icon: Icon, color, available }) => (
                <button
                  key={id}
                  onClick={() => navigateToTopic(id, available)}
                  disabled={!available}
                  className={[
                    "group relative flex min-h-[320px] flex-col overflow-hidden rounded-[8px] border p-6 text-left transition duration-200",
                    available
                      ? "cursor-pointer border-[#d8d8d8] bg-white hover:translate-x-[6px] hover:-translate-y-[2px] hover:border-[#080808]"
                      : "cursor-not-allowed border-[#d8d8d8] bg-[#f3f3f1]",
                  ].join(" ")}
                >
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl" style={{ backgroundColor: `${color}22` }} />

                  <div className="relative flex items-center justify-between gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                      style={{ backgroundColor: color }}
                    >
                      <Icon className="size-5" />
                    </div>
                    {available ? (
                      <Badge className="rounded-[4px] border-0 bg-[#146ef5]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#146ef5]">
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-[4px] border-0 bg-[#080808]/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#5a5a5a]">
                        Coming soon
                      </Badge>
                    )}
                  </div>

                  <div className="relative mt-10 space-y-4">
                    <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#ababab]">
                      {subtitle}
                    </p>
                    <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] text-[#080808]">
                      {label}
                    </h2>
                    <p className="text-sm leading-7 text-[#5a5a5a]">
                      {description}
                    </p>
                  </div>

                  <div className="relative mt-auto border-t border-[#d8d8d8] pt-5">
                    {available ? (
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-[#080808] transition-transform duration-200 group-hover:translate-x-[6px]">
                        Start this topic
                        <ArrowRight className="size-4 text-[#146ef5]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-[#5a5a5a]">
                        Waiting for release
                        <Sparkles className="size-4 text-[#7a3dff]" />
                      </span>
                    )}
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
