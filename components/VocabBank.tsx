"use client";

import { useEffect, useRef, useState } from "react";
import { BookMarked, Maximize2, Plus, Trash2, X } from "lucide-react";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { basePath } from "@/lib/utils";

// Words the student drags here are stored in MongoDB, tied to the logged-in
// user (see app/api/english-vocab-bank/route.ts + models/VocabBank.ts), so the
// bank syncs across devices. localStorage is kept as an offline fallback and to
// migrate any words saved before the database existed. The drag source is the
// Vocab-Builder's tagged words in the chat (see VocabChip in
// EnglishReadingComprehensionChat).
const STORAGE_KEY = "english-reading-vocab-bank";
const ENDPOINT = `${basePath}/api/english-vocab-bank`;

// Window event used so the draggable chips in the chat (a separate component
// tree) can add a word by tap/click, which is the fallback for touch devices
// like iPad where HTML5 drag-and-drop does not fire. See VocabChip in
// EnglishReadingComprehensionChat.
export const VOCAB_ADD_EVENT = "english-vocab-bank:add";

function readLocalWords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((w) => typeof w === "string") : [];
  } catch {
    return [];
  }
}

function mergeWords(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of [...a, ...b]) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}

export function VocabBank() {
  const [words, setWords] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Manual entry: students can type a word instead of dragging a tagged chip.
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [modalDraft, setModalDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Skip the very first persist effect: it would just re-save what we loaded.
  const skipNextSave = useRef(true);

  // Load once on mount (client only) to avoid SSR hydration mismatch. Prefer the
  // database; fall back to localStorage when offline / not logged in, and
  // migrate any local-only words up to the server on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = readLocalWords();
      try {
        const res = await fetch(ENDPOINT, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { words?: string[] };
          const remote = Array.isArray(data.words) ? data.words : [];
          const merged = mergeWords(remote, local);
          if (!cancelled) {
            setWords(merged);
            // If local had words the server didn't, push the merged list back.
            skipNextSave.current = merged.length === remote.length;
          }
        } else if (!cancelled) {
          // Not logged in or server error: use local copy, don't try to save.
          setWords(local);
          skipNextSave.current = true;
        }
      } catch {
        if (!cancelled) {
          setWords(local);
          skipNextSave.current = true;
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist to both localStorage (offline cache) and the database.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    } catch {
      // storage may be unavailable; keep the bank in memory only
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const controller = new AbortController();
    fetch(ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
      signal: controller.signal,
    }).catch(() => {
      // Offline or not logged in: localStorage already holds the words.
    });
    return () => controller.abort();
  }, [words, loaded]);

  function addWord(raw: string) {
    const word = raw.trim();
    if (!word) return;
    setWords((prev) =>
      prev.some((w) => w.toLowerCase() === word.toLowerCase()) ? prev : [...prev, word],
    );
  }

  // Touch fallback: chips in the chat dispatch this event on tap/click so words
  // can be saved on iPad, where drag-and-drop does not work.
  useEffect(() => {
    function onVocabAdd(e: Event) {
      const word = (e as CustomEvent<string>).detail;
      if (typeof word === "string") addWord(word);
    }
    window.addEventListener(VOCAB_ADD_EVENT, onVocabAdd);
    return () => window.removeEventListener(VOCAB_ADD_EVENT, onVocabAdd);
  }, []);

  function removeWord(word: string) {
    setWords((prev) => prev.filter((w) => w !== word));
  }

  // Typed entry. Commas / newlines let a student add a few words at once.
  function commitWords(text: string) {
    const parts = text
      .split(/[,，;；\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) addWord(part);
  }

  function submitDraft() {
    commitWords(draft);
    setDraft("");
    inputRef.current?.focus();
  }

  // Autofocus the input when the student opens it.
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // Escape closes the expanded view.
  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex w-full items-center gap-1 pr-1 text-[#146ef5]">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-w-0 cursor-pointer items-center gap-1.5 transition-colors hover:text-[#0b4fc0]"
          title="View all saved words / 查看全部生詞"
        >
          <BookMarked className="size-3.5" />
          Word Bank
          {words.length > 0 && (
            <span className="ml-0.5 rounded-full bg-[#146ef5]/10 px-1.5 text-[10px] font-semibold">
              {words.length}
            </span>
          )}
          <Maximize2 className="size-3 opacity-70" />
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding((prev) => !prev);
            setDraft("");
          }}
          aria-expanded={adding}
          className={`ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
            adding
              ? "border-[#146ef5] bg-[#146ef5] text-white"
              : "border-[#146ef5]/40 bg-[#146ef5]/10 text-[#146ef5] hover:bg-[#146ef5]/20"
          }`}
          title="Type a word to add / 自行輸入生詞"
        >
          {adding ? <X className="size-3" /> : <Plus className="size-3" />}
          Add
        </button>
      </SidebarGroupLabel>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDraft();
          }}
          className="mx-1 mb-1.5 flex items-center gap-1"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
                setDraft("");
              }
            }}
            placeholder="Type a word… 輸入生詞"
            aria-label="Add a word to your Word Bank"
            autoComplete="off"
            className="h-7 min-w-0 flex-1 rounded-lg border border-[#f59e0b]/50 bg-white px-2 text-[12px] text-[#b45309] outline-none placeholder:text-[#b45309]/45 focus:border-[#146ef5] focus:ring-2 focus:ring-[#146ef5]/20"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex h-7 shrink-0 items-center rounded-lg bg-[#146ef5] px-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b4fc0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </form>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!over) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const word =
            e.dataTransfer.getData("application/x-vocab-word") ||
            e.dataTransfer.getData("text/plain");
          addWord(word);
        }}
        className={`mx-1 rounded-xl border-2 border-dashed p-2.5 shadow-sm transition-colors ${
          over
            ? "border-[#146ef5] bg-[#146ef5]/15 ring-2 ring-[#146ef5]/30"
            : "border-[#f59e0b] bg-[#fffbeb]"
        }`}
      >
        {words.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] leading-relaxed text-[#b45309]">
            Drag a new word here, or tap Add to type one.
            <br />
            把生詞拖到這裡，或按 Add 自行輸入。
          </p>
        ) : (
          <div className="flex max-h-[4.75rem] flex-wrap content-start gap-1.5 overflow-y-auto">
            {words.map((word) => (
              <span
                key={word}
                className="group inline-flex h-[22px] items-center gap-1 rounded-full border border-[#f59e0b]/40 bg-[#fef3c7] px-2 text-[12px] font-semibold text-[#b45309]"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeWord(word)}
                  className="text-[#b45309]/60 transition-colors hover:text-[#b91c1c]"
                  title="Remove word"
                  aria-label={`Remove ${word}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {words.length > 0 && (
        <button
          type="button"
          onClick={() => setWords([])}
          className="mx-1 mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-[#b91c1c]"
        >
          <Trash2 className="size-3" /> Clear all
        </button>
      )}

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/55 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Word Bank"
        >
          <div
            className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgba(11,18,32,0.45)] ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: blue banner so the panel reads as its own little tool */}
            <div className="relative bg-gradient-to-r from-[#146ef5] to-[#3b8cff] px-5 py-4 text-white">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
                  <BookMarked className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
                    Word Bank
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-white/25">
                      {words.length}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/80">
                    Words you saved while reading · 閱讀時儲存的生詞
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="-mr-1 -mt-1 ml-auto rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Add a word without leaving the panel */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitWords(modalDraft);
                setModalDraft("");
              }}
              className="flex items-center gap-2 border-b border-[#f0f0f0] bg-[#fafafa] px-5 py-3"
            >
              <input
                value={modalDraft}
                onChange={(e) => setModalDraft(e.target.value)}
                placeholder="Add a word… 輸入生詞（可用逗號分隔）"
                aria-label="Add a word to your Word Bank"
                autoComplete="off"
                className="h-9 min-w-0 flex-1 rounded-xl border border-[#e4e4e4] bg-white px-3 text-[13px] text-[#2a2a2a] outline-none transition-colors placeholder:text-[#a8a8a8] focus:border-[#146ef5] focus:ring-2 focus:ring-[#146ef5]/20"
              />
              <button
                type="submit"
                disabled={!modalDraft.trim()}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-[#146ef5] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0b4fc0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-4" /> Add
              </button>
            </form>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {words.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl border border-dashed border-[#f59e0b]/50 bg-[#fffbeb] text-[#f59e0b]">
                    <BookMarked className="size-6" />
                  </span>
                  <p className="text-[13px] leading-relaxed text-[#7a7a7a]">
                    No saved words yet.
                    <br />
                    <span className="text-[#9a9a9a]">
                      還沒有儲存任何生詞，試試在上面輸入，或把生詞拖進生詞欄。
                    </span>
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {words.map((word) => (
                    <span
                      key={word}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/45 bg-gradient-to-b from-[#fffbeb] to-[#fef3c7] py-1.5 pl-3.5 pr-2 text-[13.5px] font-semibold text-[#b45309] shadow-sm transition-all hover:-translate-y-px hover:border-[#f59e0b] hover:shadow"
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() => removeWord(word)}
                        className="flex size-[18px] items-center justify-center rounded-full text-[#b45309]/55 transition-colors hover:bg-[#b91c1c]/10 hover:text-[#b91c1c]"
                        title="Remove word"
                        aria-label={`Remove ${word}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
              {words.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setWords([])}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-[#8a8a8a] transition-colors hover:bg-[#b91c1c]/10 hover:text-[#b91c1c]"
                >
                  <Trash2 className="size-3.5" /> Clear all
                </button>
              ) : (
                <span className="text-[11.5px] text-[#a8a8a8]">Esc to close</span>
              )}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex h-8 items-center rounded-xl border border-[#e4e4e4] bg-white px-4 text-[12.5px] font-semibold text-[#3a3a3a] transition-colors hover:bg-[#f4f4f4]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarGroup>
  );
}
