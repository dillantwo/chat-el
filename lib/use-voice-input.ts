"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared Web Speech API dictation hook.
 *
 * Replaces the copy-pasted `toggleVoice()` blocks that used to live in every
 * chat panel. Three problems that version had, and how this one handles them:
 *
 * 1. Chrome ends a recognition session on its own after a few seconds of
 *    silence even with `continuous = true`. The old code just flipped the mic
 *    button off, so a student who paused to think was silently no longer being
 *    recorded. Here `onend` restarts the session until the student actually
 *    stops talking for `idleTimeoutMs`, or presses the button.
 * 2. Every result event rebuilt the transcript from index 0 and overwrote the
 *    whole field, wiping anything typed beforehand. Here finalised speech is
 *    accumulated in `committed` (which survives restarts) and appended to the
 *    text that was in the field when dictation started.
 * 3. Every error was swallowed into "mic off" with no feedback. Here errors are
 *    classified: permission/hardware failures are fatal and surfaced, while
 *    `no-speech` and `aborted` are normal and don't interrupt dictation.
 */

export type VoiceInputErrorKind =
  | "not-supported"
  | "not-allowed"
  | "audio-capture"
  | "network"
  | "no-speech"
  | "aborted"
  | "unknown";

export type VoiceInputError = {
  kind: VoiceInputErrorKind;
  /** Ready-to-display message, localised from `lang`. */
  message: string;
  /** Fatal errors stop dictation; non-fatal ones let it keep going. */
  fatal: boolean;
};

export type UseVoiceInputOptions = {
  /** BCP-47 tag, e.g. `en-US` or `zh-HK`. Also picks the message language. */
  lang: string;
  /**
   * Text already in the target field, read once when dictation starts.
   * Dictated speech is appended to it instead of replacing it.
   */
  getBaseText?: () => string;
  /** Inserted between the existing text and the dictation. Defaults to a space. */
  separator?: string;
  /**
   * Replaces `separator` for the rest of the session once `rebase` has run.
   * Leave unset to keep using `separator`. A field that holds prose mid-sentence
   * wants "" here: the student's cursor is already where the next words belong,
   * so re-inserting the opening separator (a newline, say) would break the
   * sentence they are in the middle of.
   */
  continuationSeparator?: string;
  /** Called on every result with the full composed text (base + dictation). */
  onTranscript: (text: string) => void;
  onStart?: () => void;
  /** Called once when dictation ends, with the final composed text. */
  onStop?: (text: string) => void;
  /** Called for every classified error, including non-fatal ones. */
  onError?: (error: VoiceInputError) => void;
  /** Give up after this long with no speech at all. Defaults to 60s. */
  idleTimeoutMs?: number;
  /** Show the browser-unsupported alert from inside the hook. Defaults to true. */
  alertOnUnsupported?: boolean;
};

export type UseVoiceInputResult = {
  isListening: boolean;
  /** False during SSR and on browsers without the API. */
  isSupported: boolean;
  /** Last fatal or visible error. Cleared when dictation restarts. */
  error: VoiceInputError | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /**
   * Existing text plus finalised speech only, leaving out the provisional tail.
   * Autosave should persist this so a half-recognised word never reaches the
   * database.
   */
  getCommittedText: () => string;
  /**
   * Adopt `text` as the new starting point, discarding the speech accumulated
   * so far. Call this from the field's change handler whenever the student edits
   * by hand mid-dictation, otherwise the next result would revert their edit.
   */
  rebase: (text: string) => void;
};

