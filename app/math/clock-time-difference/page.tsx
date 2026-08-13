"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalogClock, type ClockHand } from "../_components/AnalogClock";

type ClockKey = "start" | "end";

type DragState = {
  hand: ClockHand;
  clock: ClockKey;
} | null;

type FeedbackState = {
  kind: "idle" | "correct" | "wrong";
  message: string;
};

type TimeDiffSteps = {
  isNextDay: boolean;
  calcHour1: number;
  calcHour2: number;
  displayMinute1: number;
  displayMinute2: number;
  borrowedHour2: number;
  borrowedMinute2: number;
  needsBorrow: boolean;
  diffHours: number;
  diffMinutes: number;
};

function getAngleFromPoint(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  if (!svg) {
    return 0;
  }

  const rect = svg.getBoundingClientRect();
  const x = clientX - (rect.left + rect.width / 2);
  const y = clientY - (rect.top + rect.height / 2);
  const angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
  return angle < 0 ? angle + 360 : angle;
}

function formatHour(totalMinutes: number, is24H: boolean) {
  const hour = Math.floor(totalMinutes / 60);
  return is24H ? String(hour).padStart(2, "0") : String(hour % 12 || 12);
}

function formatMinute(totalMinutes: number) {
  return String(totalMinutes % 60).padStart(2, "0");
}

function applyTimeMode(totalMinutes: number, usePm: boolean) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const nextHour = usePm
    ? hour < 12
      ? hour + 12
      : hour
    : hour >= 12
      ? hour - 12
      : hour;

  return nextHour * 60 + minute;
}

function buildSteps(startTime: number, endTime: number): TimeDiffSteps {
  let time1 = startTime;
  let time2 = endTime;
  let isNextDay = false;

  if (time2 < time1) {
    time2 += 1440;
    isNextDay = true;
  }

  const displayHour1 = Math.floor(time1 / 60) % 24;
  const displayMinute1 = time1 % 60;
  const displayHour2 = Math.floor(time2 / 60) % 24;
  const displayMinute2 = time2 % 60;
  const calcHour1 = displayHour1;
  const calcHour2 = displayHour2 + (isNextDay ? 24 : 0);
  const needsBorrow = displayMinute2 < displayMinute1;
  const borrowedMinute2 = displayMinute2 + 60;
  const borrowedHour2 = calcHour2 - 1;
  const diff = time2 - time1;

  return {
    isNextDay,
    calcHour1,
    calcHour2,
    displayMinute1,
    displayMinute2,
    borrowedHour2,
    borrowedMinute2,
    needsBorrow,
    diffHours: Math.floor(diff / 60),
    diffMinutes: diff % 60,
  };
}

