"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 整數與分數互換 (Integer / fraction / mixed-number conversion).
 *
 * Ported from public/math/FractionApp-Converting.html (nav.css + FractionApp66.css
 * + bar-component.css + FractionApp66.js). Enter an integer / fraction / mixed
 * number and see it as a segmented bar + number line, with a live conversion
 * analysis panel. Clicking bar segments sets the value; a right-click / long-press
 * menu (and the header buttons) switch between 整數 / 分數 / 帶分數 modes.
 *
 * Ported into a single mount effect that scopes CSS under `.fa66-root`, injects
 * the markup, exposes inline-handler functions on `window.__FA66`, reads the
 * whole/num/den/mode query params (sent by the dashboard), and cleans up on
 * unmount. `--max-wholes` is set on the bars container (not documentElement).
 */

const STYLES = `
.fa66-root{
  --nav-gray:#95a5a6; --nav-primary:#3498db;
  --primary-red:#ff3333; --primary-blue:#3333ff; --bar-border-color:#2c3e50; --integer-green:#009900; --bg-gray:#f9f9f9; --dark:#2c3e50;
  --bar-border-width:2px; --bar-border-radius:6px; --bar-bg:#f5f5f5; --bar-fill-opacity:0.8;
  --grid-thin-width:1px; --grid-thin-color:rgba(44,62,80,0.5);
  --nl-axis-color:#2c3e50; --nl-axis-height:2px; --nl-tick-color:#2c3e50; --nl-tick-width:2px; --nl-tick-height:12px;
  --frac-label-size:0.85rem; --frac-label-color:#000; --frac-label-weight:bold; --frac-line-height:1.5px; --frac-line-color:#2c3e50;
  font-family:"Microsoft JhengHei","Heiti TC",'PingFang HK',sans-serif;
  background-color:#f4f7f6; min-height:100vh; display:flex; justify-content:center; padding:20px;
  /* 視窗/iframe 比工具小時可上下捲動，避免內容被裁切看不到 */
  overflow:auto; -webkit-overflow-scrolling:touch;
}
.fa66-root *{ box-sizing:border-box; }
.fa66-root .app-container{ max-width:1000px; width:100%; box-sizing:border-box; background:#fff; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.1); padding:25px; }

/* nav */
.fa66-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fa66-root .header-left{ display:flex; align-items:center; gap:15px; }
.fa66-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fa66-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fa66-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fa66-root .divider{ width:1px; height:18px; background:#ccc; }
.fa66-root .lang-btn{ padding:6px 16px; border:2px solid var(--nav-gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--nav-gray); outline:none; transition:0.15s; transform:translateY(0); }
.fa66-root .lang-btn:active{ box-shadow:0 0 0 var(--nav-gray); transform:translateY(3px); }
.fa66-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }

/* bars */
.fa66-root .bars-container{ margin-bottom:30px; min-height:100px; padding:20px 30px; background:#fafafa; border:1px solid #eee; border-radius:12px; overflow-x:auto; }
.fa66-root .bars-container .bar-wrap-container{ gap:0 !important; flex-wrap:nowrap !important; display:flex; }
.fa66-root .bars-container .bar-unit{ position:relative; border:var(--bar-border-width) solid var(--bar-border-color); border-radius:0; box-sizing:border-box; background:var(--bar-bg); overflow:hidden; min-width:0; flex:1; width:auto !important; }
.fa66-root .bars-container .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:var(--bar-border-radius); border-bottom-left-radius:var(--bar-border-radius); }
.fa66-root .bars-container .bar-wrap-container.continuous .bar-unit:last-child{ border-top-right-radius:var(--bar-border-radius); border-bottom-right-radius:var(--bar-border-radius); border-right:var(--bar-border-width) solid var(--bar-border-color); }
.fa66-root .bars-container .bar-wrap-container.continuous .bar-unit:not(:last-child){ border-right:none; }
.fa66-root .bars-container .bar-fill{ height:100%; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); transition:width 0.3s ease; }
.fa66-root .bars-container .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; }
.fa66-root .bars-container .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa66-root .bars-container .nl-wrap-container{ display:flex; flex-wrap:nowrap !important; margin-top:2px; gap:0 !important; }
.fa66-root .bars-container .nl-unit{ flex:1; min-width:0; box-sizing:border-box; }
.fa66-root .bars-container .nl-line{ height:var(--nl-axis-height); background:var(--nl-axis-color); }
.fa66-root .bars-container .nl-tick-wrapper{ display:flex; flex-direction:column; align-items:center; transform:translateX(-50%); }
.fa66-root .bars-container .nl-tick{ width:var(--nl-tick-width); height:var(--nl-tick-height); background:var(--nl-tick-color); }
.fa66-root .bars-container .nl-label{ margin-top:4px; font-size:0.85rem; font-weight:bold; color:#000; text-align:center; white-space:nowrap; }
.fa66-root .bars-container .nl-frac{ display:inline-flex; flex-direction:column; align-items:center; line-height:1.1; font-size:0.85rem; }
.fa66-root .bars-container .nl-num, .fa66-root .bars-container .nl-den{ padding:0 2px; font-weight:bold; }
.fa66-root .bars-container .nl-line-frac{ width:100%; height:var(--frac-line-height); background:var(--frac-line-color); margin:1px 0; }

/* dashboard */
.fa66-root .dashboard{ display:grid; grid-template-columns:1.4fr 1fr; gap:20px; border-top:2px solid #eee; padding-top:20px; }
.fa66-root .input-section{ background:var(--bg-gray); padding:15px; border-radius:12px; border:1px solid #ddd; position:relative; }
.fa66-root .fraction-ui{ display:flex; align-items:center; gap:10px; margin:15px 0; background:#fff; padding:10px; border-radius:8px; box-shadow:inset 0 2px 4px rgba(0,0,0,0.05); }
.fa66-root input[type=number]{ width:55px; padding:5px; text-align:center; font-size:1.2em; font-weight:bold; border:2px solid #ccc; border-radius:4px; }
.fa66-root #inputWhole{ border-color:var(--integer-green); background-color:#fff; }
.fa66-root #inputNum{ color:var(--primary-red); border-color:#ff9999; }
.fa66-root #inputDen{ color:var(--primary-blue); border-color:#9999ff; }
.fa66-root .f-line{ width:100%; height:2px; background:#000; margin:4px 0; }
.fa66-root .btn-confirm{ padding:6px 15px; font-size:1em; font-weight:bold; background-color:#0056b3; color:#fff; border:none; border-radius:8px; cursor:pointer; transition:background-color 0.2s; }
.fa66-root .btn-confirm:hover{ background-color:#003d80; }
.fa66-root .info-section{ padding:15px; border:1px solid #ddd; background-color:#fff; border-radius:12px; }
.fa66-root .info-title{ color:var(--dark); font-weight:bold; margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:8px; }
.fa66-root .info-section .nl-frac{ display:inline-flex; flex-direction:column; align-items:center; line-height:1.1; vertical-align:middle; }
.fa66-root .info-section .nl-num, .fa66-root .info-section .nl-den{ padding:0 3px; font-weight:bold; }
.fa66-root .info-section .nl-line-frac{ width:100%; height:2px; background:var(--frac-line-color); margin:2px 0; }
.fa66-root .settings label{ font-weight:bold; color:var(--dark); font-size:0.95rem; }
.fa66-root .settings input[type=range]{ cursor:pointer; accent-color:#0056b3; }

.fa66-root #customContextMenu{ display:none; position:absolute; background:#fff; border:1px solid #ccc; box-shadow:2px 2px 8px rgba(0,0,0,0.15); z-index:1000; border-radius:8px; overflow:hidden; }
.fa66-root #customContextMenu div{ padding:10px 20px; cursor:pointer; font-weight:bold; }
.fa66-root #customContextMenu div:hover{ background-color:#f0f8ff; color:#0056b3; }

@media (max-width:768px){
  .fa66-root .header{ flex-direction:column; align-items:stretch; text-align:center; }
  .fa66-root .header-left{ justify-content:center; }
  .fa66-root .header-right{ justify-content:center; width:100%; }
  .fa66-root .controls-pill{ width:100%; justify-content:center; flex-wrap:wrap; }
  .fa66-root .title-badge{ font-size:1.1rem; }
  .fa66-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
  .fa66-root .app-container{ width:100%; padding:15px; }
  .fa66-root .dashboard{ grid-template-columns:1fr; }
}

/* embedded (inside iframe) — 去除底層灰底並自適應父頁面，比照相等分數 */
.fa66-root.embedded{ background:transparent; padding:15px; }
.fa66-root.embedded .app-container{ box-shadow:none; border-radius:0; padding:1rem; }
`;

