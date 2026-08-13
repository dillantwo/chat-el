"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Mirrors LIMITS in FractionApp-es.html
const LIMITS = { denStart: 100, expandFactor: 20 } as const;

type Op = "*" | "/";

/**
 * Scoped styles for the 相等分數 (equivalent fractions) tool.
 * Ported from FractionApp-es.html (nav.css + number-line.css + FractionApp64.css
 * + bar-component.css) with the `body` selector rewritten to a `.fes-root`
 * wrapper so the styles stay isolated when rendered as a Next.js route. Token
 * overrides from bar-component.css are already folded into the final values.
 *
 * Unlike the previous port, the dividing-line grid is NOT animated with CSS
 * @keyframes. It is built and animated imperatively (buildGridHtml + rAF +
 * timeouts) to match the source's expand (dashed grow-down) and simplify
 * (sliding / merging line) behaviour driven by `--bar-anim-duration`.
 */
const STYLES = `
.fes-root {
  --primary:#3498db; --accent:#8e44ad; --success:#27ae60; --red:#e74c3c;
  --gray:#95a5a6; --grid-dark:#333; --yellow:#eeb015;
  font-family:'PingFang HK','Microsoft JhengHei','Noto Sans TC',sans-serif;
  background:linear-gradient(135deg,#e0f7fa 0%,#fff9c4 100%);
  min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:20px;
  /* 視窗/iframe 比工具小時可上下捲動，避免內容被裁切看不到 */
  overflow:auto; -webkit-overflow-scrolling:touch;
}
.fes-root *{ margin:0; padding:0; box-sizing:border-box; }
.fes-root .container{ background:#fff; padding:1.5rem; border-radius:16px;
  box-shadow:0 4px 20px rgba(0,0,0,0.1); max-width:1000px; width:100%; }

/* nav */
.fes-root .header{ display:flex; justify-content:space-between; align-items:center;
  margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fes-root .header-left{ display:flex; align-items:center; gap:15px; }
.fes-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fes-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fes-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fes-root .checkbox-label{ display:flex; align-items:center; gap:6px; font-size:0.95rem; color:#333;
  cursor:pointer; user-select:none; font-weight:bold; }
.fes-root .checkbox-label input[type=checkbox]{ cursor:pointer; width:16px; height:16px; accent-color:var(--primary); }
.fes-root .divider{ width:1px; height:18px; background:#ccc; }
.fes-root .speed-ctrl{ display:flex; align-items:center; gap:8px; font-size:0.95rem; color:#333; font-weight:bold; }
.fes-root .speed-ctrl input[type=range]{ width:80px; cursor:pointer; accent-color:var(--primary); }
.fes-root .lang-btn{ padding:6px 16px; border:2px solid var(--gray); background:#fff; color:#333;
  border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--gray);
  outline:none; transition:0.15s; transform:translateY(0); }
.fes-root .lang-btn:active{ box-shadow:0 0 0 var(--gray); transform:translateY(3px); }
.fes-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }

/* control panel */
.fes-root .control-panel{ display:flex; justify-content:center; gap:15px; margin-bottom:25px; position:relative; z-index:10; }
.fes-root .action-btn{ width:140px; padding:12px; border-radius:12px; border:2px solid transparent; cursor:pointer;
  font-size:1.2rem; font-weight:bold; transition:0.15s ease-out; background:#fff; transform:translateY(0); }
.fes-root .btn-merge{ border-color:var(--success); color:var(--success); box-shadow:0 6px 0 var(--success); }
.fes-root .btn-merge:disabled{ background:var(--success); color:#fff; box-shadow:0 0 0 var(--success); transform:translateY(6px); opacity:1; cursor:default; }
.fes-root .btn-slice{ border-color:var(--yellow); color:var(--yellow); box-shadow:0 6px 0 var(--yellow); }
.fes-root .btn-slice:disabled{ background:var(--yellow); color:#fff; box-shadow:0 0 0 var(--yellow); transform:translateY(6px); opacity:1; cursor:default; }

/* math engine */
.fes-root .math-engine{ display:flex; align-items:center; justify-content:center; gap:10px; margin:15px 0;
  padding:25px 15px 15px 15px; border-radius:20px; background:#fdfdfd; border:2px solid #eee; flex-wrap:wrap; }
.fes-root .fraction-box{ display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
.fes-root .fraction-input[readonly]{ border:transparent; background:transparent; font-size:2rem; pointer-events:none;
  width:100%; text-align:center; font-weight:bold; padding:8px 5px; }
.fes-root .num-target{ color:var(--accent); }
.fes-root .den-input{ color:var(--grid-dark); }
.fes-root .fraction-line{ width:100%; height:5px; background:var(--grid-dark); margin:8px 0; border-radius:3px; }
.fes-root .eq-sign{ font-size:2.5rem; font-weight:bold; color:#000; flex-shrink:0; margin:0 5px; }
.fes-root .process-container{ border:3px dashed #000; padding:15px; border-radius:20px; background:#fffcf0;
  display:flex; flex-direction:column; align-items:center; flex-grow:1; min-width:250px; box-sizing:border-box; }
.fes-root .row-align{ display:flex; align-items:center; justify-content:center; gap:8px; width:100%; margin:5px 0; }
.fes-root .base-num{ font-size:2rem; font-weight:bold; text-align:center; width:40px; flex-shrink:0; }
.fes-root .num-input{ color:var(--primary); }
.fes-root .op-select{ display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:900;
  border:3px solid #000; color:#000; border-radius:8px; width:65px; height:50px; background:#fff; box-sizing:border-box; user-select:none; }
.fes-root .input-wrapper{ display:flex; align-items:center; border-radius:12px; background:#fff; overflow:hidden;
  height:50px; border:3px solid #000; box-sizing:border-box; transition:0.3s; }
.fes-root .input-wrapper.start-wrap{ border-color:#34495e; width:100px; }
.fes-root .input-wrapper.factor-wrap{ width:95px; }
.fes-root .input-wrapper input{ flex:1; width:100%; height:100%; border:none; outline:none; text-align:center;
  font-size:1.8rem; font-weight:bold; background:transparent; -moz-appearance:textfield; appearance:textfield; color:#000; }
.fes-root .input-wrapper input.num-input{ color:var(--primary); }
.fes-root .input-wrapper input.den-input{ color:var(--grid-dark); }
.fes-root .input-wrapper input::-webkit-inner-spin-button,
.fes-root .input-wrapper input::-webkit-outer-spin-button{ -webkit-appearance:none; margin:0; }
.fes-root .stepper-btn-group{ display:flex; flex-direction:column; height:100%; width:35px; border-left:2px solid #000; flex-shrink:0; transition:0.3s; }
.fes-root .step-btn{ height:50%; flex:none; width:100%; border:none; background:#f8f9fa; color:#000; font-size:1.2rem;
  font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; line-height:1; transition:0.2s; user-select:none; box-sizing:border-box; }
.fes-root .step-btn:active{ background:#e2e6ea; }
.fes-root .step-btn.up{ border-bottom:2px solid #000; }

.fes-root .error-msg{ color:var(--red); font-size:0.9rem; text-align:center; min-height:2.4rem; margin-top:-10px;
  margin-bottom:10px; font-weight:bold; width:100%; white-space:pre-line; }

.fes-root .visual-stack{ width:100%; display:flex; flex-direction:column; gap:20px; margin-bottom:20px; }
.fes-root .bar-label{ font-weight:bold; margin-bottom:5px; font-size:1.1rem; display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.fes-root .bar-container{ height:70px; background:#f5f5f5; border-radius:6px; position:relative; border:2px solid #2c3e50;
  overflow:hidden;
  transition:width var(--bar-anim-duration,0.3s) ease, border-color 0.3s, box-shadow 0.3s, filter 0.3s; }
.fes-root .bar-fill{ height:100%; transition:width var(--bar-anim-duration,0.4s) ease; position:absolute; z-index:1; opacity:0.8; pointer-events:none; border-radius:0; }

/* grid overlay — built/animated imperatively (see drawProcess in the component) */
.fes-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; display:flex; z-index:2; pointer-events:none; border-radius:10px; overflow:hidden; }
.fes-root .segment{ flex:1; }
.fes-root .divider-thick{ flex:0 0 3px; background:#2c3e50; z-index:3; }
.fes-root .divider-thin{ flex:0 0 1px; position:relative; z-index:3; background:rgba(44,62,80,0.5); }
.fes-root .divider-anim-slot{ flex:0 0 1px; position:relative; z-index:3; background:transparent; }
.fes-root .divider-thin .anim-line,
.fes-root .divider-anim-slot .anim-line{ position:absolute; top:0; left:0; width:100%; background:var(--grid-dark); }
.fes-root .divider-thin .anim-line.anim-line-dashed,
.fes-root .divider-anim-slot .anim-line.anim-line-dashed{ left:50%; width:0; transform:translateX(-50%);
  border-left:2px dashed var(--grid-dark); background:transparent; }

/* 約分 (simplify) sliding / merging overlay */
.fes-root .simplify-anim-overlay{ display:block; }
.fes-root .simplify-anim-overlay .simplify-abs-thick,
.fes-root .simplify-anim-overlay .simplify-removed-line,
.fes-root .simplify-anim-overlay .simplify-retained-line{ position:absolute; top:0; transform:translateX(-50%); }
.fes-root .simplify-anim-overlay .simplify-abs-thick{ width:3px; height:100%; background:var(--grid-dark); z-index:4; }
.fes-root .simplify-anim-overlay .simplify-removed-line,
.fes-root .simplify-anim-overlay .simplify-retained-line{ width:1px; background:var(--grid-dark); z-index:3; }

/* number line */
.fes-root .number-line-wrapper{ padding:0 2px; margin-top:5px; transition:width var(--bar-anim-duration,0.3s) ease; }
.fes-root .number-line-container{ position:relative; height:50px; width:100%; }
.fes-root .nl-line{ position:absolute; top:5px; left:0; width:100%; height:2px; background:#2c3e50; }
.fes-root .nl-tick-wrapper{ position:absolute; top:0; display:flex; flex-direction:column; align-items:center; transform:translateX(-50%); }
.fes-root .nl-tick{ width:2px; height:12px; background:#2c3e50; }
.fes-root .nl-tick.major{ height:18px; width:3px; }
.fes-root .nl-label{ margin-top:4px; font-size:0.9rem; font-weight:bold; color:#000; text-align:center; }
.fes-root .nl-frac{ display:inline-flex; flex-direction:column; align-items:center; line-height:1.1; font-size:0.85rem; }
.fes-root .nl-num, .fes-root .nl-den{ padding:0 2px; }
.fes-root .nl-line-frac{ width:100%; height:1.5px; background:#2c3e50; margin:1px 0; }

/* question banner */
.fes-root .question-banner{ display:none; background:#e3f2fd; border-radius:14px; padding:14px 20px; margin-bottom:20px; text-align:center; border:2px solid #bbdefb; }
.fes-root .question-banner.show{ display:block; }
.fes-root .q-label{ font-size:0.85rem; color:#666; margin-bottom:6px; }
.fes-root .q-equation{ display:flex; align-items:center; justify-content:center; gap:10px; font-size:1.6rem; font-weight:bold; color:#1565c0; }
.fes-root .q-frac{ display:inline-flex; flex-direction:column; align-items:center; line-height:1.1; }
.fes-root .q-num, .fes-root .q-den{ padding:2px 8px; }
.fes-root .q-line{ width:100%; height:3px; background:#1565c0; border-radius:2px; }
.fes-root .q-blank{ color:var(--accent); background:#f3e5f5; border:2px dashed var(--accent); border-radius:6px; padding:0 10px; min-width:36px; text-align:center; }

/* embedded (inside iframe) */
.fes-root.embedded{ background:transparent; padding:15px; }
.fes-root.embedded .title-badge{ display:none; }
.fes-root.embedded .header{ justify-content:space-between; border-bottom:none; margin-bottom:10px; padding-bottom:0; }
.fes-root.embedded .container{ box-shadow:none; border-radius:0; padding:1rem; }

@media (max-width:600px){
  .fes-root .container{ padding:1rem; }
  .fes-root .title-badge{ font-size:1.1rem; }
  .fes-root .header{ justify-content:center; }
  .fes-root .header-right{ justify-content:center; width:100%; }
  .fes-root .controls-pill{ width:100%; justify-content:center; flex-wrap:wrap; }
  .fes-root .math-engine{ padding:20px 8px 8px 8px; gap:3px; }
  .fes-root .input-wrapper{ height:42px; }
  .fes-root .input-wrapper.start-wrap{ width:85px; }
  .fes-root .input-wrapper.factor-wrap{ width:80px; }
  .fes-root .input-wrapper input{ font-size:1.4rem; }
  .fes-root .stepper-btn-group{ width:30px; }
  .fes-root .step-btn{ font-size:1.1rem; }
  .fes-root .fraction-input[readonly]{ font-size:1.6rem; }
  .fes-root .eq-sign{ font-size:1.5rem; margin:0 2px; }
  .fes-root .process-container{ min-width:auto; padding:8px; flex-grow:1; }
  .fes-root .base-num{ font-size:1.3rem; width:20px; }
  .fes-root .op-select{ width:40px; height:42px; font-size:1.3rem; padding:0; }
  .fes-root .bar-container{ height:50px; }
  .fes-root .bar-label{ font-size:1rem; }
  .fes-root .action-btn{ width:110px; font-size:1.1rem; padding:10px; }
  .fes-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
}
`;

