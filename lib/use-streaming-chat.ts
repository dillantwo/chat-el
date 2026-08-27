"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { basePath } from "@/lib/utils";
import { createMessageId, type ChatMsg, type PayloadMessage } from "@/lib/chat-message";

/**
 * The streaming half of the hand-rolled chat panels: one assistant reply, read
 * off a plain text stream and revealed with the typewriter pacing.
 *
 * Why this is not `useChat`: these routes answer with `toTextStreamResponse()`
 * and the panels need to (a) pace the reveal instead of painting tokens the
 * instant they arrive, and (b) send a turn that is never rendered as a bubble
 * (the reading-comprehension kickoff, the quick-start prompts). Owning the
 * message list is what makes both possible. The math workbench and the tool
 * panels have neither requirement and stay on `useChat`.
 *
 * The host component keeps everything else — input, attachments, pins, history
 * persistence — and reads `status` to gate its autosave effect.
 */

export type StreamingChatStatus = "idle" | "submitted" | "streaming";

export type UseStreamingChatOptions = {
  /** Route path, without basePath, e.g. "/api/english-thank-you-letter". */
  endpoint: string;
  /** Prefixed onto errors surfaced as assistant text: "（出錯了）" or "(Error) ". */
  errorPrefix: string;
  /** Used when the failure carries no message of its own. */
  unknownErrorMessage: string;
};

/**
 * Reveal pacing.
 *
 * The original committed on every animation frame at >=2 characters, so its
 * speed was whatever the display ran at: ~120 chars/s on a 60Hz screen but
 * ~240 on a 120Hz ProMotion iPad. This version is wall-clock gated instead, so
 * the reveal is the same everywhere — which also means it is about half as fast
 * as it used to be on ProMotion. That is deliberate; tune CHARS_PER_COMMIT if
 * the slower reveal reads as sluggish.
 *
 * Committing less often than every frame also halves the re-render work, which
 * matters because each commit re-renders the whole transcript and re-parses
 * every Markdown bubble. 30ms rather than 33ms leaves margin against the
 * 33.33ms two-frame budget: at 33ms a slightly fast display or any rAF jitter
 * pushes the commit to a third frame and the reveal visibly stutters.
 */
const COMMIT_INTERVAL_MS = 30;
const CHARS_PER_COMMIT = 4;
const CATCH_UP_COMMITS = 15;

