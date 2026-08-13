"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 整數的部份 (Integer factor arrangements).
 *
 * Ported from public/math/FractionApp-Integer.html (nav.css + FractionApp65.css +
 * FractionApp65.js). The tool lets you enter an integer and see its factor
 * pairs laid out as rows × columns of circles, either one arrangement at a time
 * (探索 / mode 1) or all arrangements at once (完整 / mode 2).
 *
 * Ported into a single mount effect that scopes CSS under `.fa65-root`, injects
 * the markup, exposes inline-handler functions on `window.__FA65`, reads the
 * `num` / `mode` query params (sent by the dashboard), and cleans up on unmount.
 *
 * `--circle-size` / `--gap-size` are kept on document.documentElement because
 * `.circle` sizing reads them via CSS var cascade and setDynamicSize writes them.
 */

const STYLES = `
.fa65-root{
  --nav-gray:#95a5a6; --nav-primary:#3498db;
  font-family:'PingFang HK','Microsoft JhengHei','Noto Sans TC',sans-serif;
  margin:0; padding:20px; background-color:#f4f7f6; min-height:100vh; display:flex; flex-direction:column; align-items:center;
  /* 視窗/iframe 比工具小時可上下捲動，避免內容被裁切看不到 */
  overflow:auto; -webkit-overflow-scrolling:touch;
}
.fa65-root *{ box-sizing:border-box; }
.fa65-root .container{ background:#fff; padding:20px 30px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.1); max-width:1000px; width:100%; box-sizing:border-box; }

/* nav */
.fa65-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fa65-root .header-left{ display:flex; align-items:center; gap:15px; }
.fa65-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fa65-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fa65-root .lang-btn{ padding:6px 16px; border:2px solid var(--nav-gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--nav-gray); outline:none; transition:0.15s; transform:translateY(0); }
.fa65-root .lang-btn:active{ box-shadow:0 0 0 var(--nav-gray); transform:translateY(3px); }
.fa65-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }

/* input section */
.fa65-root .input-section{ margin-top:20px; display:flex; align-items:flex-start; gap:40px; background:#fafafa; padding:30px; border-radius:15px; border:1px solid #eee; min-height:150px; }
.fa65-root .math-box{ width:80px; height:80px; font-size:32px; text-align:center; border:3px solid #3498db; border-radius:10px; color:#2c3e50; outline:none; transition:border-color 0.3s; }
.fa65-root .math-box:focus{ border-color:#e67e22; background-color:#fdfaf0; }
.fa65-root .math-box.small{ width:60px; height:60px; font-size:24px; border-color:#95a5a6; }
.fa65-root .math-box.small:focus{ border-color:#e67e22; }
.fa65-root .symbol{ font-size:28px; font-weight:bold; color:#7f8c8d; margin:0 5px; }
.fa65-root .symbol-equals{ font-size:28px; font-weight:bold; color:#34495e; margin-right:10px; }
.fa65-root #formula-container{ display:flex; flex-direction:column; gap:15px; margin-top:30px; }
.fa65-root .formula-row{ display:flex; align-items:center; padding:10px 15px; border-radius:10px; background-color:#f9f9f9; cursor:pointer;
  transition:background 0.2s, transform 0.2s, border-color 0.2s, box-shadow 0.2s; border:2px solid transparent; }
.fa65-root .formula-row:hover{ background-color:#ecf0f1; }
.fa65-root .formula-row.active{ border-color:#2ecc71 !important; background-color:#eafaf1 !important; }
.fa65-root .formula-row.error{ border-color:#e74c3c !important; background-color:#fdedec !important; }
.fa65-root .formula-row.viewing{ box-shadow:0 0 0 3px #3498db, 0 8px 15px rgba(52,152,219,0.3) !important; transform:scale(1.02); z-index:5; }
.fa65-root .swap-btn, .fa65-root .next-btn{ margin-left:10px; width:40px; height:40px; font-size:20px; color:#fff; border:none; border-radius:5px; cursor:pointer; transition:background 0.3s; display:flex; align-items:center; justify-content:center; }
.fa65-root .swap-btn{ background-color:#34495e; }
.fa65-root .swap-btn:hover{ background-color:#2c3e50; }
.fa65-root .next-btn{ background-color:#27ae60; }
.fa65-root .next-btn:hover{ background-color:#2ecc71; }
.fa65-root .status-indicator{ margin-left:15px; font-size:16px; font-weight:bold; min-width:60px; display:inline-block; }
.fa65-root .status-success{ color:#2ecc71; font-size:20px; }
.fa65-root .status-error{ color:#c0392b; }

.fa65-root #circle-container{ margin-top:50px; width:90%; display:flex; flex-wrap:wrap; gap:var(--gap-size); justify-content:center; transition:all 0.5s ease-in-out; padding-bottom:50px; }
.fa65-root .circle{ width:var(--circle-size); height:var(--circle-size); background-color:#ffcc00; border-radius:50%;
  border:max(1px, calc(var(--circle-size) * 0.05)) solid #f39c12; box-shadow:0 max(1px, calc(var(--circle-size) * 0.1)) 0 #d35400; box-sizing:border-box; transition:all 0.4s ease; }
.fa65-root .grid-layout{ display:grid !important; }
.fa65-root .hint{ color:#7f8c8d; font-size:16px; font-weight:bold; }

@keyframes fa65Shake { 0%{ transform:translateX(0);} 25%{ transform:translateX(-5px);} 50%{ transform:translateX(5px);} 75%{ transform:translateX(-5px);} 100%{ transform:translateX(0);} }

@media (max-width:768px){
  .fa65-root .header{ flex-direction:column; align-items:stretch; text-align:center; }
  .fa65-root .header-left{ justify-content:center; }
  .fa65-root .header-right{ justify-content:center; width:100%; }
  .fa65-root .title-badge{ font-size:1.1rem; }
  .fa65-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
  .fa65-root .input-section{ gap:20px; padding:20px; flex-wrap:wrap; }
}

/* embedded (inside iframe) — 去除底層灰底並自適應父頁面，比照相等分數 */
.fa65-root.embedded{ background:transparent; padding:15px; }
.fa65-root.embedded .container{ box-shadow:none; border-radius:0; padding:1rem; }
`;

