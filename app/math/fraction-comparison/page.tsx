"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type FractionFormat = "integer" | "fraction" | "mixed";
type FractionState = { format: FractionFormat; w: number; n: number; d: number };

const COLORS = ["var(--primary)", "var(--accent)", "var(--success)"] as const;
const GRAY = "#95a5a6";

function clampInt(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/**
 * Scoped styles for the fraction comparison tool.
 * Ported from the previous static HTML (nav.css + FractionApp59.css +
 * number-line.css + bar-component.css) with the `body` selector rewritten to a
 * `.fcmp-root` wrapper so it stays isolated as a Next.js route.
 */
const STYLES = `
.fcmp-root{
  --primary:#3498db; --accent:#8e44ad; --success:#27ae60; --red:#e74c3c;
  --gray:#95a5a6; --grid-dark:#333;
  --grid-thin-color:rgba(44,62,80,0.5);
  font-family:'PingFang HK','Microsoft JhengHei','Noto Sans TC',sans-serif;
  background:transparent; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:20px;
  /* When the viewport (or iframe) is smaller than the tool, allow scrolling to
     every part of it instead of clipping. Centered flex children would
     otherwise overflow unreachably to the left. */
  overflow:auto; -webkit-overflow-scrolling:touch;
}
.fcmp-root *{ margin:0; padding:0; box-sizing:border-box; }
.fcmp-root .container{ background:transparent; padding:1.5rem; max-width:1100px; width:100%; margin:0 auto; }

/* nav */
.fcmp-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fcmp-root .header-left{ display:flex; align-items:center; gap:15px; }
.fcmp-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fcmp-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fcmp-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fcmp-root .checkbox-label{ display:flex; align-items:center; gap:6px; font-size:0.95rem; color:#333; cursor:pointer; user-select:none; font-weight:bold; }
.fcmp-root .checkbox-label input[type=checkbox]{ cursor:pointer; width:16px; height:16px; accent-color:var(--primary); }
.fcmp-root .divider-v{ width:1px; height:18px; background:#ccc; }
.fcmp-root .lang-btn{ padding:6px 16px; border:2px solid var(--gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--gray); outline:none; transition:0.15s; transform:translateY(0); }
.fcmp-root .lang-btn:active{ box-shadow:0 0 0 var(--gray); transform:translateY(3px); }
.fcmp-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }
.fcmp-root select.lang-btn{ appearance:none; padding-right:30px;
  background:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>') no-repeat right 10px center; }

/* input area */
.fcmp-root .math-engine{ position:relative; display:flex; align-items:center; justify-content:center; gap:14px;
  margin:15px 0 30px 0; padding:30px 12px 45px 12px; border-radius:20px; background:#fdfdfd; border:2px solid #eee;
  flex-wrap:nowrap; min-height:200px; }
.fcmp-root .input-card{ position:relative; display:flex; align-items:center; justify-content:center; background:#fff;
  padding:14px 16px; border-radius:12px; border:3px solid #ccc; box-shadow:0 4px 6px rgba(0,0,0,0.05);
  cursor:context-menu; touch-action:none; user-select:none; transition:0.2s; min-height:120px; flex-wrap:wrap; }
.fcmp-root .input-card:hover{ border-color:#bbb; }
.fcmp-root .card-controls{ display:flex; align-items:center; gap:6px; width:100%; justify-content:center; margin-top:10px;
  padding-top:8px; border-top:1px solid #eee; flex-wrap:wrap; }
.fcmp-root .card-controls .card-fmt-btn{ padding:3px 8px !important; font-size:0.78rem !important; }
.fcmp-root .fraction-group{ display:flex; flex-direction:column; align-items:center; gap:5px; }
.fcmp-root .mixed-group{ display:flex; align-items:center; gap:6px; }
.fcmp-root .fraction-line{ width:100%; height:4px; background:var(--grid-dark); border-radius:2px; }
.fcmp-root .input-wrapper{ display:flex; align-items:center; border-radius:8px; background:#fff; overflow:hidden;
  height:45px; border:2px solid #ccc; box-sizing:border-box; width:66px; }
.fcmp-root .input-wrapper.wrapper-w{ width:74px; height:60px; }
.fcmp-root .input-wrapper input{ flex:1; width:100%; height:100%; border:none; outline:none; text-align:center;
  font-size:1.5rem; font-weight:bold; background:transparent; -moz-appearance:textfield; color:#333; padding:0; }
.fcmp-root .input-wrapper.wrapper-w input{ font-size:2rem; }
.fcmp-root .input-wrapper input::-webkit-inner-spin-button,
.fcmp-root .input-wrapper input::-webkit-outer-spin-button{ -webkit-appearance:none; margin:0; }
.fcmp-root .stepper-btn-group{ display:flex; flex-direction:column; height:100%; width:26px; border-left:2px solid #eee; flex-shrink:0; }
.fcmp-root .step-btn{ height:50%; width:100%; border:none; background:#f8f9fa; color:#666; font-size:1.2rem; cursor:pointer;
  display:flex; align-items:center; justify-content:center; padding:0; user-select:none; }
.fcmp-root .step-btn:active{ background:#e2e6ea; }
.fcmp-root .step-btn.up{ border-bottom:2px solid #eee; }

/* context menu */
.fcmp-root .context-menu{ position:fixed; background:#fff; border:1px solid #ccc; border-radius:8px;
  box-shadow:0 5px 15px rgba(0,0,0,0.2); z-index:1000; display:flex; flex-direction:column; overflow:hidden; min-width:120px; }
.fcmp-root .context-item{ padding:12px 16px; font-size:1rem; font-weight:bold; color:#333; cursor:pointer; text-align:center; border-bottom:1px solid #eee; }
.fcmp-root .context-item:last-child{ border-bottom:none; }
.fcmp-root .context-item:hover{ background:#f0f8ff; color:var(--primary); }

/* visualization */
.fcmp-root .visual-stack{ width:100%; display:flex; flex-direction:column; gap:30px; margin-bottom:20px; min-height:550px; }
.fcmp-root .visual-item{ width:100%; }
.fcmp-root .bar-label{ font-weight:bold; margin-bottom:8px; font-size:1.2rem; display:flex; align-items:center; gap:10px; transition:color 0.3s; }
.fcmp-root .color-dot{ width:16px; height:16px; border-radius:50%; display:inline-block; transition:background 0.3s; }
.fcmp-root .disp-frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; line-height:1.1; font-size:0.85rem; font-weight:bold; }
.fcmp-root .disp-num{ padding:0 4px; font-size:1.1rem; }
.fcmp-root .disp-den{ padding:0 4px; border-top:2px solid currentColor; font-size:1.1rem; }
.fcmp-root .disp-mixed{ display:inline-flex; align-items:center; gap:4px; font-size:1.3rem; }
.fcmp-root .bar-container{ height:60px; background:#f5f5f5; border-radius:6px; position:relative; overflow:hidden;
  border:2px solid #2c3e50; width:100%; transition:width 0.3s ease, border-color 0.3s, box-shadow 0.3s; }
.fcmp-root .draggable-bar{ cursor:ew-resize !important; touch-action:none; }
.fcmp-root .bar-fill{ height:100%; transition:width 0.4s ease, background 0.3s; position:absolute; z-index:1; opacity:0.8; pointer-events:none; left:0; top:0; }
.fcmp-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; display:flex; z-index:2; pointer-events:none; }
.fcmp-root .segment{ flex:1; }
.fcmp-root .divider-thick{ flex:0 0 3px; background:#2c3e50; z-index:3; }
.fcmp-root .divider-thin{ flex:0 0 1px; background:var(--grid-thin-color); z-index:3; }

/* number line */
.fcmp-root .number-line-wrapper{ padding:0; margin-top:5px; width:100%; transition:width 0.3s ease; }
.fcmp-root .number-line-container{ position:relative; height:50px; width:100%; }
.fcmp-root .nl-line{ position:absolute; top:5px; left:0; width:100%; height:2px; background:#2c3e50; }
.fcmp-root .nl-tick-wrapper{ position:absolute; top:0; display:flex; flex-direction:column; align-items:center; transform:translateX(-50%); }
.fcmp-root .nl-tick{ width:2px; height:12px; background:#2c3e50; }
.fcmp-root .nl-tick.major{ height:18px; width:3px; }
.fcmp-root .nl-label{ margin-top:4px; font-size:0.9rem; font-weight:bold; color:#000; text-align:center; }
.fcmp-root .nl-frac{ display:inline-flex; flex-direction:column; align-items:center; line-height:1.1; font-size:0.85rem; font-weight:bold; }
.fcmp-root .nl-num, .fcmp-root .nl-den{ padding:0 2px; }
.fcmp-root .nl-line-frac{ width:100%; height:1.5px; background:#2c3e50; margin:1px 0; }

@media (max-width:600px){
  .fcmp-root .container{ padding:1rem; }
  .fcmp-root .math-engine{ gap:10px; padding:25px 10px 40px 10px; min-height:170px; flex-wrap:wrap; }
  .fcmp-root .visual-stack{ min-height:500px; }
  .fcmp-root .input-card{ min-height:100px; padding:10px; }
  .fcmp-root .input-wrapper{ width:65px; height:40px; }
  .fcmp-root .input-wrapper input{ font-size:1.3rem; }
  .fcmp-root .input-wrapper.wrapper-w{ width:70px; height:50px; }
  .fcmp-root .input-wrapper.wrapper-w input{ font-size:1.6rem; }
  .fcmp-root .bar-container{ height:45px; }
  .fcmp-root .card-controls{ gap:4px; margin-top:8px; padding-top:6px; }
  .fcmp-root .card-controls .card-fmt-btn{ padding:2px 6px !important; font-size:0.72rem !important; }
}
`;

function getDecimalValue(data: FractionState): number {
  const w = data.format === "fraction" ? 0 : data.w;
  const num = data.format === "integer" ? 0 : data.n;
  const den = data.format === "integer" ? 1 : data.d;
  if (den === 0) return w;
  return w + num / den;
}

function VerticalFraction({ data }: { data: FractionState }) {
  if (data.format === "integer") {
    return <span style={{ fontSize: "1.4rem" }}>{data.w}</span>;
  }
  if (data.format === "fraction") {
    return (
      <span className="disp-frac">
        <span className="disp-num">{data.n}</span>
        <span className="disp-den">{data.d}</span>
      </span>
    );
  }
  return (
    <span className="disp-mixed">
      <span>{data.w}</span>
      <span className="disp-frac">
        <span className="disp-num">{data.n}</span>
        <span className="disp-den">{data.d}</span>
      </span>
    </span>
  );
}

function TickLabel({ i, den }: { i: number; den: number }) {
  const isMajor = i % den === 0;
  const wholePart = Math.floor(i / den);
  const remPart = i % den;
  if (isMajor) return <span style={{ fontSize: "1rem" }}>{wholePart}</span>;
  if (wholePart === 0) {
    return (
      <span className="nl-frac">
        <span className="nl-num">{remPart}</span>
        <span className="nl-line-frac" />
        <span className="nl-den">{den}</span>
      </span>
    );
  }
  return (
    <span className="nl-frac" style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      <span style={{ fontSize: "1rem" }}>{wholePart}</span>
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
        <span className="nl-num">{remPart}</span>
        <span className="nl-line-frac" />
        <span className="nl-den">{den}</span>
      </span>
    </span>
  );
}

const DEFAULT_STATE: FractionState[] = [
  { format: "fraction", w: 1, n: 1, d: 2 },
  { format: "fraction", w: 1, n: 3, d: 4 },
  { format: "mixed", w: 1, n: 1, d: 2 },
];

function FractionComparisonInner() {
  const searchParams = useSearchParams();

  const [fractions, setFractions] = useState<FractionState[]>(DEFAULT_STATE);
  const [activeCount, setActiveCount] = useState(2);
  const [isSyncMode, setIsSyncMode] = useState(true);
  const [showNL, setShowNL] = useState(true);
  const [containerWidths, setContainerWidths] = useState<number[]>([100, 100, 100]);
  const [vOffsets, setVOffsets] = useState<number[]>([0, 0, 0]);
  const [draggingIndex, setDraggingIndex] = useState(-1);
  const [embedded, setEmbedded] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef({
    index: -1,
    startX: 0,
    startY: 0,
    initialV: 0,
    mode: null as null | "h" | "v",
    isBarTarget: false,
    active: false,
  });

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);

  // ----- read fractions from URL / postMessage -----
  const applyParams = useCallback((search: URLSearchParams) => {
    const keys = [
      "num1", "den1", "whole1", "format1",
      "num2", "den2", "whole2", "format2",
      "num3", "den3", "whole3", "format3",
      "count",
    ];
    const has = (v: string | null) => v !== null && v !== "";
    const hasAny = keys.some((k) => has(search.get(k)));
    if (!hasAny) return;

    const toInt = (v: string | null, def: number) => {
      const n = parseInt(v ?? "", 10);
      return Number.isFinite(n) ? n : def;
    };

    const hasFrac3 = ["num3", "den3", "whole3", "format3"].some((k) => has(search.get(k)));
    let count = toInt(search.get("count"), hasFrac3 ? 3 : 2);
    count = clampInt(count, 2, 3);

    setFractions((prev) => {
      const next = prev.map((f) => ({ ...f }));
      for (let i = 0; i < count; i++) {
        const idx = i + 1;
        const wRaw = search.get("whole" + idx);
        const nRaw = search.get("num" + idx);
        const dRaw = search.get("den" + idx);
        const fmtRaw = search.get("format" + idx);

        const w = clampInt(toInt(wRaw, 0), 0, 99);
        const n = clampInt(toInt(nRaw, 1), 1, 99);
        const d = clampInt(toInt(dRaw, 2), 1, 99);

        let format: FractionFormat;
        if (fmtRaw === "integer" || fmtRaw === "fraction" || fmtRaw === "mixed") {
          format = fmtRaw;
        } else if (!has(nRaw) && !has(dRaw) && has(wRaw)) {
          format = "integer";
        } else if (has(wRaw) && w > 0) {
          format = "mixed";
        } else {
          format = "fraction";
        }
        next[i] = { format, w, n, d };
      }
      return next;
    });
    setActiveCount(count);
  }, []);

  useEffect(() => {
    applyParams(new URLSearchParams(searchParams.toString()));
  }, [searchParams, applyParams]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data && e.data.type === "set-params" && e.data.params) {
        const p = e.data.params as Record<string, unknown>;
        const sp = new URLSearchParams();
        Object.entries(p).forEach(([k, v]) => {
          if (v !== undefined && v !== null) sp.set(k, String(v));
        });
        applyParams(sp);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [applyParams]);

  // ----- derived comparison values -----
  const active = fractions.slice(0, activeCount);
  const maxValue = active.reduce((m, f) => Math.max(m, getDecimalValue(f)), 0);
  const scaleMax = Math.max(1, Math.ceil(maxValue));

  let widthsMatch = true;
  if (!isSyncMode) {
    const w0 = containerWidths[0];
    for (let i = 1; i < activeCount; i++) {
      if (Math.abs(w0 - containerWidths[i]) > 0.5) {
        widthsMatch = false;
        break;
      }
    }
  }
  const showMismatch = !isSyncMode && !widthsMatch;

  // ----- value editing -----
  const setField = useCallback((index: number, field: "w" | "n" | "d", raw: string) => {
    const minVal = field === "w" ? 0 : 1;
    let val = parseInt(raw, 10);
    if (isNaN(val)) val = minVal;
    val = clampInt(val, minVal, 99);
    setFractions((prev) => {
      const next = prev.map((f) => ({ ...f }));
      next[index][field] = val;
      return next;
    });
  }, []);

  const stepField = useCallback((index: number, field: "w" | "n" | "d", delta: number) => {
    const minVal = field === "w" ? 0 : 1;
    setFractions((prev) => {
      const next = prev.map((f) => ({ ...f }));
      next[index][field] = clampInt((next[index][field] || minVal) + delta, minVal, 99);
      return next;
    });
  }, []);

  const setFormatFor = useCallback((indices: number[], format: FractionFormat) => {
    setFractions((prev) => {
      const next = prev.map((f) => ({ ...f }));
      for (const idx of indices) {
        next[idx].format = format;
        if (format === "integer") next[idx].n = 1;
        if (format === "fraction") next[idx].w = 1;
      }
      return next;
    });
  }, []);

  const setFormatGlobal = useCallback(
    (format: FractionFormat) => {
      setFormatFor(Array.from({ length: activeCount }, (_, i) => i), format);
    },
    [activeCount, setFormatFor],
  );

  // ----- mode / count controls -----
  const toggleSyncMode = useCallback(() => {
    setIsSyncMode((prev) => {
      const next = !prev;
      if (next) {
        setContainerWidths([100, 100, 100]);
        setVOffsets([0, 0, 0]);
      }
      return next;
    });
  }, []);

  const changeCount = useCallback((val: number) => {
    setActiveCount(val);
  }, []);

  const randomizeBars = useCallback(() => {
    if (isSyncMode) return;
    setContainerWidths((prev) => {
      const next = [...prev];
      for (let i = 0; i < activeCount; i++) next[i] = 30 + Math.random() * 60;
      return next;
    });
  }, [isSyncMode, activeCount]);

  const matchBars = useCallback(() => {
    if (isSyncMode) return;
    setContainerWidths((prev) => {
      const next = [...prev];
      for (let i = 0; i < activeCount; i++) next[i] = 100;
      return next;
    });
  }, [isSyncMode, activeCount]);

  // ----- dragging (mode 2): horizontal resize + vertical move -----
  const applyHorizontal = useCallback(
    (index: number, clientX: number) => {
      const bar = barRefs.current[index];
      if (!bar || !bar.parentElement) return;
      const rect = bar.parentElement.getBoundingClientRect();
      let percent = ((clientX - rect.left) / rect.width) * 100;
      percent = clampInt(percent, 5, 100);
      setContainerWidths((prev) => {
        let p = percent;
        if (Math.abs(p - 100) < 3) {
          p = 100;
        } else {
          for (let j = 0; j < activeCount; j++) {
            if (j !== index && Math.abs(p - prev[j]) < 3) {
              p = prev[j];
              break;
            }
          }
        }
        const next = [...prev];
        next[index] = p;
        return next;
      });
    },
    [activeCount],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d.active || isSyncMode) return;
      if (!d.mode) {
        const dx = Math.abs(e.clientX - d.startX);
        const dy = Math.abs(e.clientY - d.startY);
        if (dx > 5 || dy > 5) {
          d.mode = dx > dy && d.isBarTarget ? "h" : "v";
        } else {
          return;
        }
      }
      if (d.mode === "h") {
        applyHorizontal(d.index, e.clientX);
      } else {
        const dy = e.clientY - d.startY;
        setVOffsets((prev) => {
          const next = [...prev];
          next[d.index] = d.initialV + dy;
          return next;
        });
      }
      if (e.cancelable) e.preventDefault();
    }
    function onUp() {
      const d = dragRef.current;
      if (!d.active) return;
      // tap on a bar without dragging => set width to tap position
      if (!d.mode && d.isBarTarget) {
        applyHorizontal(d.index, d.startX);
      }
      d.active = false;
      d.index = -1;
      d.mode = null;
      setDraggingIndex(-1);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isSyncMode, applyHorizontal]);

  const onItemPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number) => {
      if (isSyncMode) return;
      const target = e.target as HTMLElement;
      const isBar = !!target.closest(".bar-container");
      dragRef.current = {
        index,
        startX: e.clientX,
        startY: e.clientY,
        initialV: vOffsets[index] || 0,
        mode: null,
        isBarTarget: isBar,
        active: true,
      };
      setDraggingIndex(index);
    },
    [isSyncMode, vOffsets],
  );

  // close context menu on any click
  useEffect(() => {
    if (!menu) return;
    function onClick() {
      setMenu(null);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [menu]);

  const numberInput = (
    index: number,
    field: "w" | "n" | "d",
    extraClass = "",
  ) => (
    <div className={`input-wrapper ${extraClass}`}>
      <input
        type="number"
        value={fractions[index][field]}
        min={field === "w" ? 0 : 1}
        max={99}
        onChange={(e) => setField(index, field, e.target.value)}
      />
      <div className="stepper-btn-group">
        <button type="button" className="step-btn up" onClick={() => stepField(index, field, 1)}>
          +
        </button>
        <button type="button" className="step-btn down" onClick={() => stepField(index, field, -1)}>
          -
        </button>
      </div>
    </div>
  );

  const fmtActiveStyle = (data: FractionState, fmt: FractionFormat): React.CSSProperties =>
    data.format === fmt
      ? { borderColor: "#34495e", color: "#34495e", boxShadow: "0 3px 0 #34495e" }
      : {};

  return (
    <div className={`fcmp-root${embedded ? " embedded" : ""}`}>
      <style>{STYLES}</style>
      <div className="container">
        {/* header */}
        <div className="header">
          <div className="header-left">
            <div className="title-badge">分數比較</div>
          </div>
          <div className="header-right">
            <select
              className="lang-btn"
              value={String(activeCount)}
              onChange={(e) => changeCount(parseInt(e.target.value, 10))}
            >
              <option value="2">比較 2 個分數</option>
              <option value="3">比較 3 個分數</option>
            </select>
            <button
              type="button"
              className={`lang-btn${isSyncMode ? " btn-active-mode" : ""}`}
              onClick={toggleSyncMode}
            >
              {isSyncMode ? "固定長度" : "自由長度"}
            </button>
            {!isSyncMode ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="lang-btn"
                  onClick={randomizeBars}
                  style={{ boxShadow: "0 2px 0 var(--gray)", fontSize: "0.9rem", padding: "4px 10px" }}
                >
                  隨機長度
                </button>
                <button
                  type="button"
                  className="lang-btn"
                  onClick={matchBars}
                  style={{ boxShadow: "0 2px 0 var(--gray)", fontSize: "0.9rem", padding: "4px 10px" }}
                >
                  設定同一長度
                </button>
              </div>
            ) : null}
            <div className="controls-pill">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showNL}
                  onChange={(e) => setShowNL(e.target.checked)}
                />{" "}
                顯示數線
              </label>
              <span className="divider-v" />
              {(["integer", "fraction", "mixed"] as FractionFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className="lang-btn"
                  onClick={() => setFormatGlobal(fmt)}
                  style={{ padding: "4px 10px", fontSize: "0.85rem" }}
                >
                  {fmt === "integer" ? "整數" : fmt === "fraction" ? "分數" : "帶分數"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* input cards */}
        <div className="math-engine">
          {active.map((data, i) => (
            <div
              key={i}
              className="input-card"
              style={{ borderColor: COLORS[i] }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, index: i });
              }}
            >
              {data.format === "integer" ? (
                numberInput(i, "w", "wrapper-w")
              ) : data.format === "fraction" ? (
                <div className="fraction-group">
                  {numberInput(i, "n")}
                  <div className="fraction-line" />
                  {numberInput(i, "d")}
                </div>
              ) : (
                <div className="mixed-group">
                  {numberInput(i, "w", "wrapper-w")}
                  <div className="fraction-group">
                    {numberInput(i, "n")}
                    <div className="fraction-line" />
                    {numberInput(i, "d")}
                  </div>
                </div>
              )}
              <div className="card-controls">
                {(["integer", "fraction", "mixed"] as FractionFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className="lang-btn card-fmt-btn"
                    style={fmtActiveStyle(data, fmt)}
                    onClick={() => setFormatFor([i], fmt)}
                  >
                    {fmt === "integer" ? "整數" : fmt === "fraction" ? "分數" : "帶分數"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* visualization */}
        <div className="visual-stack">
          {active.map((data, i) => {
            const color = isSyncMode || widthsMatch ? COLORS[i] : GRAY;
            const borderColor = isSyncMode || widthsMatch ? COLORS[i] : "var(--red)";
            const shadow = showMismatch ? "0 0 8px rgba(231, 76, 60, 0.4)" : "none";

            const w = data.format === "fraction" ? 0 : data.w;
            const n = data.format === "integer" ? 0 : data.n;
            const d = data.format === "integer" ? 1 : data.d;
            const value = w + n / d;
            const percent = Math.min(100, (value / scaleMax) * 100);
            const totalSegments = scaleMax * d;

            const isDragging = draggingIndex === i;
            const itemStyle: React.CSSProperties = !isSyncMode
              ? {
                  position: "relative",
                  zIndex: isDragging ? 10 : 1,
                  transform: `translateY(${vOffsets[i] || 0}px)`,
                  touchAction: "none",
                  cursor: "move",
                  transition: isDragging ? "none" : undefined,
                }
              : {};

            const segments: React.ReactNode[] = [];
            for (let j = 1; j <= totalSegments; j++) {
              segments.push(<div key={`s${j}`} className="segment" />);
              if (j < totalSegments) {
                const isWhole = j % d === 0;
                segments.push(
                  <div key={`d${j}`} className={isWhole ? "divider-thick" : "divider-thin"} />,
                );
              }
            }

            const ticks: React.ReactNode[] = [];
            const totalTicks = scaleMax * d;
            for (let k = 0; k <= totalTicks; k++) {
              const leftPos = (k / totalTicks) * 100;
              const isMajor = k % d === 0;
              ticks.push(
                <div key={k} className="nl-tick-wrapper" style={{ left: `${leftPos}%` }}>
                  <div className={`nl-tick ${isMajor ? "major" : ""}`} />
                  <div className="nl-label">
                    <TickLabel i={k} den={d} />
                  </div>
                </div>,
              );
            }

            return (
              <div
                key={i}
                className="visual-item"
                style={itemStyle}
                onPointerDown={(e) => onItemPointerDown(e, i)}
              >
                <div className="bar-label" style={{ color }}>
                  <span className="color-dot" style={{ background: color }} />
                  <VerticalFraction data={data} />
                </div>
                <div
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  className={`bar-container ${isSyncMode ? "" : "draggable-bar"}`}
                  style={{
                    borderColor,
                    width: `${containerWidths[i]}%`,
                    boxShadow: shadow,
                    transition: isDragging ? "none" : undefined,
                  }}
                >
                  <div className="bar-fill" style={{ width: `${percent}%`, background: color }} />
                  <div className="grid-overlay">{segments}</div>
                </div>
                {showNL ? (
                  <div
                    className="number-line-wrapper"
                    style={{ width: `${containerWidths[i]}%`, transition: isDragging ? "none" : undefined }}
                  >
                    <div className="number-line-container">
                      <div className="nl-line" />
                      <div>{ticks}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {showMismatch ? (
            <div style={{ color: "var(--red)", fontWeight: "bold", textAlign: "center", marginTop: 10 }}>
              ⚠️ 長條圖整體長度不一致！請拖拉邊框至相同長度，才能比較大小。
            </div>
          ) : null}
        </div>
      </div>

      {/* context menu */}
      {menu ? (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
          {(["integer", "fraction", "mixed"] as FractionFormat[]).map((fmt) => (
            <div
              key={fmt}
              className="context-item"
              onClick={() => {
                setFormatFor([menu.index], fmt);
                setMenu(null);
              }}
            >
              {fmt === "integer" ? "整數" : fmt === "fraction" ? "分數" : "帶分數"}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FractionComparisonPage() {
  return (
    <Suspense fallback={null}>
      <FractionComparisonInner />
    </Suspense>
  );
}
