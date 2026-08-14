"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  BookOpen,
  Globe,
  FlaskConical,
  Landmark,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";

const subjects = [
  {
    id: "math",
    label: "數學科",
    labelEn: "Mathematics",
    description: "解題工具與即時回饋。",
    icon: Calculator,
    href: "/math",
    available: true,
    accent: "#146ef5",
  },
  {
    id: "chinese",
    label: "中國語文科",
    labelEn: "Chinese Language",
    description: "閱讀理解與寫作引導。",
    icon: BookOpen,
    href: "/chinese",
    available: true,
    accent: "#7a3dff",
  },
  {
    id: "english",
    label: "英國語文科",
    labelEn: "English Language",
    description: "Location and direction, Thank-you Letter, Reading Comprehension.",
    icon: Globe,
    href: "/english",
    available: true,
    accent: "#00d722",
  },
  {
    id: "science",
    label: "科學科",
    labelEn: "Science",
    description: "電路、航天科技。",
    icon: FlaskConical,
    href: "/science",
    available: true,
    accent: "#ff6b00",
  },
  {
    id: "humanities",
    label: "人文科",
    labelEn: "Humanities",
    description: "水資源、抗日戰爭。",
    icon: Landmark,
    href: "/humanities",
    available: true,
    accent: "#ed52cb",
  },
];

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const userSubjects = user?.subjects ?? [];

  // Only the subjects the user's school has opened for them are shown at all.
  // `subjects` comes from /api/auth/me, which resolves it from the database, so
  // a subject revoked in 學校管理 disappears on the next load.
  const visibleSubjects = subjects.filter(({ id }) =>
    userSubjects.includes(id as import("@/models/User").Subject),
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return (
    <>
      <Header />

      <main className="relative flex flex-1 items-start overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(20,110,245,0.1),_transparent_26%),radial-gradient(circle_at_100%_10%,_rgba(237,82,203,0.1),_transparent_20%),linear-gradient(180deg,_#ffffff_0%,_#f7f8fb_100%)] text-[#080808]">
        <div className="absolute left-0 top-0 h-44 w-44 -translate-x-1/3 -translate-y-1/4 rounded-full bg-[#146ef5]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-56 w-56 translate-x-1/4 translate-y-1/4 rounded-full bg-[#7a3dff]/10 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col">
            <section className="px-1 py-3 sm:px-0 sm:py-6 lg:py-8">
              <h1 className="max-w-3xl text-[28px] leading-[1.05] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[40px] sm:leading-[0.98] sm:tracking-[-0.05em] md:text-[52px] lg:text-[64px]">
                選擇你要進入的學習科目
              </h1>
            </section>

            {/* Teachers review student records here rather than inside each topic. */}
            {!loading && user?.role === "teacher" && (
              <section className="px-1 sm:px-0">
                <button
                  onClick={() => router.push("/teacher/student-data")}
                  className="group flex w-full items-center gap-4 rounded-[8px] border border-[#d8d8d8] bg-white p-5 text-left transition duration-200 hover:translate-x-[6px] hover:border-[#080808] sm:p-6"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-[#146ef5] text-white shadow-[6px_6px_0px_#080808] sm:h-12 sm:w-12">
                    <BarChart3 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold uppercase tracking-[1.4px] text-[#ababab]">
                      Teacher · Student Data
                    </p>
                    <h2 className="mt-1 text-[22px] leading-[1.05] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[26px]">
                      查看學生數據
                    </h2>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-[#146ef5] transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </section>
            )}

            <section className="px-1 py-3 sm:px-0 sm:py-6 lg:py-8">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {subjects.map(({ id }) => (
                    <div
                      key={id}
                      className="animate-pulse rounded-[8px] border border-[#d8d8d8] bg-[#f7f8fb] p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="h-12 w-12 rounded-[4px] bg-white" />
                        <div className="h-6 w-20 rounded-[4px] bg-white" />
                      </div>
                      <div className="mt-8 space-y-3">
                        <div className="h-8 w-2/3 rounded-[4px] bg-white" />
                        <div className="h-4 w-1/2 rounded-[4px] bg-white" />
                        <div className="h-4 w-full rounded-[4px] bg-white" />
                        <div className="h-4 w-5/6 rounded-[4px] bg-white" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visibleSubjects.length === 0 ? (
                <div className="rounded-[8px] border border-[#d8d8d8] bg-white p-6 sm:p-8">
                  <p className="text-[12px] font-semibold uppercase tracking-[1.4px] text-[#ababab]">
                    No subjects yet
                  </p>
                  <h2 className="mt-2 text-[24px] leading-[1.05] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[28px]">
                    尚未開通任何科目
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[#5a5a5a]">
                    你的帳戶目前沒有可進入的科目，請聯絡管理員開通權限。
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleSubjects.map(
                    ({ id, label, labelEn, description, icon: Icon, href, available, accent }) => {
                      const enabled = available;
                      const statusLabel = available ? "可進入" : "即將推出";
                      const statusClass = available
                        ? "bg-[#146ef5]/10 text-[#146ef5]"
                        : "bg-[#080808]/6 text-[#5a5a5a]";

                      return (
                        <button
                          key={id}
                          onClick={() => enabled && router.push(href)}
                          disabled={!enabled}
                          className={[
                            "group relative flex min-h-[220px] flex-col rounded-[8px] border p-5 text-left transition duration-200 sm:min-h-[280px] sm:p-6",
                            enabled
                              ? "cursor-pointer border-[#d8d8d8] bg-white hover:translate-x-[6px] hover:border-[#080808]"
                              : "cursor-not-allowed border-[#d8d8d8] bg-[#f7f8fb]",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808] sm:h-12 sm:w-12"
                              style={{ backgroundColor: accent }}
                            >
                              <Icon className="size-5" />
                            </div>
                            <span
                              className={[
                                "inline-flex rounded-[4px] px-3 py-1 text-[12px] font-semibold uppercase tracking-[1px]",
                                statusClass,
                              ].join(" ")}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          <div className="mt-6 space-y-2 sm:mt-10 sm:space-y-3">
                            <div>
                              <p className="text-[12px] font-semibold uppercase tracking-[1.4px] text-[#ababab]">
                                {labelEn}
                              </p>
                              <h2 className="mt-2 text-[24px] leading-[1.05] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[28px]">
                                {label}
                              </h2>
                            </div>
                            <p className="max-w-sm text-sm leading-6 text-[#5a5a5a]">
                              {description}
                            </p>
                          </div>

                          <div className="mt-auto flex items-center justify-between border-t border-[#d8d8d8] pt-4 text-sm sm:pt-5">
                            <span className="font-medium text-[#363636]">
                              {enabled ? "進入科目學習" : "功能正在準備中"}
                            </span>
                            <ArrowRight
                              className={[
                                "size-4 transition-transform duration-200",
                                enabled ? "text-[#146ef5] group-hover:translate-x-1" : "text-[#ababab]",
                              ].join(" ")}
                            />
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