const BODY_HTML = `
<div class="container">
  <div class="header">
    <div class="header-left">
      <div class="title-badge">整數的部分</div>
    </div>
    <div class="header-right">
      <button id="toggleModeBtn" class="lang-btn btn-active-mode" onclick="window.__FA65.toggleMode()">顯示全部</button>
    </div>
  </div>

  <div class="input-section">
    <div style="display: flex; flex-direction: column; align-items: center;">
      <div class="hint" style="margin-bottom: 10px;">輸入一個整數</div>
      <input type="number" id="mainNum" class="math-box" min="1" max="999" onkeypress="return event.charCode >= 48 && event.charCode <= 57">
    </div>

    <div style="display: flex; flex-direction: column; align-items: center;">
      <div id="formula-container">
        <div class="formula-row" id="single-row" onclick="window.__FA65.handleArrange(this)">
          <span class="symbol-equals">=</span>
          <input type="number" class="math-box small factor1" min="1"
              onkeypress="return event.charCode >= 48 && event.charCode <= 57"
              onchange="window.__FA65.handleArrange(this.parentElement)"
              onclick="event.stopPropagation()">
          <span class="symbol">×</span>
          <input type="number" class="math-box small factor2" min="1"
              onkeypress="return event.charCode >= 48 && event.charCode <= 57"
              onchange="window.__FA65.handleArrange(this.parentElement)"
              onclick="event.stopPropagation()">
          <button class="swap-btn" onclick="window.__FA65.swapValues(event, this)" title="交換數字">⇄</button>
          <button class="next-btn" onclick="window.__FA65.nextFactorPair(event)" title="下一個因數組合">⏭</button>
          <span class="status-indicator"></span>
        </div>
      </div>
    </div>
  </div>

  <div id="circle-container"></div>
</div>
`;

type FA65Api = {
  toggleMode: () => void;
  handleArrange: (row: HTMLElement) => void;
  swapValues: (event: Event, btnElement: HTMLElement) => void;
  nextFactorPair: (event: Event) => void;
};

declare global {
  interface Window {
    __FA65?: FA65Api;
  }
}