function FractionESInner() {
  const searchParams = useSearchParams();

  // ----- controlled inputs / mode state -----
  const [nStartStr, setNStartStr] = useState("2");
  const [dStartStr, setDStartStr] = useState("8");
  const [fnStr, setFnStr] = useState("1");
  const [fdStr, setFdStr] = useState("1");
  const [op, setOp] = useState<Op>("*");
  const [isSyncMode, setIsSyncMode] = useState(true);
  const [showNumberLine, setShowNumberLine] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [targetNum, setTargetNum] = useState<number | null>(null);
  const [targetDen, setTargetDen] = useState<number | null>(null);
  const [embedded, setEmbedded] = useState(false);

  // ----- refs to the imperatively-managed DOM (bar / grid / number line) -----
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const nlTicksRef = useRef<HTMLDivElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const nlContainerRef = useRef<HTMLDivElement>(null);

  // ----- animation bookkeeping (mirrors the module-level vars in the source) -----
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const prevFdRef = useRef(1);
  const prevFnRef = useRef(1);
  const genRef = useRef(0);
  const animTimeoutRef = useRef<number | null>(null);
  const bgTimeoutsRef = useRef<number[]>([]);

  // ----- derived values (mirror renderEverything) -----
  const n1 = parseInt(nStartStr, 10) || 2;
  const d1 = parseInt(dStartStr, 10) || 8;
  const fnVal = fnStr === "" ? 1 : parseInt(fnStr, 10) || 1;
  const fdVal = fdStr === "" ? 1 : parseInt(fdStr, 10) || 1;

  const isNumMismatch = !isSyncMode && fnVal !== fdVal;

  let canCalculate = true;
  const errorLines: string[] = [];
  if (op === "/") {
    if (fnVal === 0 || fdVal === 0) {
      canCalculate = false;
    } else if (n1 % fnVal !== 0 || d1 % fdVal !== 0) {
      errorLines.push(`⚠️ 錯誤：分子不能被 ${fnVal} 整除，或分母不能被 ${fdVal} 整除`);
      canCalculate = false;
    }
  }
  if (isNumMismatch) {
    errorLines.push("⚠️ 提示：分子和分母乘以或除以不同的數字，分數值已改變。");
  }

  const n2: number | null = canCalculate ? (op === "*" ? n1 * fnVal : n1 / fnVal) : null;
  const d2: number | null = canCalculate ? (op === "*" ? d1 * fdVal : d1 / fdVal) : null;
  const eqLeft = isNumMismatch && canCalculate ? "≠" : "=";

  // ----- factor / op-select colours (mirror syncOpColor) -----
  const baseColor = fnVal === 1 ? "#000" : op === "*" ? "var(--yellow)" : "var(--success)";
  const textColor = isNumMismatch ? "var(--red)" : fnVal === 1 ? "#000" : baseColor;
  const opColor = fnVal === 1 ? "#000" : baseColor;
  const fnBorder = isNumMismatch ? "var(--red)" : baseColor;
  const fdBorder = isNumMismatch
    ? "var(--red)"
    : fdVal === 1
      ? "#000"
      : op === "*"
        ? "var(--yellow)"
        : "var(--success)";
  const groupBorder = isNumMismatch ? "var(--red)" : "#000";

  // ----- iframe detection -----
  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);

  // ----- speed slider: only update the shared CSS var, do not restart drawing
  //       (mirrors updateSpeedUI) -----
  useEffect(() => {
    const maxFactor = Math.max(fnVal, fdVal);
    const base = maxFactor > 3 ? 1.0 : 1.3;
    rootRef.current?.style.setProperty("--bar-anim-duration", `${base / speed}s`);
  }, [speed, fnVal, fdVal]);

  // ----- input helpers (mirror manualInputChange / manualFactorChange) -----
  const applyStart = useCallback((nRaw: string, dRaw: string) => {
    const n = parseInt(nRaw, 10);
    const d = parseInt(dRaw, 10);
    if (isNaN(n) || isNaN(d)) {
      setNStartStr(nRaw);
      setDStartStr(dRaw);
      return;
    }
    let nn = n;
    let dd = d;
    if (dd > LIMITS.denStart) dd = LIMITS.denStart;
    if (dd < 1) dd = 1;
    if (nn > dd) nn = dd;
    if (nn < 0) nn = 0;
    setNStartStr(String(nn));
    setDStartStr(String(dd));
  }, []);

  const applyFactor = useCallback(
    (which: "fn" | "fd", raw: string) => {
      if (raw === "") {
        if (which === "fn") setFnStr("");
        else setFdStr("");
        return;
      }
      let val = parseInt(raw, 10) || 1;
      if (val < 1) val = 1;
      const maxLimit = op === "*" ? LIMITS.expandFactor : LIMITS.denStart;
      if (val > maxLimit) val = maxLimit;
      const s = String(val);
      if (isSyncMode) {
        setFnStr(s);
        setFdStr(s);
      } else if (which === "fn") {
        setFnStr(s);
      } else {
        setFdStr(s);
      }
    },
    [op, isSyncMode],
  );

  const stepStart = useCallback(
    (which: "n" | "d", delta: number) => {
      if (which === "n") {
        const v = (parseInt(nStartStr, 10) || 0) + delta;
        applyStart(String(v), dStartStr);
      } else {
        const v = (parseInt(dStartStr, 10) || 0) + delta;
        applyStart(nStartStr, String(v));
      }
    },
    [nStartStr, dStartStr, applyStart],
  );

  const stepFactor = useCallback(
    (which: "fn" | "fd", delta: number) => {
      const cur = which === "fn" ? fnStr : fdStr;
      const v = (parseInt(cur, 10) || 1) + delta;
      applyFactor(which, String(v));
    },
    [fnStr, fdStr, applyFactor],
  );

  // ----- mode / toggle / random / swap (mirror setMode etc.) -----
  const setMode = useCallback((nextOp: Op) => {
    setOp(nextOp);
    setFnStr("1");
    setFdStr("1");
    prevFdRef.current = 1;
    prevFnRef.current = 1;
  }, []);

  const toggleSyncMode = useCallback(() => {
    setIsSyncMode((prev) => {
      const next = !prev;
      if (next) {
        // switching back to sync: re-align the denominator factor to the numerator factor
        const v = fnStr === "" ? "1" : fnStr;
        setFnStr(v);
        setFdStr(v);
      }
      return next;
    });
  }, [fnStr]);

  const toggleNumberLine = useCallback(() => setShowNumberLine((p) => !p), []);

  const generateRandomFraction = useCallback(() => {
    let d = Math.floor(Math.random() * 11) + 2;
    let n = Math.floor(Math.random() * d) + 1;
    if (op === "/") {
      let multiplier = Math.floor(Math.random() * 4) + 2;
      if (d * multiplier > LIMITS.denStart) {
        multiplier = Math.floor(LIMITS.denStart / d);
        if (multiplier < 2) multiplier = 2;
      }
      n *= multiplier;
      d *= multiplier;
      if (d > LIMITS.denStart) {
        d = LIMITS.denStart;
        n = Math.floor(d / 2);
      }
    }
    setNStartStr(String(n));
    setDStartStr(String(d));
    setFnStr("1");
    setFdStr("1");
    prevFdRef.current = 1;
    prevFnRef.current = 1;
  }, [op]);

  const swapFractions = useCallback(() => {
    if (n2 === null || d2 === null) return; // "?" result → no-op, mirrors source
    setNStartStr(String(n2));
    setDStartStr(String(d2));
    setOp((prev) => (prev === "*" ? "/" : "*"));
    // factors are intentionally preserved across the swap (mirrors the source)
  }, [n2, d2]);

  // ----- incoming params (query string + postMessage), mirrors window.onload -----
  const applyIncoming = useCallback(
    (p: {
      numerator?: number | null;
      denominator?: number | null;
      mode?: string | null;
      targetNum?: number | null;
      targetDen?: number | null;
    }) => {
      if (p.targetNum !== undefined && p.targetNum !== null) setTargetNum(p.targetNum);
      if (p.targetDen !== undefined && p.targetDen !== null) setTargetDen(p.targetDen);
      if (p.numerator != null && p.denominator != null && p.denominator >= 1) {
        setNStartStr(String(Math.min(p.numerator, p.denominator)));
        setDStartStr(String(Math.min(p.denominator, LIMITS.denStart)));
      }
      setMode(p.mode === "simplify" ? "/" : "*");
    },
    [setMode],
  );

  useEffect(() => {
    const pNum = parseInt(searchParams.get("numerator") ?? "", 10);
    const pDen = parseInt(searchParams.get("denominator") ?? "", 10);
    const pTargetNum = searchParams.get("targetNum");
    const pTargetDen = searchParams.get("targetDen");
    applyIncoming({
      numerator: isNaN(pNum) ? null : pNum,
      denominator: isNaN(pDen) ? null : pDen,
      mode: searchParams.get("mode"),
      targetNum: pTargetNum ? parseInt(pTargetNum, 10) : null,
      targetDen: pTargetDen ? parseInt(pTargetDen, 10) : null,
    });
  }, [searchParams, applyIncoming]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data && e.data.type === "set-params" && e.data.params) {
        applyIncoming(e.data.params);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [applyIncoming]);

  // ----- imperative bar / grid / number-line rendering + animation -----
  // Ported almost verbatim from FractionApp-es.html: buildGridHtml, animateLineHeights,
  // applyMergeGridAnimation, scheduleGridLineAnimation, drawProcess, drawNumberLine.
  useEffect(() => {
    const bar = barRef.current;
    const grid = gridRef.current;
    const scaleWrapper = scaleWrapperRef.current;
    const nlContainer = nlContainerRef.current;
    const nlTicks = nlTicksRef.current;
    if (!bar || !grid || !scaleWrapper) return;

    const getAnimTiming = () => {
      const maxFactor = Math.max(fnVal, fdVal);
      let baseAnimDuration = 1.3;
      if (maxFactor > 3) baseAnimDuration = 1.0;
      const speedVal = speedRef.current;
      const animDurationSec = baseAnimDuration / speedVal;
      return { animDuration: `${animDurationSec}s`, animDurationMs: animDurationSec * 1000 };
    };

    const applyBarAnimDuration = (dur: string) =>
      rootRef.current?.style.setProperty("--bar-anim-duration", dur);

    const clearTimeouts = () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
      bgTimeoutsRef.current.forEach((id) => clearTimeout(id));
      bgTimeoutsRef.current = [];
    };

    const buildGridHtml = (drawSegments: number, fd: number, o: Op, anim: boolean) => {
      let html = '<div class="grid-overlay">';
      for (let i = 1; i <= drawSegments; i++) {
        html += '<div class="segment"></div>';
        if (i < drawSegments) {
          const isMainLine = i % fd === 0;
          if (o === "*") {
            if (isMainLine || fd === 1) {
              html += '<div class="divider-thick"></div>';
            } else if (anim) {
              html += '<div class="divider-anim-slot"><div class="anim-line anim-line-dashed" style="height:0%"></div></div>';
            } else {
              html += '<div class="divider-thin"><div class="anim-line" style="height:100%"></div></div>';
            }
          } else {
            if (fd === 1 || isMainLine) {
              html += '<div class="divider-thick"></div>';
            } else {
              const hS = anim ? "100%" : "0%";
              html += `<div class="divider-thin"><div class="anim-line" style="height:${hS}"></div></div>`;
            }
          }
        }
      }
      html += "</div>";
      return html;
    };

    const animateLineHeights = (
      lines: NodeListOf<Element>,
      toPct: number,
      durationMs: number,
      generation: number,
    ) =>
      new Promise<void>((resolve) => {
        const list = Array.from(lines) as HTMLElement[];
        if (!list.length) {
          resolve();
          return;
        }
        const startHeights = list.map((l) => {
          const h = l.style.height;
          return h.endsWith("%") ? parseFloat(h) : toPct === 0 ? 100 : 0;
        });
        const start = performance.now();
        const loop = (now: number) => {
          if (generation !== genRef.current) {
            resolve();
            return;
          }
          const p = Math.min((now - start) / durationMs, 1);
          list.forEach((l, i) => {
            l.style.height = `${startHeights[i] + (toPct - startHeights[i]) * p}%`;
          });
          if (p < 1) requestAnimationFrame(loop);
          else resolve();
        };
        requestAnimationFrame(loop);
      });

    // 合併格線：有倖存線則只滑動；僅一條細線時才上拉收回
    const applyMergeGridAnimation = (
      g: HTMLElement,
      drawSegments: number,
      oldS: number,
      s: number,
      generation: number,
      onComplete: () => void,
    ) => {
      const speedVal = speedRef.current || 1;
      const animTimeMs = (0.6 / speedVal) * 1000;
      const d = drawSegments / oldS;
      const removeJ = Math.floor(oldS / 2);
      const hasSlide = oldS > 2;

      let html = '<div class="grid-overlay simplify-anim-overlay">';
      for (let k = 1; k < d; k++) {
        html += `<div class="simplify-abs-thick" style="left:${(k / d) * 100}%;"></div>`;
      }
      for (let k = 0; k < d; k++) {
        for (let j = 1; j < oldS; j++) {
          const oldLeftPct = ((k * oldS + j) / (d * oldS)) * 100;
          if (hasSlide) {
            if (j === removeJ) continue;
            const newJ = j < removeJ ? j : j - 1;
            const newLeftPct = ((k * s + newJ) / (d * s)) * 100;
            html += `<div class="simplify-retained-line" style="left:${oldLeftPct}%; height:100%; transition:left ${animTimeMs}ms ease-out;" data-target-left="${newLeftPct}%"></div>`;
          } else if (j === removeJ) {
            html += `<div class="simplify-removed-line" style="left:${oldLeftPct}%; height:100%; transition:height ${animTimeMs}ms ease-in;"></div>`;
          }
        }
      }
      html += "</div>";
      g.innerHTML = html;

      animTimeoutRef.current = window.setTimeout(() => {
        if (generation !== genRef.current) return;
        if (hasSlide) {
          g.querySelectorAll(".simplify-retained-line").forEach((l) => {
            (l as HTMLElement).style.left = l.getAttribute("data-target-left") || "";
          });
        } else {
          g.querySelectorAll(".simplify-removed-line").forEach((l) => {
            (l as HTMLElement).style.height = "0%";
          });
        }
      }, 50);

      bgTimeoutsRef.current.push(
        window.setTimeout(() => {
          if (generation !== genRef.current) return;
          onComplete();
        }, 50 + animTimeMs + 20),
      );
    };

    const scheduleGridLineAnimation = (
      g: HTMLElement,
      o: Op,
      anim: boolean,
      fd: number,
      timing: { animDurationMs: number },
      generation: number,
    ) => {
      if (!anim || fd === 1 || o === "/") return;
      animTimeoutRef.current = window.setTimeout(() => {
        if (generation !== genRef.current) return;
        const lines = g.querySelectorAll(".anim-line");
        const toPct = 100; // op === '*'
        animateLineHeights(lines, toPct, timing.animDurationMs, generation).then(() => {
          if (generation !== genRef.current) return;
          lines.forEach((el) => {
            const l = el as HTMLElement;
            const wrap = l.closest(".divider-anim-slot");
            if (wrap) wrap.className = "divider-thin";
            l.classList.remove("anim-line-dashed");
            l.style.borderLeft = "";
            l.style.width = "";
            l.style.left = "";
            l.style.transform = "";
            l.style.background = "var(--grid-dark)";
            l.style.height = "100%";
          });
        });
      }, 50);
    };

    const drawNumberLine = (dVal: number, totalSegments: number) => {
      if (!nlTicks) return;
      let html = "";
      for (let i = 0; i <= totalSegments; i++) {
        const leftPos = (i / totalSegments) * 100;
        let label: string;
        if (i === 0) label = "0";
        else if (i === dVal) label = "1";
        else if (i % dVal === 0) label = String(i / dVal);
        else
          label = `<span class="nl-frac"><span class="nl-num">${i}</span><span class="nl-line-frac"></span><span class="nl-den">${dVal}</span></span>`;
        html += `<div class="nl-tick-wrapper" style="left:${leftPos}%;"><div class="nl-tick"></div><div class="nl-label">${label}</div></div>`;
      }
      nlTicks.innerHTML = html;
    };

    const drawProcess = (
      dn2: number,
      dd2: number,
      fn: number,
      fd: number,
      o: Op,
      anim: boolean,
      timing: { animDuration: string; animDurationMs: number },
      prevFd: number,
    ) => {
      const b = bar;
      const g = grid;
      clearTimeouts();
      const generation = ++genRef.current;

      const maxGrid = o === "*" ? dd2 : anim && fd !== 1 ? d1 : dd2;
      const ratio = dn2 / dd2;
      const scale = Math.max(1, ratio);
      const drawSegments = Math.max(maxGrid, Math.round(maxGrid * scale));

      applyBarAnimDuration(timing.animDuration);
      scaleWrapper.style.transition = `width ${timing.animDuration} ease`;
      b.style.transition = `width ${timing.animDuration} ease`;
      scaleWrapper.style.width = `${scale * 100}%`;
      b.style.width = `${(ratio / scale) * 100}%`;

      const mountGrid = (useAnim: boolean) => {
        g.innerHTML = buildGridHtml(drawSegments, fd, o, useAnim);
        scheduleGridLineAnimation(g, o, useAnim, fd, timing, generation);
      };

      const isExpandDecrease = anim && o === "*" && fd < prevFd && prevFd > 1;
      const isSimplifyStep = anim && o === "/" && fd > prevFd;

      if (isExpandDecrease) {
        const prevD2 = d1 * prevFd;
        const prevDrawSegments = Math.max(prevD2, Math.round(prevD2 * Math.max(1, dn2 / dd2)));
        animTimeoutRef.current = window.setTimeout(() => {
          if (generation !== genRef.current) return;
          applyMergeGridAnimation(g, prevDrawSegments, prevFd, fd, generation, () => {
            if (generation !== genRef.current) return;
            mountGrid(false);
          });
        }, 50);
        return;
      }

      if (isSimplifyStep) {
        animTimeoutRef.current = window.setTimeout(() => {
          if (generation !== genRef.current) return;
          applyMergeGridAnimation(g, drawSegments, fd, prevFd, generation, () => {
            if (generation !== genRef.current) return;
            const finalMaxGrid = dd2;
            const finalDrawSegments = Math.max(finalMaxGrid, Math.round(finalMaxGrid * (dn2 / dd2)));
            g.innerHTML = buildGridHtml(finalDrawSegments, fd, o, false);
          });
        }, 50);
        return;
      }

      mountGrid(anim);
    };

    // ----- run (mirror renderEverything) -----
    const savedPrevFd = prevFdRef.current;

    if (canCalculate && n2 !== null && d2 !== null) {
      bar.style.visibility = "visible";
      grid.style.visibility = "visible";
      if (nlContainer) nlContainer.style.visibility = "visible";
      scaleWrapper.style.filter = "grayscale(0%)";

      const timing = getAnimTiming();
      drawProcess(n2, d2, fnVal, fdVal, op, true, timing, savedPrevFd);

      if (showNumberLine) {
        const maxGrid = d2;
        const drawSegments = Math.max(maxGrid, Math.round(maxGrid * Math.max(1, n2 / d2)));
        drawNumberLine(maxGrid, drawSegments);
      }
    } else {
      // 約分除不盡才套用灰階濾鏡
      scaleWrapper.style.filter = "grayscale(100%)";
    }

    prevFdRef.current = fdVal;
    prevFnRef.current = fnVal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nStartStr, dStartStr, fnStr, fdStr, op, showNumberLine, canCalculate]);

  const showBanner = targetNum !== null || targetDen !== null;
  const targetNumDisplay = canCalculate ? String(n2) : "?";
  const targetDenDisplay = canCalculate ? String(d2) : "?";

  return (
    <div
      ref={rootRef}
      className={`fes-root${embedded ? " embedded" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{STYLES}</style>
      <div className="container">
        {/* header */}
        <div className="header">
          <div className="header-left">
            <button
              type="button"
              className={`lang-btn${isSyncMode ? " btn-active-mode" : ""}`}
              onClick={toggleSyncMode}
            >
              {isSyncMode ? "同步分子分母" : "自由調整"}
            </button>
            <div className="title-badge">相等分數</div>
          </div>
          <div className="header-right">
            <button type="button" className="lang-btn" onClick={swapFractions}>
              左右互換
            </button>
            <button type="button" className="lang-btn" onClick={generateRandomFraction}>
              隨機分數
            </button>
            <div className="controls-pill">
              <label className="checkbox-label">
                <input type="checkbox" checked={showNumberLine} onChange={toggleNumberLine} /> 顯示數線
              </label>
              <div className="divider" />
              <div className="speed-ctrl">
                <span>動畫速度: {speed.toFixed(1)} x</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* question banner */}
        <div className={`question-banner${showBanner ? " show" : ""}`}>
          <div className="q-label">在空格內填上正確的數字</div>
          <div className="q-equation">
            <span className="q-frac">
              <span className="q-num">{n1}</span>
              <span className="q-line" />
              <span className="q-den">{d1}</span>
            </span>
            <span>=</span>
            <span className="q-frac">
              <span className="q-num">
                {targetNum !== null ? targetNum : <span className="q-blank">?</span>}
              </span>
              <span className="q-line" />
              <span className="q-den">
                {targetDen !== null ? targetDen : <span className="q-blank">?</span>}
              </span>
            </span>
          </div>
        </div>

        {/* mode buttons */}
        <div className="control-panel">
          <button
            type="button"
            className="action-btn btn-merge"
            disabled={op === "/"}
            onClick={() => setMode("/")}
          >
            約分
          </button>
          <button
            type="button"
            className="action-btn btn-slice"
            disabled={op === "*"}
            onClick={() => setMode("*")}
          >
            擴分
          </button>
        </div>

        {/* math engine */}
        <div className="math-engine">
          <div className="fraction-box">
            <div className="input-wrapper start-wrap">
              <input
                type="number"
                className="num-input"
                value={nStartStr}
                min={1}
                max={100}
                inputMode="numeric"
                onChange={(e) => applyStart(e.target.value, dStartStr)}
                onBlur={() =>
                  applyStart(
                    nStartStr === "" || isNaN(parseInt(nStartStr, 10)) ? "2" : nStartStr,
                    dStartStr,
                  )
                }
              />
              <div className="stepper-btn-group">
                <button type="button" className="step-btn up" onClick={() => stepStart("n", 1)}>
                  +
                </button>
                <button type="button" className="step-btn down" onClick={() => stepStart("n", -1)}>
                  -
                </button>
              </div>
            </div>
            <div className="fraction-line" />
            <div className="input-wrapper start-wrap">
              <input
                type="number"
                className="den-input"
                value={dStartStr}
                min={1}
                max={100}
                inputMode="numeric"
                onChange={(e) => applyStart(nStartStr, e.target.value)}
                onBlur={() =>
                  applyStart(
                    nStartStr,
                    dStartStr === "" || isNaN(parseInt(dStartStr, 10)) ? "8" : dStartStr,
                  )
                }
              />
              <div className="stepper-btn-group">
                <button type="button" className="step-btn up" onClick={() => stepStart("d", 1)}>
                  +
                </button>
                <button type="button" className="step-btn down" onClick={() => stepStart("d", -1)}>
                  -
                </button>
              </div>
            </div>
          </div>

          <div className="eq-sign" style={{ color: eqLeft === "≠" ? "var(--red)" : "#000" }}>
            {eqLeft}
          </div>

          <div className="process-container">
            <div className="row-align">
              <div className="base-num num-input">{n1}</div>
              <div className="op-select" style={{ borderColor: opColor, color: opColor }}>
                {op === "*" ? "×" : "÷"}
              </div>
              <div className="input-wrapper factor-wrap" style={{ borderColor: fnBorder }}>
                <input
                  type="number"
                  value={fnStr}
                  min={1}
                  max={20}
                  inputMode="numeric"
                  style={{ color: textColor }}
                  onChange={(e) => applyFactor("fn", e.target.value)}
                  onBlur={() => {
                    if (fnStr === "") applyFactor("fn", "1");
                  }}
                />
                <div className="stepper-btn-group" style={{ borderLeftColor: groupBorder }}>
                  <button
                    type="button"
                    className="step-btn up"
                    style={{ color: textColor }}
                    onClick={() => stepFactor("fn", 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="step-btn down"
                    style={{ color: textColor }}
                    onClick={() => stepFactor("fn", -1)}
                  >
                    -
                  </button>
                </div>
              </div>
            </div>
            <div className="fraction-line" style={{ margin: "10px 0", background: "#000", height: 3 }} />
            <div className="row-align">
              <div className="base-num den-input">{d1}</div>
              <div className="op-select" style={{ borderColor: opColor, color: opColor }}>
                {op === "*" ? "×" : "÷"}
              </div>
              <div className="input-wrapper factor-wrap" style={{ borderColor: fdBorder }}>
                <input
                  type="number"
                  value={fdStr}
                  min={1}
                  max={20}
                  inputMode="numeric"
                  style={{ color: textColor }}
                  onChange={(e) => applyFactor("fd", e.target.value)}
                  onBlur={() => {
                    if (fdStr === "") applyFactor("fd", "1");
                  }}
                />
                <div className="stepper-btn-group" style={{ borderLeftColor: groupBorder }}>
                  <button
                    type="button"
                    className="step-btn up"
                    style={{ color: textColor }}
                    onClick={() => stepFactor("fd", 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="step-btn down"
                    style={{ color: textColor }}
                    onClick={() => stepFactor("fd", -1)}
                  >
                    -
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="eq-sign">=</div>

          <div className="fraction-box" style={{ width: 80 }}>
            <input
              type="text"
              className="fraction-input num-target"
              value={targetNumDisplay}
              readOnly
              tabIndex={-1}
            />
            <div className="fraction-line" />
            <input
              type="text"
              className="fraction-input den-input"
              value={targetDenDisplay}
              readOnly
              tabIndex={-1}
            />
          </div>
        </div>

        <div className="error-msg">{errorLines.join("\n")}</div>

        {/* visualization */}
        <div className="visual-stack">
          <div>
            <div
              className="bar-label"
              style={{ color: "var(--accent)", justifyContent: "space-between", width: "100%" }}
            >
              <span>運算結果</span>
            </div>
            <div
              style={{
                width: "100%",
                overflow: "visible",
                paddingBottom: 5,
                borderRadius: 8,
              }}
            >
              <div
                ref={scaleWrapperRef}
                style={{ width: "100%", minWidth: "100%", transition: "width 0.3s ease" }}
              >
                <div
                  className="bar-container"
                  style={{ borderColor: "var(--accent)", width: "100%" }}
                >
                  <div
                    ref={barRef}
                    className="bar-fill"
                    style={{ background: "var(--accent)", opacity: 0.8, pointerEvents: "none" }}
                  />
                  <div ref={gridRef} style={{ pointerEvents: "none" }} />
                </div>

                <div
                  className="number-line-wrapper"
                  style={{ display: showNumberLine ? "block" : "none", width: "100%" }}
                >
                  <div ref={nlContainerRef} className="number-line-container">
                    <div className="nl-line" />
                    <div ref={nlTicksRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FractionESPage() {
  return (
    <Suspense fallback={null}>
      <FractionESInner />
    </Suspense>
  );
}
