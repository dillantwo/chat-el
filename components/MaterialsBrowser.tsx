"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  File as FileIcon,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderDown,
  Loader2,
  Presentation,
} from "lucide-react";
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
  /** Page heading. */
  heading?: string;
  /** UI copy language. English Language uses `"en"`; every other subject is `"zh"`. */
  lang?: "zh" | "en";
}

/** All UI strings, so the English section can run fully in English. */
const COPY = {
  zh: {
    groupNav: "資源分組",
    all: "全部",
    fileCount: (n: number) => `${n} 個檔案`,
    loading: "正在載入資源…",
    loadError: "無法載入學習資源，請稍後再試。",
    empty: "這一科暫時還沒有可以下載的資源。",
    download: "下載",
    kinds: { image: "圖片", audio: "音訊", video: "影片", archive: "壓縮檔", file: "檔案" },
  },
  en: {
    groupNav: "Resource groups",
    all: "All",
    fileCount: (n: number) => `${n} ${n === 1 ? "file" : "files"}`,
    loading: "Loading resources…",
    loadError: "Could not load the resources. Please try again later.",
    empty: "There are no resources to download yet.",
    download: "Download",
    kinds: { image: "Image", audio: "Audio", video: "Video", archive: "Archive", file: "File" },
  },
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

/**
 * File-type label + icon, picked from the extension first, then the MIME type.
 * Students recognise "PDF / Word / 圖片" faster than a generic file glyph.
 */
function fileKind(item: MaterialItem, copy: Copy): { label: string; Icon: typeof FileIcon } {
  const ext = item.filename.split(".").pop()?.toLowerCase() ?? "";
  const type = item.contentType.toLowerCase();

  if (ext === "pdf" || type.includes("pdf")) return { label: "PDF", Icon: FileText };
  if (["doc", "docx"].includes(ext) || type.includes("word")) return { label: "Word", Icon: FileText };
  if (["ppt", "pptx"].includes(ext) || type.includes("presentation"))
    return { label: "PowerPoint", Icon: Presentation };
  if (["xls", "xlsx", "csv"].includes(ext) || type.includes("sheet") || type.includes("excel"))
    return { label: "Excel", Icon: FileSpreadsheet };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) || type.startsWith("image/"))
    return { label: copy.kinds.image, Icon: FileImage };
  if (["mp3", "wav", "m4a", "aac"].includes(ext) || type.startsWith("audio/"))
    return { label: copy.kinds.audio, Icon: FileAudio };
  if (["mp4", "mov", "webm", "avi"].includes(ext) || type.startsWith("video/"))
    return { label: copy.kinds.video, Icon: FileVideo };
  if (["zip", "rar", "7z"].includes(ext)) return { label: copy.kinds.archive, Icon: FileIcon };
  return { label: ext ? ext.toUpperCase() : copy.kinds.file, Icon: FileIcon };
}

/** Human-readable file size, e.g. `2.4 MB`. Empty string when unknown. */
function fileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shared learning-material download browser used by every subject.
 *
 * The whole materials feature is subject-generic on the server
 * (`/api/learning-materials?subject=…` resolves the caller's school layout and
 * filters by role/audience), so a subject page only needs to pass its own
 * subject key plus the heading copy.
 *
 * Presentation notes: one blue palette for every subject (the subject accent is
 * intentionally *not* used here so downloads look and behave the same
 * everywhere), the app's flat-border / offset-shadow styling, and one tap per
 * 分組 so primary-school students only see the group they picked.
 */