const BODY_HTML = `
<div class="app-container">
  <div class="header">
    <div class="header-left">
      <div class="title-badge">整數與分數互換</div>
    </div>
    <div class="header-right">
      <div class="controls-pill">
        <button class="lang-btn" id="btn-mode-whole" onclick="window.__FA66.setMode('whole')">整數</button>
        <span class="divider"></span>
        <button class="lang-btn" id="btn-mode-fraction" onclick="window.__FA66.setMode('fraction')">分數</button>
        <span class="divider"></span>
        <button class="lang-btn" id="btn-mode-mixed" onclick="window.__FA66.setMode('mixed')" style="border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e;">帶分數</button>
        <span class="divider"></span>
      </div>
    </div>
  </div>

  <div id="barsDisplay" class="bars-container"></div>

  <div class="dashboard">
    <div class="input-section">
      <div class="info-title">請輸入數值</div>
      <div class="fraction-ui" id="inputArea">
        <input type="number" id="inputWhole" value="1" min="0" max="100">
        <div class="fraction-input-stack" id="fractionPart" style="display:inline-flex; flex-direction: column; align-items: center;">
          <input type="number" id="inputNum" value="1" min="0" max="100">
          <div class="f-line"></div>
          <input type="number" id="inputDen" value="3" min="1" max="100">
        </div>
        <button class="btn-confirm" onclick="window.__FA66.updateUI()">確定</button>
      </div>

      <div class="settings" style="margin-top: 20px;">
        <div>
          <label>長條圖高度：</label>
          <input type="range" id="heightSlider" min="0" max="100" value="45" oninput="window.__FA66.updateUI()">
        </div>
        <div style="margin-top: 10px;">
          <label>單位闊度：</label>
          <input type="range" id="widthSlider" min="50" max="300" value="150" oninput="window.__FA66.updateUI()">
        </div>
      </div>
    </div>

    <div class="info-section" id="explanationText"></div>
  </div>
</div>

<div id="customContextMenu">
  <div onclick="window.__FA66.setMode('whole')">整數</div>
  <div onclick="window.__FA66.setMode('fraction')">分數</div>
  <div onclick="window.__FA66.setMode('mixed')">帶分數</div>
</div>
`;

