"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalogClock, type ClockHand } from "../_components/AnalogClock";

const DAY_START = 6;
const NIGHT_START = 18;

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

function roundToFiveMinutes(totalMinutes: number) {
  return Math.round(totalMinutes / 5) * 5;
}

function buildAngleArcPath(hourAngle: number, minuteAngle: number) {
  let diff = Math.abs(hourAngle - minuteAngle);
  const innerAngle = Math.min(diff, 360 - diff);

  if (innerAngle === 0) {
    return { angle: 0, path: "" };
  }

  let start = hourAngle;
  let end = minuteAngle;
  const clockwiseDiff = (minuteAngle - hourAngle + 360) % 360;
  if (clockwiseDiff > 180) {
    start = minuteAngle;
    end = hourAngle;
  }

  const startRadians = ((start - 90) * Math.PI) / 180;
  const endRadians = ((end - 90) * Math.PI) / 180;
  const radius = 60;
  const x1 = 200 + radius * Math.cos(startRadians);
  const y1 = 200 + radius * Math.sin(startRadians);
  const x2 = 200 + radius * Math.cos(endRadians);
  const y2 = 200 + radius * Math.sin(endRadians);

  return {
    angle: innerAngle,
    path: `M 200 200 L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`,
  };
}

export default function Clock24HoursPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastAngleRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(546);
  const [is24HDisplay, setIs24HDisplay] = useState(false);
  const [show24Numbers, setShow24Numbers] = useState(false);
  const [snapTo5Min, setSnapTo5Min] = useState(false);
  const [showAngle, setShowAngle] = useState(false);
  const [dragging, setDragging] = useState<ClockHand | null>(null);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const currentAngle = getAngleFromPoint(svgRef.current, event.clientX, event.clientY);
      let diff = currentAngle - lastAngleRef.current;

      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const minutesChange = diff * (dragging === "minute" ? 60 / 360 : 720 / 360);
      lastAngleRef.current = currentAngle;
      setCurrentTime((value) => (value + minutesChange + 1440) % 1440);
    };

    const handleUp = () => {
      setDragging(null);
      if (snapTo5Min) {
        setCurrentTime((value) => roundToFiveMinutes(value) % 1440);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging, snapTo5Min]);

  const hours = Math.floor(currentTime / 60);
  const minutes = Math.floor(currentTime % 60);
  const hourAngle = (hours % 12) * 30 + (minutes / 60) * 30;
  const minuteAngle = minutes * 6;
  const angleArc = useMemo(
    () => buildAngleArcPath(hourAngle, minuteAngle),
    [hourAngle, minuteAngle],
  );

  const displayHours = is24HDisplay
    ? String(hours).padStart(2, "0")
    : String(hours % 12 || 12).padStart(2, "0");
  const displayMinutes = String(minutes).padStart(2, "0");
  const isDayTime = hours >= DAY_START && hours < NIGHT_START;

  useEffect(() => {
    window.parent?.postMessage(
      {
        type: "clock-tool:state",
        payload: {
          tool: "clock-24hrs",
          currentTime,
          displayTime: `${displayHours}:${displayMinutes}`,
          periodLabel: is24HDisplay ? "24H" : hours < 12 ? "A.M." : "P.M.",
          is24HDisplay,
          show24Numbers,
          snapTo5Min,
          showAngle,
          angleDegrees: angleArc.angle,
          isDayTime,
        },
      },
      "*",
    );
  }, [angleArc.angle, currentTime, displayHours, displayMinutes, hours, is24HDisplay, isDayTime, show24Numbers, showAngle, snapTo5Min]);

  function startDrag(hand: ClockHand, event: React.PointerEvent<SVGCircleElement>) {
    event.preventDefault();
    lastAngleRef.current = getAngleFromPoint(svgRef.current, event.clientX, event.clientY);
    setDragging(hand);
  }

  function stepTime(deltaMinutes: number) {
    setCurrentTime((value) => {
      const nextValue = (value + deltaMinutes + 1440) % 1440;
      return snapTo5Min ? roundToFiveMinutes(nextValue) % 1440 : nextValue;
    });
  }

  function toggleSnap() {
    setSnapTo5Min((value) => {
      const nextValue = !value;
      if (nextValue) {
        setCurrentTime((time) => roundToFiveMinutes(time) % 1440);
      }
      return nextValue;
    });
  }

  return (
    <main className="h-full overflow-y-auto bg-white px-4 py-4 text-[#1b1b1f] md:px-5 md:py-5">
      <div className="mx-auto min-h-full w-full rounded-[8px] bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.1)] md:p-8">
        <div className="mb-5 flex flex-col gap-3 text-sm font-bold md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span>24-hour system</span>
            <button
              type="button"
              onClick={() => setShow24Numbers((value) => !value)}
              className="rounded-[6px] border border-[#ccc] bg-white px-3 py-1 text-lg"
            >
              {show24Numbers ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSnap}
              className={`rounded-full border px-4 py-1.5 font-bold transition ${
                snapTo5Min
                  ? "border-[#333] bg-[#333] text-white"
                  : "border-[#ccc] bg-[#eee] text-[#1b1b1f]"
              }`}
            >
              {snapTo5Min ? "Snap: 5m (開)" : "Snap: 1m (關)"}
            </button>
            <button
              type="button"
              onClick={() => setShowAngle((value) => !value)}
              className={`rounded-full border px-4 py-1.5 font-bold transition ${
                showAngle
                  ? "border-[#333] bg-[#333] text-white"
                  : "border-[#ccc] bg-[#eee] text-[#1b1b1f]"
              }`}
            >
              顯示夾角
            </button>
          </div>
        </div>

        <div className="mx-auto mb-8 aspect-square w-full max-w-[340px]">
          <AnalogClock
            className="h-full w-full"
            hourAngle={hourAngle}
            minuteAngle={minuteAngle}
            hourColor="#ff4757"
            minuteColor="#2ed573"
            showOuter24Numbers={show24Numbers}
            angleArcPath={angleArc.path}
            angleArcVisible={showAngle}
            onPointerStart={startDrag}
            ref={svgRef}
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setIs24HDisplay((value) => !value)}
            className={`rounded-full px-5 py-2 text-base font-bold transition ${
              is24HDisplay ? "bg-[#333] text-white" : "bg-[#111827] text-white"
            }`}
          >
            {is24HDisplay ? "模式: 24H" : "模式: AM/PM"}
          </button>

          <div className="flex flex-wrap items-center justify-center gap-3 rounded-[16px] border-[3px] border-[#333] bg-white px-4 py-4">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => stepTime(60)}
                className="h-6 w-9 rounded-[4px] bg-[#eee] text-xs hover:bg-[#ddd]"
              >
                ▲
              </button>
              <div className="w-[60px] text-center font-mono text-[2.2rem] font-bold text-[#ff4757]">
                {displayHours}
              </div>
              <button
                type="button"
                onClick={() => stepTime(-60)}
                className="h-6 w-9 rounded-[4px] bg-[#eee] text-xs hover:bg-[#ddd]"
              >
                ▼
              </button>
            </div>

            <span className="text-[2rem] font-bold">:</span>

            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => stepTime(1)}
                className="h-6 w-9 rounded-[4px] bg-[#eee] text-xs hover:bg-[#ddd]"
              >
                ▲
              </button>
              <div className="w-[60px] text-center font-mono text-[2.2rem] font-bold text-[#2ed573]">
                {displayMinutes}
              </div>
              <button
                type="button"
                onClick={() => stepTime(-1)}
                className="h-6 w-9 rounded-[4px] bg-[#eee] text-xs hover:bg-[#ddd]"
              >
                ▼
              </button>
            </div>

            <div className="ml-2 flex min-w-[70px] items-center gap-2 text-lg font-extrabold text-[#333]">
              <span>{isDayTime ? "SUN" : "MOON"}</span>
              <span>{is24HDisplay ? "" : hours < 12 ? "A.M." : "P.M."}</span>
            </div>
          </div>

          {showAngle ? (
            <div className="rounded-[8px] border border-dashed border-[#ffa500] bg-[#fff3e0] px-4 py-2 text-lg font-bold text-[#666]">
              指針夾角：{angleArc.angle.toFixed(1)}°
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}