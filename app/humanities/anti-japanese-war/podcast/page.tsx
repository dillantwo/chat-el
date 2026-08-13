"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Mic,
  Podcast,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { basePath } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

const TOPIC = "anti-japanese-war";
const API = `${basePath}/api/humanities-podcast`;
// Mirrors the server's ceiling so the student is told before a long upload.
const MAX_BLOB_BYTES = MAX_UPLOAD_BYTES;

type RecStatus = "idle" | "recording" | "recorded";

interface RecordingMeta {
  id: string;
  title: string;
  script: string;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

const SCRIPT_IDEAS: string[] = [
  "介紹「三年零八個月」裡，香港人的日常生活是怎樣的。",
  "講述抗戰小英雄李石的勇敢故事。",
  "帶聽眾走訪一個抗戰歷史遺跡（例如西貢玫瑰小堂、羅家大屋）。",
  "用訪問的形式，想像訪問一位經歷過抗戰的長者。",
  "反思：為什麼我們今天要珍惜和平？",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function PodcastCreatorPage() {
  const { user, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const [loadingAudioId, setLoadingAudioId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedUrlRef = useRef<string>("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up mic + object URLs on unmount.
  useEffect(() => {
    return () => {
      stopStream();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, [stopStream]);

  const loadRecordings = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch(`${API}?topic=${encodeURIComponent(TOPIC)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = (await res.json()) as { items?: RecordingMeta[] };
        setRecordings(Array.isArray(json.items) ? json.items : []);
      }
    } catch {
      /* ignore list load errors */
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadRecordings();
    else if (!authLoading) setListLoading(false);
  }, [user, authLoading, loadRecordings]);

  const resetRecording = useCallback(() => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = "";
    }
    setRecordedBlob(null);
    setRecordedUrl("");
    setElapsed(0);
    setStatus("idle");
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    resetRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        recordedUrlRef.current = url;
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setStatus("recorded");
        stopStream();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } catch {
      setError("無法使用麥克風。請允許瀏覽器的麥克風權限後再試一次。🎙️");
      stopStream();
      setStatus("idle");
    }
  }, [resetRecording, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const saveRecording = useCallback(async () => {
    if (!recordedBlob) return;
    if (recordedBlob.size > MAX_BLOB_BYTES) {
      setError(`錄音檔案太大了（上限 ${MAX_UPLOAD_LABEL}），請錄製較短的片段再儲存。`);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const audioData = await blobToDataUrl(recordedBlob);
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          topic: TOPIC,
          title: title.trim() || "未命名播客",
          script,
          audioData,
          mimeType: recordedBlob.type || "audio/webm",
          durationSec: elapsed,
          sizeBytes: recordedBlob.size,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error || "儲存失敗，請稍後再試。");
        return;
      }
      setTitle("");
      setScript("");
      resetRecording();
      await loadRecordings();
    } catch {
      setError("儲存失敗，請檢查網絡後再試。");
    } finally {
      setSaving(false);
    }
  }, [recordedBlob, title, script, elapsed, resetRecording, loadRecordings]);

  const playSaved = useCallback(
    async (id: string) => {
      if (audioCache[id]) return;
      setLoadingAudioId(id);
      try {
        const res = await fetch(`${API}?recordingId=${encodeURIComponent(id)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = (await res.json()) as { item?: { audioData?: string } };
          if (json.item?.audioData) {
            setAudioCache((prev) => ({ ...prev, [id]: json.item!.audioData! }));
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingAudioId("");
      }
    },
    [audioCache],
  );

  const deleteRecording = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API}?recordingId=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
        setAudioCache((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch {
      /* ignore */
    } finally {
      setDeletingId("");
    }
  }, []);

  const tooBig = recordedBlob ? recordedBlob.size > MAX_BLOB_BYTES : false;

  return (
    <>
      <Header backHref="/humanities/anti-japanese-war" backLabel="返回抗日戰爭" />

      <main className="flex-1 min-h-0 overflow-y-auto bg-[#f8f7f4] text-[#080808]">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
          {/* Intro */}
          <section className="mb-6 rounded-[10px] border border-[#d8d8d8] bg-white p-6 shadow-[6px_6px_0px_#080808]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-[#f59e0b] text-white">
                <Podcast className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#ababab]">
                  Voice Podcast
                </p>
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
                  創建語音博客 🎙️
                </h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5a5a5a]">
              當一次小小播客主持人吧！用你的聲音講述抗戰的故事，錄好之後會儲存起來，隨時可以重聽。先想想要說什麼，準備好就按下錄音按鈕。✨
            </p>
            <div className="mt-4 rounded-[8px] border border-[#e5e5e5] bg-[#faf9f6] p-4">
              <p className="text-sm font-semibold text-[#080808]">💡 播客主題點子</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#5a5a5a]">
                {SCRIPT_IDEAS.map((idea) => (
                  <li key={idea} className="flex gap-2">
                    <span className="text-[#f59e0b]">•</span>
                    {idea}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {!user && !authLoading ? (
            <div className="rounded-[10px] border border-[#d8d8d8] bg-white p-6 text-center text-sm text-[#5a5a5a]">
              請先登入才能錄製和儲存你的播客。
            </div>
          ) : (
            <>
              {/* Recorder */}
              <section className="mb-6 rounded-[10px] border border-[#d8d8d8] bg-white p-6">
                {/* Title + script */}
                <label className="block text-sm font-semibold text-[#080808]">
                  播客標題
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：三年零八個月的香港故事"
                  maxLength={80}
                  className="mt-1.5 w-full rounded-[6px] border border-[#d8d8d8] px-3 py-2 text-sm outline-none transition focus:border-[#080808]"
                />

                <label className="mt-4 block text-sm font-semibold text-[#080808]">
                  我的腳本 / 筆記（可選）
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="先寫下你想說的重點，錄音時可以參考…"
                  rows={4}
                  maxLength={5000}
                  className="mt-1.5 w-full resize-y rounded-[6px] border border-[#d8d8d8] px-3 py-2 text-sm leading-6 outline-none transition focus:border-[#080808]"
                />

                {/* Recording controls */}
                <div className="mt-5 flex flex-col items-center gap-4 rounded-[8px] border border-[#e5e5e5] bg-[#faf9f6] p-6">
                  <div className="flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {status === "recording" && (
                      <span className="inline-block size-3 animate-pulse rounded-full bg-[#ef4444]" />
                    )}
                    {formatTime(elapsed)}
                  </div>

                  {status !== "recording" ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ef4444] px-6 py-3 text-sm font-medium text-white shadow-[4px_4px_0px_#080808] transition hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Mic className="size-5" />
                      {status === "recorded" ? "重新錄音" : "開始錄音"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center gap-2 rounded-full bg-[#080808] px-6 py-3 text-sm font-medium text-white shadow-[4px_4px_0px_#146ef5] transition hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Square className="size-5" />
                      停止錄音
                    </button>
                  )}

                  {status === "recorded" && recordedUrl && (
                    <div className="w-full space-y-3">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio controls src={recordedUrl} className="w-full" />
                      <div className="flex items-center justify-between text-xs text-[#5a5a5a]">
                        <span>時長 {formatTime(elapsed)}</span>
                        <span>{formatBytes(recordedBlob?.size ?? 0)}</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={saveRecording}
                          disabled={saving || tooBig}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#146ef5] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f57c9] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Save className="size-4" />
                          )}
                          {saving ? "儲存中…" : "儲存播客"}
                        </button>
                        <button
                          type="button"
                          onClick={resetRecording}
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8d8d8] px-5 py-2.5 text-sm font-medium text-[#5a5a5a] transition hover:border-[#080808] hover:text-[#080808] disabled:opacity-50"
                        >
                          <Trash2 className="size-4" />
                          捨棄
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="mt-4 flex items-start gap-2 rounded-[6px] bg-[#fef2f2] px-3 py-2 text-sm leading-6 text-[#b42318]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </p>
                )}
              </section>

              {/* Saved recordings */}
              <section>
                <h2 className="mb-3 text-lg font-semibold tracking-tight">
                  我的播客
                  {recordings.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-[#ababab]">
                      （{recordings.length}）
                    </span>
                  )}
                </h2>

                {listLoading ? (
                  <div className="flex items-center gap-2 rounded-[10px] border border-[#d8d8d8] bg-white p-5 text-sm text-[#5a5a5a]">
                    <Loader2 className="size-4 animate-spin" /> 載入中…
                  </div>
                ) : recordings.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-[#d8d8d8] bg-white p-6 text-center text-sm text-[#5a5a5a]">
                    還沒有播客。錄製你的第一集吧！🎧
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {recordings.map((rec) => (
                      <li
                        key={rec.id}
                        className="rounded-[10px] border border-[#d8d8d8] bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold tracking-tight">
                              🎙️ {rec.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#ababab]">
                              時長 {formatTime(rec.durationSec)} · {formatBytes(rec.sizeBytes)} ·{" "}
                              {new Date(rec.updatedAt).toLocaleDateString("zh-HK")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteRecording(rec.id)}
                            disabled={deletingId === rec.id}
                            aria-label="刪除播客"
                            className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-[#ababab] transition hover:bg-[#fef2f2] hover:text-[#ef4444] disabled:opacity-50"
                          >
                            {deletingId === rec.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </div>

                        {rec.script && (
                          <p className="mt-2 whitespace-pre-wrap rounded-[6px] bg-[#faf9f6] px-3 py-2 text-sm leading-6 text-[#5a5a5a]">
                            {rec.script}
                          </p>
                        )}

                        <div className="mt-3">
                          {audioCache[rec.id] ? (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <audio controls autoPlay src={audioCache[rec.id]} className="w-full" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => playSaved(rec.id)}
                              disabled={loadingAudioId === rec.id}
                              className="inline-flex items-center gap-2 rounded-full border border-[#d8d8d8] px-4 py-2 text-sm font-medium text-[#080808] transition hover:border-[#080808] disabled:opacity-50"
                            >
                              {loadingAudioId === rec.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Mic className="size-4 text-[#146ef5]" />
                              )}
                              載入並播放
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