type FA66Api = {
  setMode: (mode: string) => void;
  updateUI: () => void;
};

declare global {
  interface Window {
    __FA66?: FA66Api;
  }
}

export default function FractionConvertingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [embedded, setEmbedded] = useState(false);

  // Detect whether we are rendered inside an iframe (e.g. the tool preview in
  // the math dashboard). When embedded we drop the grey full-page background
  // and container chrome so the tool blends into the parent page.
  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $e = (id: string) => document.getElementById(id) as HTMLElement | null;
    const $i = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    let FIXED_UNIT_WIDTH = 150;
    let longPressTimer: number | null = null;

    function showMenu(x: number, y: number) {
      const contextMenu = $e("customContextMenu");
      if (!contextMenu) return;
      contextMenu.style.display = "block";
      contextMenu.style.left = x + "px";
      contextMenu.style.top = y + "px";
    }

    function setMode(mode: string) {
      const wholeInp = $i("inputWhole")!;
      const numInp = $i("inputNum")!;
      const denInp = $i("inputDen")!;
      const fracPart = $e("fractionPart")!;

      wholeInp.value = "1";
      numInp.value = "1";
      denInp.value = "1";

      if (mode === "whole") {
        wholeInp.style.display = "block";
        fracPart.style.display = "none";
      } else if (mode === "fraction") {
        wholeInp.style.display = "none";
        fracPart.style.display = "inline-flex";
      } else {
        wholeInp.style.display = "block";
        fracPart.style.display = "inline-flex";
      }

      const btns: Record<string, string> = { whole: "btn-mode-whole", fraction: "btn-mode-fraction", mixed: "btn-mode-mixed" };
      Object.entries(btns).forEach(([m, id]) => {
        const btn = $e(id);
        if (!btn) return;
        if (m === mode) {
          btn.style.borderColor = "#34495e";
          btn.style.color = "#34495e";
          btn.style.boxShadow = "0 3px 0 #34495e";
        } else {
          btn.style.borderColor = "";
          btn.style.color = "";
          btn.style.boxShadow = "";
        }
      });

      updateUI();
    }

    function updateUI() {
      let whole = parseInt($i("inputWhole")!.value);
      if (isNaN(whole) || whole < 0) {
        whole = 1;
        $i("inputWhole")!.value = "1";
      } else if (whole > 100) {
        whole = 100;
        $i("inputWhole")!.value = "100";
      }

      let num = parseInt($i("inputNum")!.value);
      if (isNaN(num)) {
        num = 0;
        $i("inputNum")!.value = "0";
      } else if (num < 0) {
        num = 0;
        $i("inputNum")!.value = "0";
      } else if (num > 100) {
        num = 100;
        $i("inputNum")!.value = "100";
      }

      let den = parseInt($i("inputDen")!.value);
      if (den <= 0) {
        den = 1;
        $i("inputDen")!.value = "1";
      } else if (isNaN(den)) {
        den = 1;
      } else if (den > 100) {
        den = 100;
        $i("inputDen")!.value = "100";
      }

      let actualW = whole;
      let actualN = num;

      if ($e("inputWhole")!.style.display === "none") actualW = 0;
      if ($e("fractionPart")!.style.display === "none") actualN = 0;

      const barHeight = parseInt($i("heightSlider")!.value);
      FIXED_UNIT_WIDTH = parseInt($i("widthSlider")!.value) || 150;

      const isIntegerDisplay = $e("fractionPart")!.style.display === "none";
      renderBars(actualW, actualN, den, barHeight, isIntegerDisplay);
      renderText(actualW, actualN, den);
    }

    function handleCellClick(clickedTotalCells: number, d: number) {
      const wholeInp = $i("inputWhole")!;
      const numInp = $i("inputNum")!;
      const fracPart = $e("fractionPart")!;

      if (wholeInp.style.display === "none") {
        numInp.value = String(clickedTotalCells);
      } else if (fracPart.style.display === "none") {
        const w = Math.ceil(clickedTotalCells / d);
        wholeInp.value = String(Math.max(w, 1));
      } else {
        const w = Math.floor(clickedTotalCells / d);
        const n = clickedTotalCells % d;
        if (n === 0) {
          wholeInp.value = String(w);
          numInp.value = "1";
        } else {
          wholeInp.value = String(w);
          numInp.value = String(n);
        }
      }
      updateUI();
    }

    function renderBars(w: number, n: number, d: number, height: number, isIntegerDisplay: boolean) {
      const container = $e("barsDisplay")!;
      container.innerHTML = "";

      let displayD = d;
      let totalFilledCells = w * d + n;

      if (isIntegerDisplay) {
        displayD = 1;
        totalFilledCells = w;
      }

      const totalUnitsNeeded = Math.max(Math.ceil(totalFilledCells / displayD), 1);
      container.style.setProperty("--max-wholes", String(totalUnitsNeeded));

      const barWrap = document.createElement("div");
      barWrap.className = "bar-wrap-container continuous";
      barWrap.style.width = FIXED_UNIT_WIDTH * totalUnitsNeeded + "px";

      for (let u = 0; u < totalUnitsNeeded; u++) {
        const unit = document.createElement("div");
        unit.className = "bar-unit";
        unit.style.height = Math.max(height, 10) + "px";

        let filledInThisUnit = 0;
        if (totalFilledCells > u * displayD) {
          filledInThisUnit = Math.min(displayD, totalFilledCells - u * displayD);
        }
        const fillPct = (filledInThisUnit / displayD) * 100;

        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = fillPct + "%";
        fill.style.backgroundColor = "var(--primary-red, #ff3333)";
        unit.appendChild(fill);

        const grid = document.createElement("div");
        grid.className = "grid-overlay";
        if (displayD > 1) {
          for (let k = 1; k < displayD; k++) {
            const line = document.createElement("div");
            line.className = "abs-thin-line";
            line.style.left = (k / displayD) * 100 + "%";
            grid.appendChild(line);
          }
        }
        unit.appendChild(grid);

        for (let i = 0; i < displayD; i++) {
          const seg = document.createElement("div");
          seg.style.position = "absolute";
          seg.style.left = (i / displayD) * 100 + "%";
          seg.style.width = 100 / displayD + "%";
          seg.style.height = "100%";
          seg.style.top = "0";
          seg.style.zIndex = "10";
          seg.style.cursor = "pointer";
          const cellIndex = u * displayD + i + 1;
          seg.onclick = () => handleCellClick(cellIndex, displayD);
          unit.appendChild(seg);
        }

        barWrap.appendChild(unit);
      }
      container.appendChild(barWrap);

      const nlWrap = document.createElement("div");
      nlWrap.className = "nl-wrap-container continuous";
      nlWrap.style.width = FIXED_UNIT_WIDTH * totalUnitsNeeded + "px";

      for (let u = 0; u < totalUnitsNeeded; u++) {
        const nlUnit = document.createElement("div");
        nlUnit.className = "nl-unit";
        nlUnit.style.position = "relative";
        nlUnit.style.height = "40px";

        let labelsHtml = "";
        for (let i = 0; i <= displayD; i++) {
          if (i === displayD && u < totalUnitsNeeded - 1) continue;

          let valWhole = u;
          let valRem = i;
          if (i === displayD) {
            valWhole = u + 1;
            valRem = 0;
          }

          const leftPct = (i / displayD) * 100;
          let labelContent = "";

          if (valRem === 0) {
            labelContent = `<span style="font-weight:bold; font-size:15px; color:var(--integer-green, #009900);">${valWhole}</span>`;
          } else {
            const fracHtml = `<span class="nl-frac"><span class="nl-num" style="color:var(--primary-red, #ff3333);">${valRem}</span><span class="nl-line-frac"></span><span class="nl-den" style="color:var(--primary-blue, #3333ff);">${displayD}</span></span>`;
            if (valWhole === 0) {
              labelContent = fracHtml;
            } else {
              labelContent = `<span style="display:inline-flex; align-items:center; gap:2px;"><span style="font-weight:bold; font-size:15px; color:var(--integer-green, #009900);">${valWhole}</span>${fracHtml}</span>`;
            }
          }

          labelsHtml += `<div class="nl-tick-wrapper" style="position:absolute; left:${leftPct}%; top:0;">
              <div class="nl-tick"></div>
              <div class="nl-label">${labelContent}</div>
          </div>`;
        }

        labelsHtml = `<div class="nl-line" style="position:absolute; top:5px; left:0; width:100%;"></div>` + labelsHtml;
        nlUnit.innerHTML = labelsHtml;
        nlWrap.appendChild(nlUnit);
      }
      container.appendChild(nlWrap);
    }

    function renderText(w: number, n: number, d: number) {
      const div = $e("explanationText")!;
      const totalNum = w * d + n;
      const actualW = Math.floor(totalNum / d);
      const actualN = totalNum % d;

      let type = "分數";
      if (w > 0 && n > 0) {
        type = "帶分數";
      } else if (n === 0) {
        type = "整數";
      } else if (w === 0 && n > 0) {
        type = n < d ? "真分數" : "假分數";
      }

      let convertHtml = "";
      const fFrac = (nu: number, de: number) =>
        `<span class="nl-frac" style="font-size:1.1rem;"><span class="nl-num" style="color:var(--primary-red, #ff3333);">${nu}</span><span class="nl-line-frac"></span><span class="nl-den" style="color:var(--primary-blue, #3333ff);">${de}</span></span>`;
      const fMix = (wh: number, nu: number, de: number) =>
        `<span style="display:inline-flex; align-items:center; gap:4px;"><span style="font-weight:bold; font-size:1.1em; color:var(--integer-green, #009900);">${wh}</span>${fFrac(nu, de)}</span>`;

      if (totalNum > 0 && !(w === 0 && n === totalNum)) {
        convertHtml += `<div style="display:flex; align-items:center; margin-bottom:8px;">轉換為分數：<div style="margin-left:10px;">${fFrac(totalNum, d)}</div></div>`;
      }
      if (actualW > 0 && actualN > 0 && !(w === actualW && n === actualN)) {
        convertHtml += `<div style="display:flex; align-items:center; margin-bottom:8px;">轉換為帶分數：<div style="margin-left:10px;">${fMix(actualW, actualN, d)}</div></div>`;
      }
      if (actualN === 0 && !(w === actualW && n === 0)) {
        convertHtml += `<div style="margin-bottom:8px;">轉換為整數：<strong style="color:var(--integer-green, #009900); margin-left:10px; font-size:1.1em;">${actualW}</strong></div>`;
      }

      let currentValHtml = "";
      if (w > 0 && n > 0) {
        currentValHtml = fMix(w, n, d);
      } else if (n > 0) {
        currentValHtml = fFrac(n, d);
      } else {
        currentValHtml = `<strong style="color:var(--integer-green, #009900); font-size:1.1em;">${w}</strong>`;
      }

      div.innerHTML = `
        <div class="info-title">數值轉換與解析</div>
        <div style="margin-top: 10px; margin-bottom: 15px; font-size: 1.05em;">
            <div style="display:flex; align-items:center; min-height:30px; margin-bottom: 8px;">${currentValHtml}</div>
            <div>類型：<strong>${type}</strong></div>
        </div>
        <div style="margin-bottom:15px;">${convertHtml}</div>
      `;
    }

    // ---------- bootstrap ----------
    const api: FA66Api = { setMode, updateUI };
    window.__FA66 = api;

    root.innerHTML = BODY_HTML;

    const inputArea = $e("inputArea")!;
    const onCtxMenu = (e: MouseEvent) => {
      e.preventDefault();
      showMenu(e.pageX, e.pageY);
    };
    const onTouchStart = (e: TouchEvent) => {
      longPressTimer = window.setTimeout(() => {
        showMenu(e.touches[0].pageX, e.touches[0].pageY);
      }, 600);
    };
    const onTouchEnd = () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    };
    inputArea.addEventListener("contextmenu", onCtxMenu);
    inputArea.addEventListener("touchstart", onTouchStart);
    inputArea.addEventListener("touchend", onTouchEnd);

    const onDocClick = () => {
      const m = $e("customContextMenu");
      if (m) m.style.display = "none";
    };
    document.addEventListener("click", onDocClick);

    // 讀取 dashboard 傳入的參數：whole / num / den / mode（whole|fraction|mixed）
    const params = new URLSearchParams(window.location.search);
    const pMode = params.get("mode");
    if (pMode === "whole" || pMode === "fraction" || pMode === "mixed") {
      setMode(pMode);
    }
    const pWhole = params.get("whole");
    if (pWhole !== null && pWhole !== "") $i("inputWhole")!.value = pWhole;
    const pNum = params.get("num");
    if (pNum !== null && pNum !== "") $i("inputNum")!.value = pNum;
    const pDen = params.get("den");
    if (pDen !== null && pDen !== "") $i("inputDen")!.value = pDen;

    updateUI();

    return () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      inputArea.removeEventListener("contextmenu", onCtxMenu);
      inputArea.removeEventListener("touchstart", onTouchStart);
      inputArea.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("click", onDocClick);
      if (window.__FA66 === api) delete window.__FA66;
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`fa66-root${embedded ? " embedded" : ""}`} ref={rootRef} />
    </>
  );
}
