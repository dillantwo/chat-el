"use client";

import { useEffect, useRef, useState } from "react";
import { BookMarked, Maximize2, Trash2, X } from "lucide-react";
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

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        render={<button type="button" />}
        onClick={() => setExpanded(true)}
        className="flex w-full cursor-pointer items-center gap-1.5 text-[#146ef5] transition-colors hover:text-[#0b4fc0]"
        title="View all saved words / 查看全部生詞"
      >
        <BookMarked className="size-3.5" />
        Word Bank 生詞庫
        {words.length > 0 && (
          <span className="ml-0.5 rounded-full bg-[#146ef5]/10 px-1.5 text-[10px] font-semibold">
            {words.length}
          </span>
        )}
        <Maximize2 className="ml-auto size-3 opacity-70" />
      </SidebarGroupLabel>
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
            Drag a new word here to save it.
            <br />
            把生詞拖到這裡儲存。
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#ededed] px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#146ef5]">
                <BookMarked className="size-4" />
                Word Bank 生詞庫
                <span className="text-[#9a9a9a]">({words.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-md p-1 text-[#5a5a5a] transition-colors hover:bg-[#f0f0f0]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {words.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[#9a9a9a]">
                  No saved words yet.
                  <br />
                  還沒有儲存任何生詞。
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {words.map((word) => (
                    <span
                      key={word}
                      className="group inline-flex items-center gap-1 rounded-full border border-[#f59e0b]/40 bg-[#fef3c7] px-3 py-1 text-[13px] font-semibold text-[#b45309]"
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() => removeWord(word)}
                        className="text-[#b45309]/60 transition-colors hover:text-[#b91c1c]"
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
            {words.length > 0 && (
              <div className="border-t border-[#ededed] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setWords([])}
                  className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-[#b91c1c]"
                >
                  <Trash2 className="size-3.5" /> Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </SidebarGroup>
  );
}