const MESSAGES = {
  zh: {
    "not-supported": "您的瀏覽器不支援語音輸入，請使用 Chrome 或 Edge 瀏覽器。",
    "not-allowed": "無法使用麥克風。請在瀏覽器設定中允許麥克風權限，然後再試一次。",
    "audio-capture": "找不到麥克風，請檢查裝置的音訊設定。",
    network: "語音服務連線中斷，請檢查網絡後再試。",
    "no-speech": "沒有聽到聲音，請靠近麥克風再說一次。",
    aborted: "語音輸入已停止。",
    unknown: "語音輸入出現問題，請再試一次。",
  },
  en: {
    "not-supported": "Your browser does not support voice input. Please use Chrome or Edge.",
    "not-allowed":
      "Microphone access is blocked. Please allow microphone permission in your browser settings and try again.",
    "audio-capture": "No microphone found. Please check your device's audio settings.",
    network: "The speech service disconnected. Please check your network and try again.",
    "no-speech": "Nothing was picked up. Move closer to the microphone and try again.",
    aborted: "Voice input stopped.",
    unknown: "Voice input ran into a problem. Please try again.",
  },
} as const;

/** Errors that mean retrying is pointless until the student changes something. */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

const RESTART_DELAY_MS = 250;
const MAX_START_FAILURES = 3;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

/**
 * The browser runs a single speech recogniser at a time, so a second dictation
 * has to displace the first rather than compete with it. Screens can hold two
 * mics at once (the maths dashboard shows the question box beside a tool's chat
 * panel, and those live in different components), so neither call site can be
 * responsible for stopping the other. Whoever starts wins, tracked here.
 *
 * The displaced instance runs its normal `onStop`, so anything it owes — a
 * draft autosave flush, say — still happens. An `onStop` handler must therefore
 * never call `start()` on itself, or the two would displace each other forever.
 */
