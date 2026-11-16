"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Landmark,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { useCopy, useLocale } from "@/components/LocaleProvider";
import StudentDataBrowser from "@/components/student-data/StudentDataBrowser";
import {
  STUDENT_DATA_CATALOG,
  fetchTeacherDataAccess,
  type StudentDataSubject,
  type TeacherClass,
} from "@/lib/student-data";
import type { SubjectValue } from "@/lib/subjects";
import { COMMON_COPY } from "@/lib/i18n/common";
import { defineCopy } from "@/lib/i18n/config";

const COPY = defineCopy({
  "zh-Hant": {
    backToSubjects: "返回科目",
    title: "查看學生數據",
    teachersOnly: "此頁面僅供教師查看學生數據。",
    noSubjects: "管理員尚未開放任何科目的學生數據查看權限，請聯絡管理員。",
    noClasses:
      "管理員尚未為你指派班級。你只能查看自己所屬班級的學生數據，請聯絡管理員指派班級。",
    classFilter: "班級",
    allClasses: "全部班級",
    classLabel: (name: string, year: string) => `${name}（${year}）`,
    yourClasses: "你所屬班級",
    scopeNote: (who: string) => `　只顯示 ${who}　的學生，僅供查看，無法修改。`,
  },
  en: {
    backToSubjects: "Back to subjects",
    title: "Student Data",
    teachersOnly: "Only teachers can view student data on this page.",
    noSubjects:
      "The admin has not given you access to student data for any subject yet. Please contact the admin.",
    noClasses:
      "The admin has not assigned you a class yet. You can only view students in your own classes. Please ask the admin to assign one.",
    classFilter: "Class",
    allClasses: "All classes",
    classLabel: (name: string, year: string) => `${name} (${year})`,
    yourClasses: "your classes",
    scopeNote: (who: string) => ` Only students in ${who} are shown. View only, no editing.`,
  },
});

const SUBJECT_ICONS: Record<SubjectValue, LucideIcon> = {
  math: Calculator,
  chinese: BookOpen,
  english: Globe,
  science: FlaskConical,
  humanities: Landmark,
};

/**
 * Deep link support: `/teacher/student-data?subject=humanities&view=humanities-podcast`.
 * Read once on mount from the URL rather than through useSearchParams, which
 * would force this client page behind a Suspense boundary for no benefit.
 */
function readDeepLink(): { subject: string | null; view: string | null } {
  if (typeof window === "undefined") return { subject: null, view: null };
  const params = new URLSearchParams(window.location.search);
  return { subject: params.get("subject"), view: params.get("view") };
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#d8d8d8] bg-white p-6 text-center text-sm text-[#5a5a5a]">
      {children}
    </div>
  );
}