export default function MaterialsBrowser({
  subject,
  backHref,
  backLabel,
  heading = "學習資源下載",
  lang = "zh",
}: MaterialsBrowserProps) {
  const copy = COPY[lang];
  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  // Kept as a flag rather than a message, so the copy follows `lang` at render.
  const [failed, setFailed] = useState(false);
  /** Selected group name, or `null` for "all". */
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/learning-materials?subject=${subject}`);
        if (!res.ok) {
          if (active) setFailed(true);
          return;
        }
        const data = await res.json();
        if (active) setGroups(data.groups ?? []);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subject]);

  // A group can disappear between loads (admin edits), so fall back to all.
  const visibleGroups = useMemo(
    () => (activeGroup ? groups.filter((g) => g.name === activeGroup) : groups),
    [groups, activeGroup],
  );
  const shownGroups = visibleGroups.length > 0 ? visibleGroups : groups;
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <>
      <Header backHref={backHref} backLabel={backLabel} />

      {/* Flat paper colour, no dot texture: the bordered cards carry the page. */}
      <main className="relative flex flex-1 items-start overflow-x-hidden overflow-y-auto bg-[#f3f7fc] text-[#1b2942]">
        <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
          {/* Hero — title only, on a medium blue block. */}
          <section className="relative overflow-hidden rounded-[10px] border-2 border-[#22304a] bg-[#3576cf] px-5 py-6 text-white shadow-[8px_8px_0_#22304a] sm:px-7">
            <FolderDown
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -bottom-7 size-32 text-white/20"
              strokeWidth={1.5}
            />
            <h1 className="relative max-w-xl text-[28px] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[38px]">
              {heading}
            </h1>
          </section>

          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-[#c2d4ec] bg-white/80 py-24 text-[15px] text-[#546681]">
              <Loader2 className="size-5 animate-spin text-[#3576cf]" />
              {copy.loading}
            </div>
          ) : failed ? (
            <p className="mt-6 rounded-[10px] border-2 border-[#e5b9b9] bg-[#fdf4f4] px-5 py-4 text-[15px] text-[#b42318]">
              {copy.loadError}
            </p>
          ) : groups.length === 0 ? (
            <div className="mt-6 rounded-[10px] border-2 border-dashed border-[#c2d4ec] bg-white/80 py-20 text-center">
              <FolderDown className="mx-auto size-10 text-[#adc4e3]" strokeWidth={1.5} />
              <p className="mt-4 text-[15px] text-[#546681]">{copy.empty}</p>
            </div>
          ) : (
            <>
              {/* Group picker, styled like folder tabs. */}
              {groups.length > 1 && (
                <nav aria-label={copy.groupNav} className="mt-7">
                  <div className="flex flex-wrap gap-2">
                    <GroupTab
                      label={copy.all}
                      count={totalCount}
                      selected={activeGroup === null}
                      onClick={() => setActiveGroup(null)}
                    />
                    {groups.map((g) => (
                      <GroupTab
                        key={g.name}
                        label={g.name}
                        count={g.items.length}
                        selected={activeGroup === g.name}
                        onClick={() => setActiveGroup(g.name)}
                      />
                    ))}
                  </div>
                </nav>
              )}

              <div className="mt-6 space-y-6 pb-10">
                {shownGroups.map((group) => (
                  <section
                    key={group.name}
                    className="overflow-hidden rounded-[10px] border-2 border-[#22304a] bg-white shadow-[6px_6px_0_#d9e5f5]"
                  >
                    <div className="flex items-center gap-3 border-b-2 border-[#22304a] bg-[#e8f0fb] px-4 py-3 sm:px-5">
                      <h2 className="min-w-0 flex-1 truncate text-[19px] font-bold tracking-[-0.02em] text-[#1b2942] sm:text-[21px]">
                        {group.name}
                      </h2>
                      <span className="shrink-0 text-[13px] font-medium text-[#546681]">
                        {copy.fileCount(group.items.length)}
                      </span>
                    </div>

                    <ul className="space-y-2.5 p-3 sm:p-4">
                      {group.items.map((m) => {
                        const { label: kindLabel, Icon } = fileKind(m, copy);
                        const size = fileSize(m.size);
                        return (
                          <li key={m.id}>
                            <a
                              href={`${basePath}/api/learning-materials/${m.id}/download`}
                              download={m.filename}
                              className="group flex min-h-[68px] items-center gap-3 rounded-[8px] border-2 border-[#dfe7f2] bg-white px-3 py-3 transition duration-200 hover:border-[#22304a] hover:shadow-[4px_4px_0_#bcd3ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3576cf] sm:gap-4 sm:px-4"
                              title={m.filename}
                            >
                              <span
                                aria-hidden="true"
                                className="flex size-11 shrink-0 items-center justify-center rounded-[4px] bg-[#3576cf] text-white shadow-[3px_3px_0_#24548f]"
                              >
                                <Icon className="size-5" />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[16px] font-semibold tracking-[-0.01em] text-[#1b2942] sm:text-[17px]">
                                  {m.title}
                                </span>
                                {m.description && (
                                  <span className="mt-0.5 block line-clamp-2 text-[14px] leading-6 text-[#546681]">
                                    {m.description}
                                  </span>
                                )}
                                <span className="mt-1.5 flex items-center gap-2 text-[12px] text-[#7b89a1]">
                                  <span className="rounded-[3px] border border-[#c9dbf3] bg-[#eef4fc] px-1.5 py-0.5 font-semibold text-[#255fac]">
                                    {kindLabel}
                                  </span>
                                  {size && <span>{size}</span>}
                                </span>
                              </span>

                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border-2 border-[#22304a] bg-white px-3 py-2 text-[14px] font-semibold text-[#255fac] transition-colors group-hover:bg-[#3576cf] group-hover:text-white">
                                <Download className="size-4" />
                                <span className="hidden sm:inline">{copy.download}</span>
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/** One folder-style tab in the group picker. */
function GroupTab({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "inline-flex min-h-[42px] items-center gap-2 rounded-[6px] border-2 px-3.5 text-[15px] transition duration-200",
        selected
          ? "border-[#22304a] bg-[#3576cf] font-semibold text-white shadow-[3px_3px_0_#22304a]"
          : "border-[#d5e0ee] bg-white text-[#3c4a63] hover:border-[#22304a] hover:text-[#255fac]",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "rounded-[3px] px-1.5 py-0.5 text-[12px] font-semibold",
          selected ? "bg-[#24548f] text-white" : "bg-[#eef2f8] text-[#64738d]",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