export default function ClockTimeDifferencePage() {
  const startClockRef = useRef<SVGSVGElement | null>(null);
  const endClockRef = useRef<SVGSVGElement | null>(null);
  const lastAngleRef = useRef(0);
  const [startTime, setStartTime] = useState(540);
  const [endTime, setEndTime] = useState(885);
  const [is24H, setIs24H] = useState(false);
  const [dragging, setDragging] = useState<DragState>(null);
  const [answerHours, setAnswerHours] = useState("");
  const [answerMinutes, setAnswerMinutes] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle", message: "" });
  const [showSteps, setShowSteps] = useState(false);
  const [quizTargetDiff, setQuizTargetDiff] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState("");

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const svg = dragging.clock === "start" ? startClockRef.current : endClockRef.current;
      const currentAngle = getAngleFromPoint(svg, event.clientX, event.clientY);
      let diff = currentAngle - lastAngleRef.current;

      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const minutesDelta = Math.round(diff * (dragging.hand === "minute" ? 60 / 360 : 720 / 360));
      lastAngleRef.current = currentAngle;

      if (dragging.clock === "start") {
        setStartTime((value) => (value + minutesDelta + 1440) % 1440);
      } else {
        setEndTime((value) => (value + minutesDelta + 1440) % 1440);
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging]);

  useEffect(() => {
    setFeedback({ kind: "idle", message: "" });
    setShowSteps(false);
    setQuizFeedback("");
  }, [startTime, endTime, is24H]);

  const diffMinutes = (endTime - startTime + 1440) % 1440;
  const expectedHours = Math.floor(diffMinutes / 60);
  const expectedMinutes = diffMinutes % 60;
  const steps = useMemo(() => buildSteps(startTime, endTime), [startTime, endTime]);

  useEffect(() => {
    window.parent?.postMessage(
      {
        type: "clock-tool:state",
        payload: {
          tool: "clock-time-difference",
          startTime,
          endTime,
          startLabel: `${formatHour(startTime, is24H)}:${formatMinute(startTime)}${is24H ? "" : Math.floor(startTime / 60) >= 12 ? " PM" : " AM"}`,
          endLabel: `${formatHour(endTime, is24H)}:${formatMinute(endTime)}${is24H ? "" : Math.floor(endTime / 60) >= 12 ? " PM" : " AM"}`,
          is24H,
          diffMinutes,
          expectedHours,
          expectedMinutes,
          quizTargetDiff,
          feedbackKind: feedback.kind,
          showSteps,
        },
      },
      "*",
    );
  }, [diffMinutes, endTime, expectedHours, expectedMinutes, feedback.kind, is24H, quizTargetDiff, showSteps, startTime]);

  function startDrag(clock: ClockKey, hand: ClockHand, event: React.PointerEvent<SVGCircleElement>) {
    event.preventDefault();
    const svg = clock === "start" ? startClockRef.current : endClockRef.current;
    lastAngleRef.current = getAngleFromPoint(svg, event.clientX, event.clientY);
    setDragging({ hand, clock });
  }

  function stepTime(clock: ClockKey, deltaMinutes: number) {
    if (clock === "start") {
      setStartTime((value) => (value + deltaMinutes + 1440) % 1440);
      return;
    }

    setEndTime((value) => (value + deltaMinutes + 1440) % 1440);
  }

  function updateManualTime(clock: ClockKey, unit: "hour" | "minute", rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    const currentTime = clock === "start" ? startTime : endTime;
    let nextHour = Math.floor(currentTime / 60);
    let nextMinute = currentTime % 60;

    if (unit === "hour") {
      if (is24H) {
        nextHour = Math.max(0, Math.min(23, parsed));
      } else {
        const safeHour = Math.max(1, Math.min(12, parsed));
        const isPm = nextHour >= 12;
        nextHour = safeHour === 12 ? (isPm ? 12 : 0) : isPm ? safeHour + 12 : safeHour;
      }
    } else {
      nextMinute = Math.max(0, Math.min(59, parsed));
    }

    const nextTime = nextHour * 60 + nextMinute;
    if (clock === "start") {
      setStartTime(nextTime);
    } else {
      setEndTime(nextTime);
    }
  }

  function checkAnswer() {
    const studentHours = Number.parseInt(answerHours || "0", 10) || 0;
    const studentMinutes = Number.parseInt(answerMinutes || "0", 10) || 0;
    if (studentHours === expectedHours && studentMinutes === expectedMinutes) {
      setFeedback({
        kind: "correct",
        message: `答對了，正確答案是 ${expectedHours} 小時 ${expectedMinutes} 分鐘。`,
      });
      setShowSteps(false);
      return;
    }

    setFeedback({
      kind: "wrong",
      message: "答案不太對，記得借位時 1 小時 = 60 分鐘。",
    });
  }

  function startQuiz() {
    const nextStartTime = Math.floor(Math.random() * 1440);
    const target = (Math.floor(Math.random() * 11) + 1) * 60 + Math.floor(Math.random() * 12) * 5;
    setStartTime(nextStartTime);
    setQuizTargetDiff(target);
    setQuizFeedback("");
  }

  function checkQuiz() {
    if (quizTargetDiff === null) {
      return;
    }

    if (diffMinutes === quizTargetDiff) {
      setQuizFeedback("設定正確，可以再抽一題。\n");
      return;
    }

    setQuizFeedback(
      `目前差距是 ${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m，還沒到指定時間。`,
    );
  }

  function renderClock(clock: ClockKey, color: string, time: number) {
    const hours = Math.floor(time / 60);
    const minutes = time % 60;
    const hourAngle = (hours % 12) * 30 + (minutes / 60) * 30;
    const minuteAngle = minutes * 6;
    const ref = clock === "start" ? startClockRef : endClockRef;

    return (
      <div className="mb-5 aspect-square w-full max-w-[260px]">
        <AnalogClock
          className="h-full w-full"
          hourAngle={hourAngle}
          minuteAngle={minuteAngle}
          hourColor={color}
          minuteColor={color}
          hourDotRadius={15}
          minuteDotRadius={11}
          hourLength={90}
          minuteLength={140}
          onPointerStart={(hand, event) => startDrag(clock, hand, event)}
          ref={ref}
        />
      </div>
    );
  }

  return (
    <main className="h-full overflow-y-auto bg-white px-3 py-4 text-[#1b1b1f] md:px-5 md:py-5">
      <div className="mx-auto min-h-full w-full rounded-[24px] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.1)] md:p-8">
        <div className="mb-6 flex flex-col gap-3 border-b-2 border-[#f0f0f0] pb-4 md:flex-row md:items-center md:justify-between">
          <h2 className="m-0 text-2xl font-bold">Time Difference</h2>
          <button
            type="button"
            onClick={() => setIs24H((value) => !value)}
            className="rounded-[8px] bg-[#eee] px-3 py-2 text-sm font-semibold"
          >
            Mode: {is24H ? "24H" : "AM/PM"}
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-10">
          <section className="flex w-full max-w-[300px] flex-col items-center">
            {renderClock("start", "#ff4757", startTime)}
            <ClockControls
              title="Time 1"
              accentColor="#ff4757"
              is24H={is24H}
              time={startTime}
              onStepHour={(delta) => stepTime("start", delta)}
              onStepMinute={(delta) => stepTime("start", delta)}
              onHourChange={(value) => updateManualTime("start", "hour", value)}
              onMinuteChange={(value) => updateManualTime("start", "minute", value)}
              onSetAm={() => setStartTime((value) => applyTimeMode(value, false))}
              onSetPm={() => setStartTime((value) => applyTimeMode(value, true))}
            />
          </section>

          <section className="flex w-full max-w-[300px] flex-col items-center">
            {renderClock("end", "#2ed573", endTime)}
            <ClockControls
              title="Time 2"
              accentColor="#2ed573"
              is24H={is24H}
              time={endTime}
              onStepHour={(delta) => stepTime("end", delta)}
              onStepMinute={(delta) => stepTime("end", delta)}
              onHourChange={(value) => updateManualTime("end", "hour", value)}
              onMinuteChange={(value) => updateManualTime("end", "minute", value)}
              onSetAm={() => setEndTime((value) => applyTimeMode(value, false))}
              onSetPm={() => setEndTime((value) => applyTimeMode(value, true))}
            />
          </section>
        </div>

        <section className="mt-9 border-t-2 border-dashed border-[#ddd] pt-6 text-center">
          <div className="mb-2 text-[1.3rem] font-extrabold text-[#1b1b1f]">算算看，經過了多少時間？</div>
          <div className="mb-4 inline-block rounded-full border border-[#fadbd8] bg-[#fef0f0] px-4 py-1 text-[1.05rem] font-bold text-[#d35400]">
            提示：借位時 1 小時 = 60 分鐘
          </div>

          <div className="mb-4 flex items-center justify-center gap-3">
            <input
              type="number"
              min={0}
              max={23}
              value={answerHours}
              onChange={(event) => setAnswerHours(event.target.value)}
              className="w-[60px] rounded-[10px] border-2 border-[#ccc] p-2 text-center text-2xl font-bold"
              placeholder="0"
            />
            <span className="text-2xl font-bold text-[#555]">h</span>
            <input
              type="number"
              min={0}
              max={59}
              value={answerMinutes}
              onChange={(event) => setAnswerMinutes(event.target.value)}
              className="w-[60px] rounded-[10px] border-2 border-[#ccc] p-2 text-center text-2xl font-bold"
              placeholder="0"
            />
            <span className="text-2xl font-bold text-[#555]">m</span>
          </div>

          <button
            type="button"
            onClick={checkAnswer}
            className="rounded-[10px] bg-[#2ecc71] px-6 py-3 text-lg font-bold text-white"
          >
            檢查我的計算
          </button>

          <div
            className={`mt-3 min-h-6 text-lg font-bold ${
              feedback.kind === "correct"
                ? "text-[#27ae60]"
                : feedback.kind === "wrong"
                  ? "text-[#e74c3c]"
                  : "text-transparent"
            }`}
          >
            {feedback.message || "."}
          </div>

          {feedback.kind === "wrong" ? (
            <button
              type="button"
              onClick={() => setShowSteps((value) => !value)}
              className="mt-2 rounded-[8px] bg-[#9b59b6] px-4 py-2 text-base font-bold text-white"
            >
              {showSteps ? "收起詳解" : "看橫式詳解"}
            </button>
          ) : null}

          {showSteps ? (
            <div className="mx-auto mt-4 max-w-[450px] rounded-[12px] border-2 border-dashed border-[#e67e22] bg-[#fdf2e9] p-4 text-left text-lg leading-8 text-[#333]">
              <strong className="text-[1.15rem] text-[#d35400]">橫式計算過程</strong>
              {steps.isNextDay ? (
                <p className="mt-3 text-sm text-[#c0392b]">
                  Time 2 是隔天，所以先在計算時加上 24 小時。
                </p>
              ) : null}

              <div className="mt-4 rounded-[8px] border border-[#ccc] bg-white p-3 text-center text-[1.15rem] font-bold">
                Time 2 ({steps.calcHour2}時 {steps.displayMinute2}分) - Time 1 ({steps.calcHour1}時 {steps.displayMinute1}分)
              </div>

              {steps.needsBorrow ? (
                <>
                  <p className="mt-4">{steps.displayMinute2} 分不夠減 {steps.displayMinute1} 分，所以向小時借 1。</p>
                  <div className="mt-3 rounded-[8px] border-2 border-dashed border-[#e67e22] bg-[#fffcf8] p-3 text-center text-[1.15rem] font-bold">
                    借位後: ({steps.borrowedHour2}時 {steps.borrowedMinute2}分) - ({steps.calcHour1}時 {steps.displayMinute1}分)
                  </div>
                  <p className="mt-3">小時相減: {steps.borrowedHour2} - {steps.calcHour1} = {steps.diffHours} 時</p>
                  <p>分鐘相減: {steps.borrowedMinute2} - {steps.displayMinute1} = {steps.diffMinutes} 分</p>
                </>
              ) : (
                <>
                  <p className="mt-4">分鐘夠減，直接把小時和分鐘分開相減。</p>
                  <p className="mt-3">小時相減: {steps.calcHour2} - {steps.calcHour1} = {steps.diffHours} 時</p>
                  <p>分鐘相減: {steps.displayMinute2} - {steps.displayMinute1} = {steps.diffMinutes} 分</p>
                </>
              )}

              <div className="mt-4 border-t border-dashed border-[#ccc] pt-4 text-center text-xl text-[#27ae60]">
                答: 經過了 {steps.diffHours} 小時 {steps.diffMinutes} 分鐘
              </div>
            </div>
          ) : null}

          <div className="my-6 h-px w-full bg-[#eee]" />

          <button
            type="button"
            onClick={startQuiz}
            className="rounded-[8px] bg-[#3498db] px-5 py-2.5 text-base font-bold text-white"
          >
            隨機挑戰 (設定 Time 2)
          </button>

          {quizTargetDiff !== null ? (
            <div className="mx-auto mt-4 w-full max-w-[400px] rounded-[12px] bg-[#e3f2fd] p-4">
              <div className="mb-3 text-lg font-bold text-[#1976d2]">
                請將 Time 2 設為 Time 1 之後 {Math.floor(quizTargetDiff / 60)}h {quizTargetDiff % 60}m
              </div>
              <button
                type="button"
                onClick={checkQuiz}
                className="rounded-[8px] bg-[#f39c12] px-5 py-2.5 text-base font-bold text-white"
              >
                檢查 Time 2
              </button>
              {quizFeedback ? <p className="mt-3 font-semibold text-[#1b1b1f]">{quizFeedback}</p> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type ClockControlsProps = {
  title: string;
  accentColor: string;
  is24H: boolean;
  time: number;
  onStepHour: (delta: number) => void;
  onStepMinute: (delta: number) => void;
  onHourChange: (value: string) => void;
  onMinuteChange: (value: string) => void;
  onSetAm: () => void;
  onSetPm: () => void;
};

function ClockControls({
  title,
  accentColor,
  is24H,
  time,
  onStepHour,
  onStepMinute,
  onHourChange,
  onMinuteChange,
  onSetAm,
  onSetPm,
}: ClockControlsProps) {
  const isPm = Math.floor(time / 60) >= 12;

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className="w-full rounded-[16px] border-2 border-[#eee] bg-[#f8f9fa] px-4 py-3"
        style={{ borderLeft: `6px solid ${accentColor}` }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-[60px] text-lg font-extrabold" style={{ color: accentColor }}>
            {title}
          </div>

          {!is24H ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onSetAm}
                className={`rounded-[8px] px-3 py-1 text-xs font-semibold ${
                  !isPm ? "bg-[#1b1b1f] text-white" : "bg-[#eee] text-[#1b1b1f]"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={onSetPm}
                className={`rounded-[8px] px-3 py-1 text-xs font-semibold ${
                  isPm ? "bg-[#1b1b1f] text-white" : "bg-[#eee] text-[#1b1b1f]"
                }`}
              >
                PM
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onStepHour(60)}
                className="h-[26px] w-8 rounded-[6px] bg-[#e0e0e0] text-sm font-bold"
              >
                ▲
              </button>
              <input
                type="text"
                value={formatHour(time, is24H)}
                onChange={(event) => onHourChange(event.target.value)}
                className="w-11 rounded-[8px] border border-[#ccc] bg-white px-1 py-1 text-center font-mono text-xl"
              />
              <button
                type="button"
                onClick={() => onStepHour(-60)}
                className="h-[26px] w-8 rounded-[6px] bg-[#e0e0e0] text-sm font-bold"
              >
                ▼
              </button>
            </div>
            <span className="font-bold">:</span>
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onStepMinute(1)}
                className="h-[26px] w-8 rounded-[6px] bg-[#e0e0e0] text-sm font-bold"
              >
                ▲
              </button>
              <input
                type="text"
                value={formatMinute(time)}
                onChange={(event) => onMinuteChange(event.target.value)}
                className="w-11 rounded-[8px] border border-[#ccc] bg-white px-1 py-1 text-center font-mono text-xl"
              />
              <button
                type="button"
                onClick={() => onStepMinute(-1)}
                className="h-[26px] w-8 rounded-[6px] bg-[#e0e0e0] text-sm font-bold"
              >
                ▼
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}