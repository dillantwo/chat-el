"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileText, Link2, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import type { SubjectValue } from "@/lib/subjects";
import { basePath } from "@/lib/utils";

interface MaterialItem {
  id: string;
  title: string;
  description: string;
  audience: string;
  filename: string;
  contentType: string;
  size: number;
}

interface MaterialGroup {
  name: string;
  items: MaterialItem[];
}

export interface MaterialsBrowserProps {
  /** Subject key used for `GET /api/learning-materials?subject=…`. */
  subject: SubjectValue;
  /** Back-link target in the page header. */
  backHref: string;
  /** Back-link label in the page header. */
  backLabel: string;
  /** Small uppercase label above the heading. */
  eyebrow?: string;
  /** Page heading. */
  heading?: string;
  /** One-line intro under the heading. */
  description?: string;
  /** Accent colour for icons, links and the spinner. */
  accent?: string;
  /** Soft tint used for the row hover state (usually a very light `accent`). */
  accentSoft?: string;
  /** Label for the expand-all toggle (English section keeps English copy). */
  expandAllLabel?: string;
  /** Label for the collapse-all toggle. */
  collapseAllLabel?: string;
}

/**
 * Shared learning-material download browser used by every subject.
 *
 * The whole materials feature is subject-generic on the server
 * (`/api/learning-materials?subject=…` resolves the caller's school layout and
 * filters by role/audience), so a subject page only needs to pass its own
 * subject key plus presentation details.
 */
export default function MaterialsBrowser({
  subject,
  backHref,
  backLabel,
  eyebrow = "Learning Materials",
  heading = "學習資源下載",
  description = "下載本科的補充教材、工作紙與參考資源。",
  accent = "#16a34a",
  accentSoft = "#f6faf7",
  expandAllLabel = "全部展開",
  collapseAllLabel = "全部收起",
}: MaterialsBrowserProps) {
  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/learning-materials?subject=${subject}`);
        if (!res.ok) {
          if (active) setError("無法載入學習資源，請稍後再試。");
          return;
        }
        const data = await res.json();
        if (active) setGroups(data.groups ?? []);
      } catch {
        if (active) setError("無法載入學習資源，請稍後再試。");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subject]);

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.name));

  function toggleGroup(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.name)));
  }

  return (
    <>
      <Header backHref={backHref} backLabel={backLabel} />

      <main
        className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-white text-[#080808]"
        style={
          {
            "--materials-accent": accent,
            "--materials-accent-soft": accentSoft,
          } as React.CSSProperties
        }
      >
        <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#9aa39c]">
              {eyebrow}
            </p>
            <h1 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] text-[#080808]">
              {heading}
            </h1>
            <p className="text-sm leading-7 text-[#5a5a5a]">{description}</p>
          </div>

          <div className="mt-8 flex-1">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="size-6 animate-spin text-[var(--materials-accent)]" />
              </div>
            ) : error ? (
              <p className="rounded-[10px] border border-[#f0c2c2] bg-[#fdf3f3] px-4 py-3 text-sm text-[#b42318]">
                {error}
              </p>
            ) : groups.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#d8d8d8] bg-white py-20 text-center">
                <FileText className="mx-auto size-8 text-[#c9c9c9]" />
                <p className="mt-3 text-sm text-[#5a5a5a]">目前尚無可下載的資源。</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((group, index) => {
                  const isCollapsed = collapsed.has(group.name);
                  return (
                    <section
                      key={group.name}
                      className="overflow-hidden rounded-[12px] border border-[#e3e6e3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                    >
                      <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.name)}
                          className="flex flex-1 items-center gap-2.5 text-left"
                          aria-expanded={!isCollapsed}
                        >
                          <ChevronDown
                            className={[
                              "size-6 shrink-0 text-[var(--materials-accent)] transition-transform duration-200",
                              isCollapsed ? "-rotate-90" : "",
                            ].join(" ")}
                          />
                          <span className="text-[22px] font-semibold tracking-[-0.01em] text-[#1f2a24]">
                            {group.name}
                          </span>
                        </button>

                        {index === 0 && (
                          <button
                            type="button"
                            onClick={toggleAll}
                            className="shrink-0 text-[15px] font-medium text-[var(--materials-accent)] opacity-100 transition-opacity hover:opacity-75"
                          >
                            {allCollapsed ? expandAllLabel : collapseAllLabel}
                          </button>
                        )}
                      </div>

                      {!isCollapsed && (
                        <ul>
                          {group.items.map((m) => (
                            <li key={m.id} className="border-t border-[#eef1ee]">
                              <a
                                href={`${basePath}/api/learning-materials/${m.id}/download`}
                                className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--materials-accent-soft)]"
                                title={m.filename}
                              >
                                <Link2 className="mt-0.5 size-5 shrink-0 text-[#3aa0c9]" />
                                <span className="min-w-0">
                                  <span className="block text-[18px] font-medium leading-snug text-[var(--materials-accent)]">
                                    {m.title}
                                  </span>
                                  {m.description && (
                                    <span className="mt-1 block text-sm leading-6 text-[#8a938c]">
                                      {m.description}
                                    </span>
                                  )}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