export function useStreamingChat({ endpoint, errorPrefix, unknownErrorMessage }: UseStreamingChatOptions) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<StreamingChatStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Navigating away mid-reply used to leave the fetch draining and the rAF loop
  // calling setMessages on an unmounted tree. Written so a Strict Mode remount
  // flips `mounted` back on.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /**
   * Drops a trailing empty assistant message. One is left behind whenever a
   * reply is cancelled before its first character arrives, and an empty
   * assistant bubble is not harmless: the panels render it as a spinner that
   * never stops, and it would be autosaved and replayed on every later turn.
   */
  const pruneEmptyPlaceholder = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last && last.role === "assistant" && !last.text ? prev.slice(0, -1) : prev;
    });
  }, []);

  /** Stop button: cancel, and drop the placeholder if nothing arrived yet. */
  const stop = useCallback(() => {
    abort();
    setStatus("idle");
    pruneEmptyPlaceholder();
  }, [abort, pruneEmptyPlaceholder]);

  /** Replaces the transcript (new chat, loading from history, switching task). */
  const reset = useCallback(
    (next: ChatMsg[] = []) => {
      abort();
      setMessages(next);
      setStatus("idle");
    },
    [abort],
  );

  /**
   * Opens a send: marks the panel busy and installs the AbortController, both
   * BEFORE the caller does any awaiting.
   *
   * Marking busy first is what stops a second Enter press (or a Task 5 map
   * upload) from starting a concurrent send while attachments are being read
   * into base64 — the loser of that race would commit a stale `messages`
   * snapshot and silently drop the winner's turn.
   *
   * Installing the controller at the same moment is what makes the Stop button
   * the composer now shows actually able to cancel. Callers must check the
   * returned signal after each await:
   *
   *     const { signal } = beginSend();
   *     const images = await filesToChatImages(files);
   *     if (signal.aborted) return;              // student pressed Stop
   *
   * and call `stop()` themselves if they bail out for their own reasons, so the
   * panel does not stay locked.
   */
  const beginSend = useCallback(() => {
    // Whatever was streaming is being replaced, so tidy its placeholder rather
    // than orphaning it.
    abortRef.current?.abort();
    pruneEmptyPlaceholder();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("submitted");
    return controller;
  }, [pruneEmptyPlaceholder]);

  /**
   * Appends an empty assistant message and streams the reply into it.
   *
   * `payloadMessages` is passed in rather than derived from `messages` so a
   * caller can send a turn that is not in the transcript.
   *
   * Adopts the controller from `beginSend()` when one is still installed, so a
   * Stop pressed during the caller's preparation still applies to this request.
   */
  const streamAssistant = useCallback(
    async (payloadMessages: PayloadMessage[], extraBody?: Record<string, unknown>) => {
      const controller = abortRef.current ?? new AbortController();
      if (controller.signal.aborted) return;
      abortRef.current = controller;

      const assistantId = createMessageId("a");
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);
      setStatus("submitted");

      // Everything below writes state only while this stream is still the
      // active one. Aborting does not unwind the async function synchronously:
      // `reader.read()` rejects a microtask later and the catch-up below spans
      // at least one frame, so without this a cancelled stream's tail would
      // land after the next one started — nulling its AbortController (killing
      // the Stop button) and forcing status back to "idle", which let the
      // autosave effect persist a half-streamed reply.
      const isActive = () => mountedRef.current && abortRef.current === controller;

      const writeText = (text: string) => {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text } : m)));
      };

      try {
        const res = await fetch(`${basePath}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages, ...extraBody }),
          signal: controller.signal,
        });

        if (!isActive()) return;

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          if (isActive()) {
            writeText(`${errorPrefix}${errText || res.statusText || unknownErrorMessage}`);
          }
          return;
        }

        setStatus("streaming");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let target = "";
        let displayed = "";
        let streamDone = false;
        let rafId: number | null = null;
        let lastCommit = 0;

        const tick = (now: number) => {
          if (!isActive()) {
            rafId = null;
            return;
          }
          if (displayed.length < target.length && now - lastCommit >= COMMIT_INTERVAL_MS) {
            const remaining = target.length - displayed.length;
            const step = Math.max(CHARS_PER_COMMIT, Math.ceil(remaining / CATCH_UP_COMMITS));
            displayed = target.slice(0, displayed.length + step);
            lastCommit = now;
            writeText(displayed);
          }
          rafId = displayed.length < target.length || !streamDone ? requestAnimationFrame(tick) : null;
        };
        rafId = requestAnimationFrame(tick);

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) target += chunk;
          }
        } finally {
          streamDone = true;
          // Let the reveal finish before resolving, so the caller's `await`
          // lines up with the last character actually being on screen.
          await new Promise<void>((resolve) => {
            const waitForCatchUp = () => {
              if (!isActive()) {
                resolve();
                return;
              }
              if (displayed.length >= target.length) {
                if (rafId !== null) {
                  cancelAnimationFrame(rafId);
                  rafId = null;
                }
                writeText(target);
                resolve();
                return;
              }
              requestAnimationFrame(waitForCatchUp);
            };
            // Checked once synchronously: a reply with no body is already
            // caught up, and a backgrounded tab stops firing animation frames,
            // which would otherwise leave `status` stuck at "streaming".
            waitForCatchUp();
          });
        }
      } catch (error) {
        // An AbortError means someone called abort()/stop()/reset(), and that
        // caller already tidied up — `isActive()` is false and this is a no-op.
        if (isActive() && (error as Error).name !== "AbortError") {
          writeText(
            `${errorPrefix}${error instanceof Error ? error.message : unknownErrorMessage}`,
          );
        }
      } finally {
        if (isActive()) {
          abortRef.current = null;
          setStatus("idle");
        }
      }
    },
    [endpoint, errorPrefix, unknownErrorMessage],
  );

  // `abort` is deliberately not exported: on its own it leaves `status` busy and
  // the placeholder orphaned. Callers want `stop()` (cancel and settle) or
  // `reset()` (cancel and replace the transcript).
  return {
    messages,
    setMessages,
    status,
    isLoading: status === "submitted" || status === "streaming",
    beginSend,
    streamAssistant,
    stop,
    reset,
  };
}