let activeDictation: { stop: () => void } | null = null;

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function classify(rawError: string): VoiceInputErrorKind {
  switch (rawError) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "audio-capture":
      return "audio-capture";
    case "network":
      return "network";
    case "no-speech":
      return "no-speech";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<VoiceInputError | null>(null);

  // Options are read through a ref so `start`/`stop`/`toggle` keep a stable
  // identity: callers pass inline closures and shouldn't have to memoise them.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Bumped on every start and stop; handlers from an old session compare
  // against it and bail out, which kills races between teardown and restart.
  const sessionRef = useRef(0);
  const listeningRef = useRef(false);
  // Finalised speech so far. Survives the auto-restarts, unlike `event.results`.
  const committedRef = useRef("");
  const interimRef = useRef("");
  const baseTextRef = useRef("");
  // Overrides `options.separator` once `rebase` has run. Null means the
  // configured separator still applies.
  const separatorOverrideRef = useRef<string | null>(null);
  // Results below this index are the student's to keep: they typed over a phrase
  // the recogniser had not finalised yet, so when the final does arrive it must
  // be dropped instead of appended a second time. Indices restart at 0 with each
  // recognition session, so this resets on every launch.
  const disownedIndexRef = useRef(0);
  const resultCountRef = useRef(0);
  const fatalRef = useRef(false);
  const startFailuresRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  // True between `start()` and the first `onstart` of a dictation. The idle
  // clock is rebased at that point so the browser's permission prompt — which
  // can sit there for a while the first time a student uses the mic — doesn't
  // eat into the silence budget. Only the first start, or the auto-restarts
  // would keep pushing the deadline back and we would never give up.
  const awaitingFirstStartRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A flaky connection can fire the same error on every restart; report each
  // kind once per dictation so callers don't get a burst of identical alerts.
  const reportedKindsRef = useRef(new Set<VoiceInputErrorKind>());
  // This instance's identity in the module-level `activeDictation` slot.
  const registryEntryRef = useRef<{ stop: () => void } | null>(null);
  if (registryEntryRef.current === null) {
    registryEntryRef.current = { stop: () => stopImplRef.current() };
  }

  useEffect(() => {
    setIsSupported(getRecognitionCtor() !== null);
  }, []);

  function messageFor(kind: VoiceInputErrorKind): string {
    const table = optionsRef.current.lang.toLowerCase().startsWith("en") ? MESSAGES.en : MESSAGES.zh;
    return table[kind];
  }

  function clearRestartTimer() {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  /** Existing text + `dictated`, joined with the session's separator. */
  function compose(dictated: string): string {
    const base = baseTextRef.current;
    if (!dictated) return base;
    if (!base.trim()) return dictated;
    const separator = separatorOverrideRef.current ?? optionsRef.current.separator ?? " ";
    // An empty separator means the caller is continuing the student's own
    // sentence, so their trailing space has to survive.
    if (separator === "") return `${base}${dictated}`;
    return `${base.replace(/\s+$/, "")}${separator}${dictated}`;
  }

  /** Existing text + everything dictated so far, provisional tail included. */
  function composeText(): string {
    return compose((committedRef.current + interimRef.current).replace(/^\s+/, ""));
  }

  /** Detach handlers and stop the recogniser without touching hook state. */
  function disposeRecognition() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      // `abort()` rather than `stop()`: the handlers are already detached, so a
      // final result would be discarded anyway, and aborting frees the
      // microphone straight away. That matters because the very next thing we
      // do is often start another session, and Chrome throws if the previous
      // one is still winding down.
      recognition.abort();
    } catch {
      // Already stopped, or never successfully started. Nothing to unwind.
    }
  }

  function releaseRegistrySlot() {
    if (activeDictation === registryEntryRef.current) activeDictation = null;
  }

  /** End dictation for good and hand the final text to the caller. */
  function finish() {
    clearRestartTimer();
    sessionRef.current += 1;
    disposeRecognition();
    releaseRegistrySlot();
    const wasListening = listeningRef.current;
    listeningRef.current = false;
    setIsListening(false);
    if (wasListening) optionsRef.current.onStop?.(composeText());
  }

  function reportError(kind: VoiceInputErrorKind, fatal: boolean) {
    if (reportedKindsRef.current.has(kind)) return;
    reportedKindsRef.current.add(kind);
    const next: VoiceInputError = { kind, message: messageFor(kind), fatal };
    // Transient hiccups shouldn't leave a stale banner on screen once
    // dictation carries on, so only fatal errors are kept in state.
    if (fatal) setError(next);
    optionsRef.current.onError?.(next);
  }

  function handleEnd(session: number) {
    if (session !== sessionRef.current) return;
    // The next session starts with an empty `results` list, so fold anything
    // still provisional into `committed` or it would be lost on restart.
    committedRef.current += interimRef.current;
    interimRef.current = "";
    if (fatalRef.current) {
      finish();
      return;
    }
    const idleTimeoutMs = optionsRef.current.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    if (Date.now() - lastSpeechAtRef.current > idleTimeoutMs) {
      finish();
      return;
    }
    scheduleRestart(session);
  }

  function scheduleRestart(session: number) {
    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (session !== sessionRef.current) return;
      launch(session);
    }, RESTART_DELAY_MS);
  }

  /** Build and start a recogniser for `session`. */
  function launch(session: number) {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      finish();
      return;
    }
    // A fresh session numbers its results from 0 and has already forgotten any
    // phrase that was in flight, so nothing is left to disown.
    disownedIndexRef.current = 0;
    resultCountRef.current = 0;
    const recognition = new Ctor();
    recognition.lang = optionsRef.current.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (session !== sessionRef.current) return;
      startFailuresRef.current = 0;
      if (awaitingFirstStartRef.current) {
        awaitingFirstStartRef.current = false;
        lastSpeechAtRef.current = Date.now();
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (session !== sessionRef.current) return;
      resultCountRef.current = event.results.length;
      let finalChunk = "";
      let interim = "";
      // Only walk what this event changed; earlier results are already in
      // `committed`. Re-reading from 0 is what used to duplicate text across
      // long sessions.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (i < disownedIndexRef.current) continue;
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
        else interim += result[0].transcript;
      }
      committedRef.current += finalChunk;
      interimRef.current = interim;
      lastSpeechAtRef.current = Date.now();
      optionsRef.current.onTranscript(composeText());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (session !== sessionRef.current) return;
      const kind = classify(event.error);
      // `aborted` is what our own stop() produces, and `no-speech` just means
      // the student paused. Neither deserves a message or a teardown; the
      // `onend` that follows decides whether to restart.
      if (kind === "aborted") return;
      const fatal = FATAL_ERRORS.has(event.error);
      if (fatal) fatalRef.current = true;
      if (kind !== "no-speech") reportError(kind, fatal);
    };

    recognition.onend = () => handleEnd(session);

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Chrome throws if start() lands while the previous session is still
      // shutting down. Back off and retry a few times before giving up.
      disposeRecognition();
      startFailuresRef.current += 1;
      if (startFailuresRef.current >= MAX_START_FAILURES) {
        reportError("unknown", true);
        finish();
        return;
      }
      scheduleRestart(session);
    }
  }

  function doStart() {
    if (listeningRef.current) return;
    if (!getRecognitionCtor()) {
      const kind: VoiceInputErrorKind = "not-supported";
      setError({ kind, message: messageFor(kind), fatal: true });
      if (optionsRef.current.alertOnUnsupported !== false) alert(messageFor(kind));
      optionsRef.current.onError?.({ kind, message: messageFor(kind), fatal: true });
      return;
    }
    // Displace whatever else is dictating before touching our own state, so the
    // other field settles (and saves) while ours is still untouched.
    if (activeDictation && activeDictation !== registryEntryRef.current) {
      activeDictation.stop();
    }
    clearRestartTimer();
    const session = ++sessionRef.current;
    committedRef.current = "";
    interimRef.current = "";
    baseTextRef.current = optionsRef.current.getBaseText?.() ?? "";
    separatorOverrideRef.current = null;
    fatalRef.current = false;
    startFailuresRef.current = 0;
    lastSpeechAtRef.current = Date.now();
    awaitingFirstStartRef.current = true;
    reportedKindsRef.current.clear();
    setError(null);
    listeningRef.current = true;
    activeDictation = registryEntryRef.current;
    setIsListening(true);
    optionsRef.current.onStart?.();
    launch(session);
  }

  function doStop() {
    if (!listeningRef.current) {
      // Still clear any pending restart so a queued timer can't revive the mic.
      clearRestartTimer();
      sessionRef.current += 1;
      disposeRecognition();
      releaseRegistrySlot();
      return;
    }
    finish();
  }

  // Consumers get stable callbacks that always run the latest closure.
  const startImplRef = useRef(doStart);
  startImplRef.current = doStart;
  const stopImplRef = useRef(doStop);
  stopImplRef.current = doStop;

  const start = useCallback(() => startImplRef.current(), []);
  const stop = useCallback(() => stopImplRef.current(), []);
  const toggle = useCallback(() => {
    if (listeningRef.current) stopImplRef.current();
    else startImplRef.current();
  }, []);

  const getCommittedText = useCallback(() => compose(committedRef.current.replace(/^\s+/, "")), []);

  const rebase = useCallback((text: string) => {
    const interim = interimRef.current;
    if (interim && text.endsWith(interim)) {
      // The edit landed before the provisional tail, which is still sitting
      // untouched at the end. Drop it from the baseline and let the recogniser
      // finish that phrase normally.
      baseTextRef.current = text.slice(0, text.length - interim.length);
    } else {
      // Either nothing was pending, or the student typed over the provisional
      // tail itself. In the latter case they have taken that phrase over by
      // hand, so its final result must not be appended on top of their version.
      baseTextRef.current = text;
      if (interim) disownedIndexRef.current = resultCountRef.current;
    }
    committedRef.current = "";
    interimRef.current = "";
    separatorOverrideRef.current = optionsRef.current.continuationSeparator ?? null;
  }, []);

  // Unmount: drop the recogniser without firing onStop, since there is no
  // longer a field to write the text into.
  useEffect(() => {
    return () => {
      clearRestartTimer();
      sessionRef.current += 1;
      listeningRef.current = false;
      disposeRecognition();
      releaseRegistrySlot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isListening, isSupported, error, start, stop, toggle, getCommittedText, rebase };
}