export default function FractionIntegerPage() {
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

    const de = document.documentElement;
    const $e = (id: string) => document.getElementById(id) as HTMLElement | null;
    const $i = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    // ---------- state (mirrors FractionApp65.js module vars) ----------
    let targetTotal = 0;
    let currentFactorPairs: number[][] = [];
    let currentFactorIndex = 0;
    let currentMode = 1; // 1: 探索模式, 2: 完整排列模式

    function getFactorPairs(num: number) {
      const pairs: number[][] = [];
      for (let i = 1; i <= num; i++) {
        if (num % i === 0) pairs.push([i, num / i]);
      }
      return pairs;
    }

    function applyModeButton() {
      const btn = $e("toggleModeBtn");
      if (!btn) return;
      if (currentMode === 1) {
        btn.innerText = "顯示全部";
        btn.style.borderColor = "";
        btn.style.color = "";
        btn.style.boxShadow = "";
      } else {
        btn.innerText = "逐一顯示";
        btn.style.borderColor = "#e67e22";
        btn.style.color = "#e67e22";
        btn.style.boxShadow = "0 3px 0 #e67e22";
      }
    }

    function toggleMode() {
      currentMode = currentMode === 1 ? 2 : 1;
      applyModeButton();
      updateView();
    }

    function updateView() {
      const mainNumInput = $i("mainNum")!;
      const singleRow = $e("single-row")!;
      const circleContainer = $e("circle-container")!;

      let val = parseInt(mainNumInput.value);
      if (val > 999) {
        val = 999;
        mainNumInput.value = "999";
      }

      const f1Input = singleRow.querySelector(".factor1") as HTMLInputElement;
      const f2Input = singleRow.querySelector(".factor2") as HTMLInputElement;
      const indicator = singleRow.querySelector(".status-indicator") as HTMLElement;

      if (val > 0) {
        targetTotal = val;
        currentFactorPairs = getFactorPairs(val);

        if (currentMode === 1) {
          $e("formula-container")!.style.display = "flex";
          resetToScatter(val);
          f1Input.value = "1";
          f2Input.value = String(val);
          handleArrange(singleRow);
          currentFactorIndex = currentFactorPairs.length > 1 ? 1 : 0;
        } else {
          $e("formula-container")!.style.display = "none";
          renderAllArrangements();
        }
      } else {
        targetTotal = 0;
        currentFactorPairs = [];
        currentFactorIndex = 0;
        f1Input.value = "";
        f2Input.value = "";
        singleRow.classList.remove("active", "error", "viewing");
        indicator.innerHTML = "";
        circleContainer.innerHTML = "";
      }
    }

    function renderAllArrangements() {
      const circleContainer = $e("circle-container")!;
      circleContainer.innerHTML = "";
      circleContainer.className = "";
      circleContainer.style.display = "flex";
      circleContainer.style.flexWrap = "wrap";
      circleContainer.style.gap = "25px";
      circleContainer.style.justifyContent = "center";
      circleContainer.style.gridTemplateColumns = "";
      circleContainer.style.gridTemplateRows = "";

      currentFactorPairs.forEach((pair) => {
        const rows = pair[0];
        const cols = pair[1];

        const card = document.createElement("div");
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.alignItems = "center";
        card.style.background = "white";
        card.style.padding = "15px";
        card.style.borderRadius = "12px";
        card.style.boxShadow = "0 6px 12px rgba(0,0,0,0.06)";
        card.style.transition = "transform 0.2s";
        card.onmouseenter = () => (card.style.transform = "scale(1.03)");
        card.onmouseleave = () => (card.style.transform = "none");

        const label = document.createElement("div");
        label.innerText = `${rows} × ${cols}`;
        label.style.fontSize = "18px";
        label.style.fontWeight = "bold";
        label.style.marginBottom = "10px";
        label.style.color = "#2c3e50";
        card.appendChild(label);

        const miniGrid = document.createElement("div");
        miniGrid.style.display = "grid";

        let miniSize = 24;
        if (cols > 10 || rows > 10) miniSize = 16;
        if (cols > 25 || rows > 25) miniSize = 10;
        if (cols > 50 || rows > 50) miniSize = 6;
        if (cols > 100 || rows > 100) miniSize = 3;

        const gap = Math.max(1, miniSize * 0.2);
        miniGrid.style.gridTemplateColumns = `repeat(${cols}, ${miniSize}px)`;
        miniGrid.style.gridTemplateRows = `repeat(${rows}, ${miniSize}px)`;
        miniGrid.style.gap = `${gap}px`;

        for (let i = 0; i < targetTotal; i++) {
          const circle = document.createElement("div");
          circle.className = "circle";
          circle.style.width = `${miniSize}px`;
          circle.style.height = `${miniSize}px`;
          circle.style.border = `${Math.max(1, miniSize * 0.05)}px solid #f39c12`;
          circle.style.boxShadow = `0 ${Math.max(1, miniSize * 0.1)}px 0 #d35400`;
          circle.style.transform = "none";
          miniGrid.appendChild(circle);
        }

        card.appendChild(miniGrid);
        circleContainer.appendChild(card);
      });
    }

    function setDynamicSize(rows: number, cols: number) {
      const circleContainer = $e("circle-container")!;
      const containerW = circleContainer.clientWidth || Math.min(window.innerWidth * 0.85, 940);
      const containerH = window.innerHeight * 0.55;
      const maxW = containerW / (1.25 * cols - 0.25);
      const maxH = containerH / (1.25 * rows - 0.25);
      const size = Math.max(5, Math.min(45, Math.min(maxW, maxH)));
      const gap = size * 0.25;
      de.style.setProperty("--circle-size", `${size}px`);
      de.style.setProperty("--gap-size", `${gap}px`);
    }

    function nextFactorPair(event: Event) {
      event.stopPropagation();
      if (currentFactorPairs.length === 0 || targetTotal === 0) return;
      const singleRow = $e("single-row")!;
      const f1Input = singleRow.querySelector(".factor1") as HTMLInputElement;
      const f2Input = singleRow.querySelector(".factor2") as HTMLInputElement;
      const pair = currentFactorPairs[currentFactorIndex];
      f1Input.value = String(pair[0]);
      f2Input.value = String(pair[1]);
      handleArrange(singleRow);
      currentFactorIndex = (currentFactorIndex + 1) % currentFactorPairs.length;
    }

    function swapValues(event: Event, btnElement: HTMLElement) {
      event.stopPropagation();
      const row = btnElement.closest(".formula-row") as HTMLElement;
      const input1 = row.querySelector(".factor1") as HTMLInputElement;
      const input2 = row.querySelector(".factor2") as HTMLInputElement;
      const temp = input1.value;
      input1.value = input2.value;
      input2.value = temp;
      if (input1.value !== "" && input2.value !== "") {
        handleArrange(row);
      }
    }

    function resetToScatter(count: number) {
      const circleContainer = $e("circle-container")!;
      circleContainer.innerHTML = "";
      circleContainer.className = "";
      circleContainer.style.display = "flex";
      circleContainer.style.flexWrap = "wrap";
      circleContainer.style.gap = "var(--gap-size)";
      circleContainer.style.justifyContent = "center";
      circleContainer.style.gridTemplateColumns = "";
      circleContainer.style.gridTemplateRows = "";

      const colsEstimate = Math.ceil(Math.sqrt(count * 1.5));
      const rowsEstimate = Math.ceil(count / colsEstimate);
      setDynamicSize(rowsEstimate, colsEstimate);

      for (let i = 0; i < count; i++) {
        const div = document.createElement("div");
        div.className = "circle";
        div.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
        circleContainer.appendChild(div);
      }
    }

    function shakeRow(element: HTMLElement) {
      element.style.animation = "none";
      void element.offsetWidth;
      element.style.animation = "fa65Shake 0.3s";
    }

    function handleArrange(row: HTMLElement) {
      if (targetTotal === 0) return;
      const f1Input = row.querySelector(".factor1") as HTMLInputElement;
      const f2Input = row.querySelector(".factor2") as HTMLInputElement;
      const indicator = row.querySelector(".status-indicator") as HTMLElement;
      const f1 = parseInt(f1Input.value);
      const f2 = parseInt(f2Input.value);

      if (isNaN(f1) || isNaN(f2)) {
        row.classList.remove("active", "error", "viewing");
        indicator.innerHTML = "";
        return;
      }

      if (f1 * f2 === targetTotal) {
        row.classList.remove("error");
        row.classList.add("active", "viewing");
        indicator.innerHTML = '<span class="status-success">✅</span>';
        applyGridLayout(f1, f2);
      } else {
        row.classList.remove("active", "viewing");
        row.classList.add("error");
        indicator.innerHTML = '<span class="status-error">錯誤</span>';
        shakeRow(row);
        resetToScatter(targetTotal);
      }
    }

    function applyGridLayout(rows: number, cols: number) {
      const circleContainer = $e("circle-container")!;
      setDynamicSize(rows, cols);
      circleContainer.className = "grid-layout";
      circleContainer.style.display = "grid";
      circleContainer.style.gridTemplateColumns = `repeat(${cols}, var(--circle-size))`;
      circleContainer.style.gridTemplateRows = `repeat(${rows}, var(--circle-size))`;
      circleContainer.style.gap = "var(--gap-size)";
      circleContainer.style.justifyContent = "center";
      circleContainer.querySelectorAll(".circle").forEach((c) => ((c as HTMLElement).style.transform = "none"));
    }

    // ---------- bootstrap ----------
    const api: FA65Api = { toggleMode, handleArrange, swapValues, nextFactorPair };
    window.__FA65 = api;

    de.style.setProperty("--circle-size", "45px");
    de.style.setProperty("--gap-size", "10px");
    root.innerHTML = BODY_HTML;

    const mainNumInput = $i("mainNum")!;
    const onInput = () => updateView();
    mainNumInput.addEventListener("input", onInput);

    // 讀取 dashboard 傳入的參數：num（整數）、mode（"2" = 完整排列模式）
    const params = new URLSearchParams(window.location.search);
    const pMode = params.get("mode");
    const pNum = params.get("num");
    if (pMode === "2") currentMode = 2;
    applyModeButton();
    if (pNum !== null && pNum !== "") {
      let n = parseInt(pNum, 10);
      if (Number.isFinite(n)) {
        if (n < 1) n = 1;
        if (n > 999) n = 999;
        mainNumInput.value = String(n);
      }
    }
    updateView();

    return () => {
      mainNumInput.removeEventListener("input", onInput);
      if (window.__FA65 === api) delete window.__FA65;
      de.style.removeProperty("--circle-size");
      de.style.removeProperty("--gap-size");
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`fa65-root${embedded ? " embedded" : ""}`} ref={rootRef} />
    </>
  );
}