export default function StudentDataPage() {
  const { user, loading: authLoading } = useAuth();
  const copy = useCopy(COPY);
  const common = useCopy(COMMON_COPY);
  const { locale } = useLocale();
  const isTeacher = user?.role === "teacher";

  const [allowedSubjects, setAllowedSubjects] = useState<SubjectValue[]>([]);
  const [myClasses, setMyClasses] = useState<TeacherClass[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState<SubjectValue | null>(null);
  const [activeViewKey, setActiveViewKey] = useState<string | null>(null);
  // Empty means every class this teacher belongs to.
  const [activeClassId, setActiveClassId] = useState("");

  // Permissions come from the server on every visit, so a change an admin just
  // made applies without the teacher having to log out and back in.
  useEffect(() => {
    if (authLoading) return;
    if (!isTeacher) {
      setPermissionsLoading(false);
      return;
    }

    let cancelled = false;
    fetchTeacherDataAccess()
      .then((access) => {
        if (cancelled) return;
        setAllowedSubjects(access.subjects);
        setMyClasses(access.classes);
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isTeacher]);

  // Only subjects the teacher may review, in catalogue order.
  const subjects: StudentDataSubject[] = useMemo(
    () => STUDENT_DATA_CATALOG.filter((entry) => allowedSubjects.includes(entry.subject)),
    [allowedSubjects],
  );

  // Pick the initial subject/view, honouring the deep link when it is allowed.
  useEffect(() => {
    if (subjects.length === 0 || activeSubject) return;

    const { subject: linkedSubject, view: linkedView } = readDeepLink();
    const entry =
      subjects.find((s) => s.subject === linkedSubject) ??
      subjects.find((s) => s.views.some((v) => v.key === linkedView)) ??
      subjects[0];

    setActiveSubject(entry.subject);
    setActiveViewKey(
      entry.views.find((v) => v.key === linkedView)?.key ?? entry.views[0]?.key ?? null,
    );
  }, [subjects, activeSubject]);

  const subjectEntry = subjects.find((s) => s.subject === activeSubject) ?? null;
  const activeView =
    subjectEntry?.views.find((v) => v.key === activeViewKey) ?? subjectEntry?.views[0] ?? null;

  function selectSubject(entry: StudentDataSubject) {
    setActiveSubject(entry.subject);
    setActiveViewKey(entry.views[0]?.key ?? null);
  }

  return (
    <>
      <Header backHref="/" backLabel={copy.backToSubjects} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f4] text-[#080808]">
        <div className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-[#146ef5] text-white shadow-[4px_4px_0px_#080808]">
              <BarChart3 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#ababab]">
                Teacher · Student Data
              </p>
              <h1 className="truncate text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">
                {copy.title}
              </h1>
            </div>
          </div>

          {authLoading || permissionsLoading ? (
            <Notice>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {common.loading}
              </span>
            </Notice>
          ) : !isTeacher ? (
            <Notice>{copy.teachersOnly}</Notice>
          ) : subjects.length === 0 ? (
            <Notice>{copy.noSubjects}</Notice>
          ) : myClasses.length === 0 ? (
            <Notice>{copy.noClasses}</Notice>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {subjects.map((entry) => {
                  const Icon = SUBJECT_ICONS[entry.subject];
                  const active = entry.subject === activeSubject;
                  return (
                    <button
                      key={entry.subject}
                      type="button"
                      onClick={() => selectSubject(entry)}
                      className={`inline-flex items-center gap-2 rounded-[6px] border px-3.5 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-white"
                          : "border-[#d8d8d8] bg-white/60 text-[#5a5a5a] hover:border-[#080808]"
                      }`}
                      style={
                        active
                          ? { borderColor: entry.accent, boxShadow: `3px 3px 0px ${entry.accent}` }
                          : undefined
                      }
                    >
                      <Icon
                        className="size-4"
                        style={{ color: active ? entry.accent : "#ababab" }}
                      />
                      {entry.label[locale]}
                    </button>
                  );
                })}
              </div>

              {myClasses.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                    {copy.classFilter}
                  </span>
                  {[{ id: "", name: copy.allClasses, academicYear: "" }, ...myClasses].map((option) => {
                    const active = option.id === activeClassId;
                    return (
                      <button
                        key={option.id || "all"}
                        type="button"
                        onClick={() => setActiveClassId(option.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "border-[#080808] bg-[#080808] text-white"
                            : "border-[#d8d8d8] text-[#5a5a5a] hover:border-[#080808]"
                        }`}
                      >
                        {option.academicYear
                          ? copy.classLabel(option.name, option.academicYear)
                          : option.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {subjectEntry && subjectEntry.views.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {subjectEntry.views.map((viewOption) => {
                    const active = viewOption.key === activeView?.key;
                    return (
                      <button
                        key={viewOption.key}
                        type="button"
                        onClick={() => setActiveViewKey(viewOption.key)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-[#080808] bg-[#080808] text-white"
                            : "border-[#d8d8d8] text-[#5a5a5a] hover:border-[#080808]"
                        }`}
                      >
                        {viewOption.label[locale]}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeView && (
                <>
                  <p className="text-xs text-[#5a5a5a]">
                    {activeView.description[locale]}
                    {copy.scopeNote(
                      myClasses.length === 1
                        ? copy.classLabel(myClasses[0].name, myClasses[0].academicYear)
                        : copy.yourClasses,
                    )}
                  </p>
                  <StudentDataBrowser
                    key={activeView.key}
                    view={activeView}
                    accent={subjectEntry?.accent ?? "#146ef5"}
                    classId={activeClassId}
                  />
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
