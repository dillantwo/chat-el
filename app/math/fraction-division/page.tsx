"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 分數除法 (Division of fractions).
 *
 * Ported from public/math/FractionApp-Division.html (arith-common.css + nav.css +
 * FractionApp38.css + bar-component.css + FractionApp38.js).
 *
 * Same porting strategy as the other arithmetic tools: the app is imperative
 * (two bars + expand/simplify to a common denominator, then the divisor bar
 * becomes a dashed "container mold" and red chunks are dragged/clicked into it,
 * filling result molds with a flying animation). The original script is ported
 * almost verbatim into one mount effect that scopes CSS under `.fa38-root`,
 * injects the markup, exposes the inline-handler functions on `window.__FA38`,
 * and tears everything down on unmount.
 *
 * `--anim-time` / `--max-wholes` stay on document.documentElement because the
 * script reads `--max-wholes` back via getComputedStyle(documentElement).
 */

const STYLES = `
.fa38-root{
  --yellow:#f1c40f; --red:#e74c3c; --orange:#e67e22; --dark:#2c3e50; --gray:#ecf0f1;
  --blue:#3498db; --success:#27ae60;
  --nav-gray:#95a5a6; --nav-primary:#3498db;
  --bar-border-color:#2c3e50; --bar-border-width:2px; --bar-border-radius:6px; --bar-bg:#f5f5f5;
  --bar-fill-opacity:0.8;
  --grid-thick-width:3px; --grid-thick-color:#2c3e50; --grid-thin-width:1px; --grid-thin-color:rgba(44,62,80,0.5);
  font-family:'PingFang HK','Microsoft JhengHei','Noto Sans TC',sans-serif;
  background-color:#f4f7f6; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:20px;
  /* 視窗/iframe 比工具小時可上下捲動，避免內容被裁切看不到 */
  overflow:auto; -webkit-overflow-scrolling:touch;
}
.fa38-root *{ margin:0; padding:0; box-sizing:border-box; }
.fa38-root .container{ background:#fff; padding:20px 30px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.1);
  max-width:1000px; width:100%; box-sizing:border-box; overflow-x:hidden; }

/* nav */
.fa38-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fa38-root .header-left{ display:flex; align-items:center; gap:15px; }
.fa38-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fa38-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fa38-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fa38-root .checkbox-label{ display:flex; align-items:center; gap:6px; font-size:0.95rem; color:#333; cursor:pointer; user-select:none; font-weight:bold; }
.fa38-root .checkbox-label input[type=checkbox]{ cursor:pointer; width:16px; height:16px; accent-color:var(--nav-primary); }
.fa38-root .divider{ width:1px; height:18px; background:#ccc; }
.fa38-root .speed-ctrl{ display:flex; align-items:center; gap:8px; font-size:0.95rem; color:#333; font-weight:bold; }
.fa38-root .speed-ctrl input[type=range]{ width:80px; cursor:pointer; accent-color:var(--nav-primary); }
.fa38-root .lang-btn{ padding:6px 16px; border:2px solid var(--nav-gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--nav-gray); outline:none; transition:0.15s; transform:translateY(0); }
.fa38-root .lang-btn:active{ box-shadow:0 0 0 var(--nav-gray); transform:translateY(3px); }
.fa38-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }
.fa38-root .lang-btn.btn-random{ border-color:#9b59b6; color:#9b59b6; box-shadow:0 3px 0 #9b59b6; }
.fa38-root .lang-btn.btn-random:hover{ background:#9b59b6; color:#fff; }
.fa38-root .lang-btn.btn-random:active{ box-shadow:0 0 0 #9b59b6; transform:translateY(3px); background:#8e44ad; color:#fff; }

/* problem / formula */
.fa38-root .word-problem{ font-size:1.3rem; font-weight:bold; color:var(--dark); background:#e8f4f8; padding:15px 25px;
  border-radius:12px; border-left:6px solid var(--blue); margin-bottom:10px; width:100%; text-align:center;
  box-sizing:border-box; display:none; line-height:1.8; box-shadow:0 4px 6px rgba(0,0,0,0.05); }
.fa38-root .word-problem b{ color:var(--red); font-size:1.5rem; margin:0 5px; padding:2px 6px; background:#fff;
  border-radius:6px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1); display:inline-flex; align-items:center; }
.fa38-root .answer-zone{ padding:5px 0; text-align:center; color:var(--dark); display:flex; flex-direction:column; align-items:center; }
.fa38-root .formula{ display:flex; align-items:center; justify-content:center; gap:15px; font-size:2rem; flex-wrap:wrap; margin-bottom:0; }
.fa38-root .mixed-frac{ display:flex; align-items:center; gap:5px; cursor:pointer; padding:5px; border-radius:10px; transition:0.2s; }
.fa38-root .mixed-frac:hover{ background:#f0f0f0; }
.fa38-root .whole-input{ width:45px; height:50px; font-size:1.8rem; text-align:center; border-radius:8px; border:2px solid #ccc;
  outline:none; transition:0.3s; font-weight:bold; color:var(--dark); background:#fff; display:none; }
.fa38-root .whole-input:focus{ border-color:var(--blue); box-shadow:0 0 8px rgba(52,152,219,0.4); }
.fa38-root .frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; }
.fa38-root .frac-input{ width:55px; height:45px; font-size:1.5rem; text-align:center; border-radius:8px; font-weight:bold;
  color:var(--dark); transition:0.3s; outline:none; border:2px solid #ccc; background:#fff; }
.fa38-root .frac-text{ font-size:2rem; font-weight:bold; text-align:center; padding:0 10px; color:var(--dark); }
.fa38-root .frac-line{ width:100%; height:3px; background:var(--dark); margin:5px 0; }
.fa38-root .reset-op{ border-radius:8px; padding:0 6px; transition:background 0.15s, transform 0.15s; }
.fa38-root .reset-op:hover{ background:#e8f4f8; transform:scale(1.1); }
.fa38-root .reset-op:active{ transform:scale(0.95); }

/* animation zone */
.fa38-root .animation-zone{ width:100%; padding-top:5px; display:flex; flex-direction:column; align-items:center; position:relative; }
.fa38-root .instruction-text{ font-size:1.3rem; font-weight:bold; color:var(--dark); text-align:center; margin-bottom:10px;
  background:#fff4e6; padding:12px 25px; border-radius:12px; border-left:6px solid var(--orange); width:100%; max-width:850px;
  box-sizing:border-box; transition:opacity 0.5s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa38-root .inline-frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; font-weight:bold;
  line-height:1; margin:0 5px; position:relative; top:-0.1em; }
.fa38-root .inline-frac span{ font-size:1.1em; padding:1px 4px; }
.fa38-root .inline-frac .line{ height:2px; background-color:currentColor; width:100%; margin:2px 0; }
.fa38-root #anim-area{ width:100%; min-height:200px; position:relative; overflow:visible; margin-top:5px; display:flex; flex-direction:column; gap:20px; }

@keyframes fa38FadeInSlow { 0%{ opacity:0; transform:translateY(10px); } 100%{ opacity:1; transform:translateY(0); } }
.fa38-root .fade-in-slow{ animation:fa38FadeInSlow 1s ease-out forwards; }

.fa38-root .tool-btn{ background:#3498db; color:#fff; border:2px solid transparent; padding:8px 12px; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:1rem; transition:transform 0.1s, background 0.2s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa38-root .tool-btn:hover{ background:#2980b9; transform:scale(1.05); }
.fa38-root .tool-btn:active{ transform:scale(0.95); background:#1f618d; }

.fa38-root .bars-column{ width:70%; display:flex; flex-direction:column; }
.fa38-root .bar-wrap-container{ width:100%; display:flex; flex-wrap:wrap; gap:15px; justify-content:flex-start; align-items:center;
  background:transparent; border:none; min-height:60px; transition:0.5s ease; }
.fa38-root .bar-unit{ position:relative; height:50px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes));
  min-width:120px; flex:none; border:var(--bar-border-width) solid var(--bar-border-color); box-sizing:border-box;
  background:var(--bar-bg); border-radius:var(--bar-border-radius); overflow:hidden; }
.fa38-root .bar-fill{ height:100%; transition:width var(--anim-time) ease; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); }
.fa38-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; overflow:hidden; }
.fa38-root .abs-thick-line{ position:absolute; top:0; width:var(--grid-thick-width); height:100%; background:var(--grid-thick-color); transform:translateX(-50%); z-index:4; }
.fa38-root .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa38-root .bar-wrap-container.continuous{ gap:0 !important; }
.fa38-root .bar-wrap-container.continuous .bar-unit{ width:calc(100% / var(--max-wholes)) !important; border-right:none; border-radius:0; }
.fa38-root .bar-wrap-container.continuous .bar-unit:last-child{ border-right:var(--bar-border-width) solid var(--bar-border-color); border-top-right-radius:4px; border-bottom-right-radius:4px; }
.fa38-root .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:4px; border-bottom-left-radius:4px; }
.fa38-root .drag-block{ transition:transform 0.1s, opacity 0.2s, box-shadow 0.2s; touch-action:manipulation; }
.fa38-root .drag-block:active{ transform:scale(0.95); }
.fa38-root .drag-block:hover{ box-shadow:0 0 10px rgba(231,76,60,0.6); z-index:15; }
.fa38-root .nl-wrap-container{ width:100%; display:flex; flex-wrap:wrap; justify-content:flex-start; align-items:flex-start;
  min-height:45px; margin-top:2px; border:none; position:relative; gap:15px; }
.fa38-root .nl-wrap-container.continuous{ gap:0 !important; }
.fa38-root .nl-unit{ position:relative; height:45px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes)); min-width:120px; flex:none; box-sizing:border-box; }
.fa38-root .nl-wrap-container.continuous .nl-unit{ width:calc(100% / var(--max-wholes)) !important; }

.fa38-root #bottom-answer-zone{ width:100%; max-width:650px; background:#fff8e1; padding:20px; border-radius:15px;
  border:2px dashed var(--red); margin-top:15px; display:none; flex-direction:column; align-items:center; gap:10px;
  box-shadow:0 4px 10px rgba(0,0,0,0.05); transition:opacity 0.5s; z-index:50; position:relative; }
.fa38-root .feedback-msg{ font-size:1.2rem; font-weight:bold; min-height:28px; margin-top:5px; opacity:0; transition:opacity 0.3s, color 0.3s; text-align:center; }

/* Disabled: layout now scales proportionally via .scale-viewport instead of reflowing */
@media (max-width:0px){
  .fa38-root .header{ flex-direction:column; align-items:stretch; text-align:center; }
  .fa38-root .header-left{ justify-content:center; }
  .fa38-root .header-right{ justify-content:center; width:100%; }
  .fa38-root .controls-pill{ width:100%; justify-content:center; flex-wrap:wrap; }
  .fa38-root .title-badge{ font-size:1.1rem; }
  .fa38-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
  .fa38-root .container{ padding:15px; }
  .fa38-root .formula{ font-size:1.5rem; }
  .fa38-root .whole-input{ width:35px; height:40px; font-size:1.4rem; }
  .fa38-root .frac-input{ width:45px; height:35px; font-size:1.2rem; }
  .fa38-root .instruction-text, .fa38-root .word-problem{ font-size:1.1rem; padding:12px 15px; flex-wrap:wrap; }
  .fa38-root #bar1-row, .fa38-root #bar2-row, .fa38-root #bar3-row{ flex-direction:column; height:auto !important; gap:10px; padding-bottom:10px; }
  .fa38-root .bars-column{ width:100% !important; }
  .fa38-root .bar-wrap-container, .fa38-root .nl-wrap-container{ justify-content:flex-start; }
  .fa38-root .bar-unit, .fa38-root .nl-unit{ min-width:80px; }
}

/* embedded (inside iframe) — 去除底層灰底並自適應父頁面，比照相等分數 */
.fa38-root.embedded{ background:transparent; padding:15px; }
.fa38-root.embedded .container{ box-shadow:none; border-radius:0; padding:1rem; }

/* Proportional scaling wrapper: keep the desktop layout intact and shrink the
   whole tool to fit narrow viewports instead of reflowing/stacking, so the
   擴分/約分 buttons never drop below the bars. */
.fa38-root .scale-viewport{ width:100%; display:flex; justify-content:center; align-items:flex-start; }
.fa38-root .scale-viewport > .container{ transform-origin:top center; flex:none; }
`;

const BODY_HTML = `
<div class="scale-viewport">
<div class="container">
  <div class="header">
    <div class="header-left">
      <div class="title-badge">分數相除</div>
    </div>
    <div class="header-right">
      <div class="controls-pill">
        <label class="checkbox-label">
          <input type="checkbox" id="show-whole-cb" onchange="window.__FA38.toggleWholeNumber()"> 顯示帶分數
        </label>
        <span class="divider"></span>
        <label class="checkbox-label">
          <input type="checkbox" id="show-nl-cb" onchange="window.__FA38.toggleNumberLine()" checked> 顯示數線
        </label>
        <span class="divider"></span>
        <div class="speed-ctrl">
          <label for="speed-slider" title="調整擴分/約分的動畫速度">動畫速度: <span id="speed-val" style="color: var(--blue);">1.0</span>x</label>
          <input type="range" id="speed-slider" min="0.25" max="3" step="0.05" value="1.0" oninput="window.__FA38.updateSpeed()">
        </div>
      </div>
      <button class="lang-btn btn-random" onclick="window.__FA38.randomChallenge()">🎲 隨機出題</button>
    </div>
  </div>

  <div id="word-problem" class="word-problem"></div>

  <div class="answer-zone">
    <div class="formula">
      <div class="mixed-frac" id="frac1-group" onclick="window.__FA38.onFrac1Click()" title="點擊重置並顯示被除數圖形">
        <input type="number" class="whole-input" id="w1" placeholder=" " min="0" max="10" oninput="window.__FA38.updateUI()" onchange="window.__FA38.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n1" value="2" min="1" max="100" oninput="window.__FA38.updateUI()" onchange="window.__FA38.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d1" value="3" min="1" max="100" oninput="window.__FA38.updateUI()" onchange="window.__FA38.updateUI()">
        </div>
      </div>
      <span class="reset-op" onclick="window.__FA38.updateUI()" title="點擊重置動畫" style="cursor:pointer;">÷</span>
      <div class="mixed-frac" id="frac2-group" onclick="window.__FA38.onFrac2Click()" title="點擊重置並顯示除數圖形">
        <input type="number" class="whole-input" id="w2" placeholder=" " min="0" max="10" oninput="window.__FA38.updateUI()" onchange="window.__FA38.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n2" value="1" min="1" max="100" oninput="window.__FA38.updateUI()" onchange="window.__FA38.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d2" value="2" min="1" max="100" oninput="window.__FA38.updateUI()" onchange="window.__FA38.updateUI()">
        </div>
      </div>
    </div>
  </div>

  <div class="animation-zone" id="anim-zone">
    <div id="drag-instruction" class="instruction-text">💡 點上方的分數，顯示長條圖</div>
    <div id="anim-area"></div>

    <div id="bottom-answer-zone">
      <div id="bot-public-unit" style="display: none; font-size: 1.2rem; color: var(--blue); margin-bottom: 10px; font-weight: bold; background: #e8f4f8; padding: 5px 15px; border-radius: 8px;"></div>
      <div class="formula">
        <div id="bot-frac1"></div>
        <span>÷</span>
        <div id="bot-frac2"></div>
        <span>=</span>
        <div class="mixed-frac" style="cursor: default;">
          <input type="number" class="whole-input" id="ans-w" placeholder=" " min="0" oninput="window.__FA38.autoCheck()">
          <div class="frac">
            <input type="number" class="frac-input" id="ans-num" placeholder="?" min="0" oninput="window.__FA38.autoCheck()">
            <div class="frac-line" style="background:#ccc;"></div>
            <input type="number" class="frac-input" id="ans-den" placeholder="?" min="1" oninput="window.__FA38.autoCheck()">
          </div>
        </div>
      </div>
      <div id="feedback" class="feedback-msg"></div>
    </div>
  </div>
</div>
</div>
`;

type FA38Api = {
  toggleWholeNumber: () => void;
  toggleNumberLine: () => void;
  updateSpeed: () => void;
  randomChallenge: () => void;
  onFrac1Click: () => void;
  onFrac2Click: () => void;
  updateUI: () => void;
  autoCheck: () => void;
  applyTool: (num: number, action: string) => void;
};

declare global {
  interface Window {
    __FA38?: FA38Api;
  }
}

export default function FractionDivisionPage() {
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

  // Proportional scaling: keep the desktop layout intact and shrink the whole
  // tool to fit narrow viewports (so the 擴分/約分 buttons never drop below the
  // bars). Mirrors the .scale-viewport approach used in the standalone HTML.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const DESIGN_WIDTH = 1000; // matches .container's desktop design width
    const fitScale = () => {
      const wrap = root.querySelector(".scale-viewport") as HTMLElement | null;
      const container = root.querySelector(".scale-viewport > .container") as HTMLElement | null;
      if (!wrap || !container) return;
      container.style.width = DESIGN_WIDTH + "px";
      container.style.maxWidth = "none";
      const rootStyle = getComputedStyle(root);
      const padX = parseFloat(rootStyle.paddingLeft) + parseFloat(rootStyle.paddingRight);
      const avail = root.clientWidth - padX;
      const scale = Math.min(1, avail / DESIGN_WIDTH);
      container.style.transform = scale < 1 ? `scale(${scale})` : "none";
      const newH = container.offsetHeight * scale;
      if (Math.abs(parseFloat(wrap.style.height || "0") - newH) > 0.5) {
        wrap.style.height = newH + "px";
      }
    };
    window.addEventListener("resize", fitScale);
    const ro = window.ResizeObserver ? new ResizeObserver(() => fitScale()) : null;
    if (ro) ro.observe(root);
    // The tool markup is injected asynchronously by the main effect; poll briefly
    // so the first fit runs once the container exists.
    const poll = window.setInterval(fitScale, 100);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 3000);
    fitScale();
    return () => {
      window.removeEventListener("resize", fitScale);
      if (ro) ro.disconnect();
      window.clearInterval(poll);
      window.clearTimeout(stopPoll);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let alive = true;
    const de = document.documentElement;

    const $e = (id: string) => document.getElementById(id) as HTMLElement | null;
    const $i = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    // ---------- state (mirrors FractionApp38.js module vars) ----------
    let currentWordProblemTemplate: string | null = null;
    let s1 = 1;
    let s2 = 1;
    let bar1Visible = false;
    let bar2Visible = false;
    let currentSpeed = 1.0;
    let isCommonDenomReady = false;
    // true while a chunk is visiting #divisor-mold in handleDropChunk
    let blueMoldBusy = false;
    // chunks dropped while blueMoldBusy, processed one at a time
    let divisionDropQueue: { chunkId: string; molds: HTMLElement[]; P1: number; P2: number; cd: number }[] = [];
    // guard: each expand schedules checkCommonDenom; only start division once
    let divisionAnimationStarted = false;

    const timers: number[] = [];
    const T = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      timers.push(id);
      return id;
    };
    const maxWholes = () => parseInt(getComputedStyle(de).getPropertyValue("--max-wholes")) || 1;

    const wordProblemTemplates = [
      "有 [FRAC1] 公升果汁，每杯 [FRAC2] 公升，可以倒幾杯？",
      "有 [FRAC1] 公尺緞帶，每段 [FRAC2] 公尺，可以剪幾段？",
      "有 [FRAC1] 公斤飼料，每天吃 [FRAC2] 公斤，可以吃幾天？",
      "有 [FRAC1] 塊披薩，每人 [FRAC2] 塊，可以分給幾人？",
      "有 [FRAC1] 加侖水，每次舀 [FRAC2] 加侖，可以舀幾次？",
    ];

    // ---------- controls ----------
    function toggleWholeNumber() {
      const showWhole = $i("show-whole-cb")!.checked;
      $e("w1")!.style.display = showWhole ? "inline-block" : "none";
      $e("w2")!.style.display = showWhole ? "inline-block" : "none";
      if (!showWhole) {
        $i("w1")!.value = "";
        $i("w2")!.value = "";
        $i("ans-w")!.value = "";
      }
      updateUI();
    }

    function updateSpeed() {
      currentSpeed = parseFloat($i("speed-slider")!.value);
      $e("speed-val")!.innerText = currentSpeed.toFixed(1);
      const duration = 0.6 / currentSpeed;
      de.style.setProperty("--anim-time", duration + "s");
    }

    function toggleNumberLine() {
      if (bar1Visible) renderBar(1, "none");
      if (bar2Visible) renderBar(2, "none");
    }

    function getSafeValues() {
      let w1 = parseInt($i("w1")!.value) || 0;
      let d1 = parseInt($i("d1")!.value) || 1;
      let n1 = parseInt($i("n1")!.value) || 0;
      let w2 = parseInt($i("w2")!.value) || 0;
      let d2 = parseInt($i("d2")!.value) || 1;
      let n2 = parseInt($i("n2")!.value) || 0;

      if (w1 < 0) w1 = 0;
      if (w2 < 0) w2 = 0;
      if (d1 < 1) d1 = 1;
      if (d1 > 100) d1 = 100;
      if (d2 < 1) d2 = 1;
      if (d2 > 100) d2 = 100;
      if (n1 < 0) n1 = 0;
      if (n2 < 0) n2 = 0;
      if (w1 === 0 && n1 === 0) n1 = 1;
      if (w2 === 0 && n2 === 0) n2 = 1;

      return { w1, n1, d1, w2, n2, d2, total_n1: w1 * d1 + n1, total_n2: w2 * d2 + n2 };
    }

    function enforceInputLimits() {
      const safe = getSafeValues();
      $i("d1")!.value = String(safe.d1);
      $i("d2")!.value = String(safe.d2);
    }

    function updateMaxWholes() {
      const vals = getSafeValues();
      const wholes1 = Math.max(1, Math.ceil(vals.total_n1 / vals.d1));
      const wholes2 = Math.max(1, Math.ceil(vals.total_n2 / vals.d2));
      de.style.setProperty("--max-wholes", String(Math.max(wholes1, wholes2)));
    }

    function getFracHtml(n: number, d: number, color = "inherit") {
      return `<div class="inline-frac" style="color: ${color};"><span>${n}</span><div class="line"></div><span>${d}</span></div>`;
    }

    function getDisplayHtml(w: number, n: number, d: number, color: string) {
      if (w > 0) {
        return `<div style="display:inline-flex; align-items:center;">
                    <span style="color:${color}; font-size:1.8rem; font-weight:bold; margin-right:4px; line-height:1;">${w}</span>
                    ${getFracHtml(n, d, color)}
                </div>`;
      }
      return getFracHtml(n, d, color);
    }

    function gcd(a: number, b: number): number {
      return b ? gcd(b, a % b) : a;
    }
    function lcm(a: number, b: number) {
      return (a * b) / gcd(a, b);
    }

    function onFrac1Click() {
      const row = $e("bar1-row")!;
      row.style.display = "flex";
      s1 = 1;
      renderBar(1, "none");
      row.classList.remove("fade-in-slow");
      void row.offsetWidth;
      row.classList.add("fade-in-slow");
      bar1Visible = true;
      checkCommonDenom();
    }

    function onFrac2Click() {
      const row = $e("bar2-row")!;
      row.style.display = "flex";
      s2 = 1;
      renderBar(2, "none");
      row.classList.remove("fade-in-slow");
      void row.offsetWidth;
      row.classList.add("fade-in-slow");
      bar2Visible = true;
      checkCommonDenom();
    }

    function applyTool(num: number, action: string) {
      let changed = false;
      const old_s = num === 1 ? s1 : s2;
      if (num === 1) {
        if (action === "expand") {
          s1++;
          changed = true;
        } else if (action === "simplify" && s1 > 1) {
          s1--;
          changed = true;
        }
      } else {
        if (action === "expand") {
          s2++;
          changed = true;
        } else if (action === "simplify" && s2 > 1) {
          s2--;
          changed = true;
        }
      }
      if (changed) {
        renderBar(num, action, old_s);
        T(checkCommonDenom, 1250 / currentSpeed);
      }
    }

    function applyGridAnimation(
      gridContainer: HTMLElement,
      d: number,
      s: number,
      old_s: number,
      action: string,
    ) {
      const animTimeMs = (0.6 / currentSpeed) * 1000;
      const halfAnimMs = animTimeMs / 2;
      gridContainer.innerHTML = "";
      let html = '<div class="grid-overlay">';

      for (let k = 1; k < d; k++) html += `<div class="abs-thick-line" style="left: ${(k / d) * 100}%;"></div>`;

      if (action === "simplify") {
        for (let k = 0; k < d; k++) {
          const remove_j = Math.floor(old_s / 2);
          for (let j = 1; j < old_s; j++) {
            const oldLeftPct = ((k * old_s + j) / (d * old_s)) * 100;
            const lineId = `line_${Math.random().toString(36).substr(2, 5)}`;
            if (j === remove_j) {
              html += `<div id="${lineId}" class="abs-thin-line removed-line" style="left: ${oldLeftPct}%; top: 0; height: 100%; transition: height ${halfAnimMs}ms ease-in;"></div>`;
            } else {
              const new_j = j < remove_j ? j : j - 1;
              const newLeftPct = ((k * s + new_j) / (d * s)) * 100;
              html += `<div id="${lineId}" class="abs-thin-line retained-line" style="left: ${oldLeftPct}%; top: 0; height: 100%; transition: left ${halfAnimMs}ms ease-out;" data-target-left="${newLeftPct}%"></div>`;
            }
          }
        }
        html += "</div>";
        gridContainer.innerHTML = html;
        T(() => {
          gridContainer.querySelectorAll(".removed-line").forEach((l) => ((l as HTMLElement).style.height = "0%"));
        }, 50);
        T(() => {
          gridContainer.querySelectorAll(".retained-line").forEach((l) => {
            (l as HTMLElement).style.left = l.getAttribute("data-target-left") || "";
          });
        }, 50 + halfAnimMs);
      } else if (action === "expand") {
        for (let k = 0; k < d; k++) {
          for (let j = 1; j < s; j++) {
            const leftPct = ((k * s + j) / (d * s)) * 100;
            html += `<div class="abs-thin-line expand-anim-line" style="left: ${leftPct}%; height: 0%; top: 0; background: var(--orange); transition: height ${animTimeMs}ms cubic-bezier(0.4, 0, 0.2, 1), background-color ${animTimeMs}ms;"></div>`;
          }
        }
        html += "</div>";
        gridContainer.innerHTML = html;
        T(() => {
          gridContainer.querySelectorAll(".expand-anim-line").forEach((el) => {
            const l = el as HTMLElement;
            l.style.height = "100%";
            T(() => (l.style.background = "var(--dark)"), animTimeMs);
          });
        }, 50);
      } else {
        for (let k = 0; k < d; k++) {
          for (let j = 1; j < s; j++) {
            const leftPct = ((k * s + j) / (d * s)) * 100;
            html += `<div class="abs-thin-line" style="left: ${leftPct}%;"></div>`;
          }
        }
        html += "</div>";
        gridContainer.innerHTML = html;
      }
    }

    function renderBar(num: number, action = "none", old_s = 1) {
      const vals = getSafeValues();
      const showNL = $i("show-nl-cb")!.checked;
      const total_n = num === 1 ? vals.total_n1 : vals.total_n2;
      const d = num === 1 ? vals.d1 : vals.d2;
      const w = num === 1 ? vals.w1 : vals.w2;
      const n = num === 1 ? vals.n1 : vals.n2;
      const s = num === 1 ? s1 : s2;
      const color = num === 1 ? "var(--red)" : "var(--blue)";
      const maxW = maxWholes();

      const label = $e(`label${num}`);
      const wrap = $e(`bar${num}-wrap`);
      const nlWrap = $e(`bar${num}-nl`);

      if (label) {
        label.style.transition = "opacity 0.5s";
        label.style.opacity = "1";
        label.innerHTML = getDisplayHtml(w, n * s, d * s, color);
      }

      if (wrap) {
        wrap.classList.add("continuous");
        if (action === "none") {
          wrap.innerHTML = "";
          for (let i = 0; i < maxW; i++) {
            const unit = document.createElement("div");
            unit.className = "bar-unit";
            unit.innerHTML = `<div class="bar-fill"></div><div class="bar-grid"></div>`;
            wrap.appendChild(unit);
          }
        }
        const units = wrap.querySelectorAll(".bar-unit");
        units.forEach((unitEl, idx) => {
          const unit = unitEl as HTMLElement;
          const fill = unit.querySelector(".bar-fill") as HTMLElement | null;
          const grid = unit.querySelector(".bar-grid") as HTMLElement | null;
          const filled_parts = total_n * s - idx * d * s;
          const clamped = Math.max(0, Math.min(d * s, filled_parts));
          const pct = (clamped / (d * s)) * 100;
          if (fill) {
            fill.style.width = `${pct}%`;
            fill.style.backgroundColor = color;
          }
          if (grid) applyGridAnimation(grid, d, s, old_s, action);
        });
      }

      if (nlWrap) {
        // 藍色除數（num===2）不顯示數線的數字標註
        if (showNL && num !== 2) {
          nlWrap.style.display = "flex";
          nlWrap.classList.add("continuous");
          nlWrap.innerHTML = "";
          for (let i = 0; i < maxW; i++) {
            const nlUnit = document.createElement("div");
            nlUnit.className = "nl-unit";
            let labelsHtml = "";
            const currentD = d * s;
            for (let k = 0; k < currentD; k++) {
              const leftPct = (k / currentD) * 100;
              let valHtml = "";
              if (k === 0) {
                valHtml = `<span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i}</span>`;
              } else {
                const fracPart = `<div class="inline-frac" style="font-size:0.85em; color:var(--dark);"><span>${k}</span><div class="line"></div><span>${currentD}</span></div>`;
                if (i > 0) {
                  valHtml = `<div style="display: flex; align-items: center; justify-content: center;"><span style="font-weight:bold; font-size:1.05rem; margin-right:2px; color:var(--dark);">${i}</span>${fracPart}</div>`;
                } else {
                  valHtml = fracPart;
                }
              }
              labelsHtml += `<div style="position: absolute; left: ${leftPct}%; top: 0px; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: 5;">
                  <div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div>
                  ${valHtml}
              </div>`;
            }
            if (i === maxW - 1) {
              labelsHtml += `<div style="position: absolute; left: 100%; top: 0px; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: 5;">
                  <div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div>
                  <span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i + 1}</span>
              </div>`;
            }
            nlUnit.innerHTML = labelsHtml;
            nlWrap.appendChild(nlUnit);
          }
        } else {
          nlWrap.style.display = "none";
          nlWrap.innerHTML = "";
        }
      }

      if (action !== "none") {
        const animTimeMs = (0.6 / currentSpeed) * 1000;
        T(() => {
          const current_s = num === 1 ? s1 : s2;
          if (current_s === s) renderBar(num, "none");
        }, 50 + animTimeMs);
      }
    }

    function checkCommonDenom() {
      if (!bar1Visible || !bar2Visible) return;
      const vals = getSafeValues();
      const cd1 = vals.d1 * s1;
      const cd2 = vals.d2 * s2;

      isCommonDenomReady = cd1 === cd2 && cd1 > 0;

      $e("bottom-answer-zone")!.style.opacity = "0";
      T(() => ($e("bottom-answer-zone")!.style.display = "none"), 300);

      if (isCommonDenomReady) {
        // 通分成功：隱藏擴約分按鈕
        root!.querySelectorAll(".tool-btn").forEach((btn) => ((btn as HTMLElement).style.display = "none"));
        // 鎖定數線開關，避免量測階段切換時重建長條圖而清除拖拉色塊與模具
        $i("show-nl-cb")!.disabled = true;
        $e("drag-instruction")!.innerHTML = `💡 分母相同了，開始做除法`;
        // 啟動除法動畫序列（通分成功後先暫停，讓學生閱讀）
        // 每次擴分都會延遲呼叫 checkCommonDenom；快速連點時只啟動一次，避免多層 drag-overlay 疊成「三條紅色長條」
        if (!divisionAnimationStarted) {
          divisionAnimationStarted = true;
          T(() => startDivisionAnimation(cd1), 1800 / currentSpeed);
        }
      } else {
        divisionAnimationStarted = false;
        // 尚未通分：恢復顯示工具
        root!.querySelectorAll(".tool-btn").forEach((btn) => ((btn as HTMLElement).style.display = "flex"));
        $i("show-nl-cb")!.disabled = false;
        if ($i("show-nl-cb")!.checked) {
          const nl1 = $e("bar1-nl");
          if (nl1) nl1.style.display = "flex";
          // 藍色除數（bar2）不顯示數線
        }
        $e("drag-instruction")!.innerHTML = `💡 用「擴分／約分」讓兩邊分母相同`;
        $e("bar3-row")!.style.display = "none";
      }
    }

    function startDivisionAnimation(cd: number) {
      const vals = getSafeValues();
      const P1 = vals.total_n1 * s1;
      const P2 = vals.total_n2 * s2;

      const wrap1 = $e("bar1-wrap")!;
      const wrap2 = $e("bar2-wrap")!;
      wrap1.classList.add("continuous");
      wrap2.classList.add("continuous");

      const lbl1 = $e("label1")!;
      const lbl2 = $e("label2")!;
      lbl1.style.transition = "opacity 0.5s";
      lbl2.style.transition = "opacity 0.5s";
      lbl1.style.opacity = "0";
      lbl2.style.opacity = "0";

      T(() => {
        buildDivisorMold(wrap2, P2, cd);
        T(() => {
          setupManualDragAndFill(P1, P2, cd);
        }, 4800 / currentSpeed);
      }, 1800 / currentSpeed);
    }

    function buildDivisorMold(wrap: HTMLElement, P2: number, cd: number) {
      const maxW = maxWholes();
      const singleUnitPct = 100 / maxW;
      const totalPct = (P2 / cd) * singleUnitPct;

      let moldHtml = `<div id="divisor-mold" style="position:relative; width:${totalPct}%; height:50px; border:3px dashed var(--blue); background:rgba(52, 152, 219, 0.25); opacity:1; box-sizing:border-box; border-radius:4px; display:flex; transition: 0.3s box-shadow;">`;
      for (let i = 1; i < P2; i++) {
        moldHtml += `<div style="position:absolute; top:0; left:${(i / P2) * 100}%; width:1px; height:100%; background:var(--dark);"></div>`;
      }
      moldHtml += `</div>`;
      wrap.innerHTML = moldHtml;

      const mold = $e("divisor-mold")!;
      T(() => (mold.style.boxShadow = "0 0 15px 5px rgba(52, 152, 219, 0.6)"), 100);
      T(() => (mold.style.boxShadow = "none"), 600);
      T(() => {
        $e("drag-instruction")!.innerHTML = `💡 藍色長條是一個容器`;
      }, 300 / currentSpeed);
    }

    function setupManualDragAndFill(P1: number, P2: number, cd: number) {
      if (P2 === 0) return;

      blueMoldBusy = false;
      divisionDropQueue = [];

      const row3 = $e("bar3-row")!;
      row3.style.display = "flex";
      const wrap3 = $e("bar3-wrap")!;
      wrap3.style.outline = "none";
      wrap3.style.flexDirection = "column";
      wrap3.style.alignItems = "flex-start";
      wrap3.style.gap = "10px";
      wrap3.innerHTML = "";
      wrap3.setAttribute("data-filled", "0");
      wrap3.setAttribute("data-anims-finished", "0");

      const wrap2 = $e("bar2-wrap")!;
      wrap2.classList.add("droppable-area");

      $e("label3")!.innerHTML = `除法結果`;
      $e("label3")!.style.opacity = "1";

      const wrap1 = $e("bar1-wrap")!;
      const maxW = maxWholes();

      const numMolds = Math.ceil(P1 / P2);
      const moldWidthPct = (P2 / (cd * maxW)) * 100;

      const molds: HTMLElement[] = [];
      for (let i = 0; i < numMolds; i++) {
        const mold = document.createElement("div");
        mold.style.width = moldWidthPct + "%";
        mold.style.height = "50px";
        mold.style.border = "3px solid var(--blue)";
        mold.style.borderRadius = "4px";
        mold.style.boxSizing = "border-box";
        mold.style.position = "relative";
        mold.style.display = "flex";
        mold.style.backgroundColor = "rgba(52, 152, 219, 0.05)";
        for (let k = 1; k < P2; k++) {
          const line = document.createElement("div");
          line.style.position = "absolute";
          line.style.top = "0";
          line.style.left = (k / P2) * 100 + "%";
          line.style.width = "1px";
          line.style.height = "100%";
          line.style.backgroundColor = "var(--dark)";
          line.style.zIndex = "5";
          mold.appendChild(line);
        }
        wrap3.appendChild(mold);
        molds.push(mold);
      }

      // 隱藏被除數底下的紅色填色（由拖拉色塊取代）；保留格線與數線
      wrap1.querySelectorAll(".bar-fill").forEach((f) => ((f as HTMLElement).style.display = "none"));

      // Defensive: remove stale overlay if division setup was triggered more than once
      const staleOverlay = $e("drag-overlay");
      if (staleOverlay) staleOverlay.remove();

      const overlay = document.createElement("div");
      overlay.id = "drag-overlay";
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.zIndex = "10";
      wrap1.style.position = "relative";
      wrap1.appendChild(overlay);

      // 進入「把紅色拖進藍色容器」階段時，補上被除數最右邊界（整數 1）的粗黑分割線。
      // 原格線只畫 k=1..d-1，右邊界僅靠 2px 細邊框，看起來像缺一條線（與 4/6 等粗線不一致）。
      // 掛在最後一個 bar-unit 內，讓高度剛好等於長條（50px），不會超出。
      const allUnits1 = wrap1.querySelectorAll(".bar-unit");
      const lastUnit1 = allUnits1[allUnits1.length - 1] as HTMLElement | undefined;
      if (lastUnit1) {
        const endLine = document.createElement("div");
        endLine.className = "abs-thick-line";
        endLine.style.left = "100%";
        endLine.style.transform = "translateX(-100%)";
        endLine.style.zIndex = "5";
        endLine.style.pointerEvents = "none";
        lastUnit1.appendChild(endLine);
      }

      for (let i = 0; i < numMolds; i++) {
        const size = i === numMolds - 1 && P1 % P2 !== 0 ? P1 % P2 : P2;
        const startPiece = i * P2;
        const chunkLeftPct = (startPiece / (cd * maxW)) * 100;
        const chunkWidthPct = (size / (cd * maxW)) * 100;

        const chunk = document.createElement("div");
        chunk.className = "drag-block";
        chunk.id = "div-chunk-" + i;
        chunk.style.position = "absolute";
        chunk.style.top = "0";
        chunk.style.left = chunkLeftPct + "%";
        chunk.style.width = chunkWidthPct + "%";
        chunk.style.height = "100%";
        chunk.style.backgroundColor = "var(--red)";
        chunk.style.opacity = "1";
        chunk.style.border = "2px solid white";
        chunk.style.borderRadius = "4px";
        chunk.style.boxSizing = "border-box";
        chunk.style.cursor = "grab";
        chunk.draggable = true;
        chunk.setAttribute("data-size", String(size));
        chunk.setAttribute("data-mold-index", String(i));

        chunk.ondragstart = (e: DragEvent) => {
          e.dataTransfer!.setData("text/plain", chunk.id);
          setTimeout(() => (chunk.style.visibility = "hidden"), 0);
        };
        chunk.ondragend = () => {
          if (chunk.getAttribute("data-measured") === "1") return;
          // 若未成功放入容器，恢復顯示
          chunk.style.visibility = "visible";
          chunk.style.opacity = "1";
        };
        // 支援點擊直接送出量測
        chunk.onclick = () => {
          handleDropChunk(chunk.id, molds, P1, P2, cd);
        };

        overlay.appendChild(chunk);
      }

      $e("drag-instruction")!.innerHTML = `💡 把紅色一份一份拖進藍色容器`;

      wrap2.ondragover = (e: DragEvent) => {
        e.preventDefault();
        wrap2.style.boxShadow = "0 0 15px 5px rgba(52, 152, 219, 0.5)";
      };
      wrap2.ondragleave = () => {
        wrap2.style.boxShadow = "none";
      };
      wrap2.ondrop = (e: DragEvent) => {
        e.preventDefault();
        wrap2.style.boxShadow = "none";
        const id = e.dataTransfer!.getData("text/plain");
        handleDropChunk(id, molds, P1, P2, cd);
      };
    }

    // 若藍色容器正被佔用，將此次投遞排入佇列，待容器淨空後自動處理
    function processDropQueue() {
      if (blueMoldBusy || divisionDropQueue.length === 0) return;
      const next = divisionDropQueue.shift()!;
      handleDropChunk(next.chunkId, next.molds, next.P1, next.P2, next.cd);
    }

    // Post-drop flight animation. Only one chunk may visit #divisor-mold at a time
    // (blueMoldBusy + divisionDropQueue below); extra drops wait their turn instead of stacking.
    function handleDropChunk(chunkId: string, molds: HTMLElement[], P1: number, P2: number, cd: number) {
      const chunk = $e(chunkId);
      if (!chunk || chunk.getAttribute("data-measured") === "1") return;

      if (blueMoldBusy) {
        if (chunk.getAttribute("data-queued") !== "1") {
          chunk.setAttribute("data-queued", "1");
          chunk.style.visibility = "hidden";
          divisionDropQueue.push({ chunkId, molds, P1, P2, cd });
        }
        return;
      }
      chunk.removeAttribute("data-queued");
      blueMoldBusy = true;

      const wrap3 = $e("bar3-wrap")!;
      let filledCount = parseInt(wrap3.getAttribute("data-filled") || "0") || 0;
      const totalChunks = Math.ceil(P1 / P2);

      const size = parseInt(chunk.getAttribute("data-size") || "0");

      // 依 data-mold-index（而非投遞順序）選定目標模具，確保結果列順序與被除數上的色塊順序一致
      const moldIndex = parseInt(chunk.getAttribute("data-mold-index") || "0", 10);
      const targetMold = molds[moldIndex];
      if (!targetMold) {
        blueMoldBusy = false;
        return;
      }

      // 先量測位置，再將同一個 drag-block 元素改為 fixed 飛行（不建立複本）
      const startRect = chunk.getBoundingClientRect();
      const containerEl = $e("divisor-mold") || $e("bar2-wrap")!;
      const containerRect = containerEl.getBoundingClientRect();
      const resultRect = targetMold.getBoundingClientRect();

      chunk.setAttribute("data-measured", "1");
      chunk.draggable = false;
      chunk.onclick = null;
      chunk.ondragstart = null;
      chunk.ondragend = null;

      // 預先佔用位置
      filledCount++;
      wrap3.setAttribute("data-filled", String(filledCount));

      // -- 兩段式飛行：同一元素先飛入藍色容器，停留後再垂直落入結果模具 --
      const flightSec = 1 / currentSpeed;
      const pauseSec = 0.4 / currentSpeed;
      const animWidth = (size / P2) * resultRect.width;
      const transition = `top ${flightSec}s ease-in-out, left ${flightSec}s ease-in-out, width ${flightSec}s ease-in-out, height ${flightSec}s ease-in-out`;

      // 在原位置留下紅色虛線佔位，表示這裡原本有一份被除數
      const originParent = chunk.parentElement;
      if (originParent) {
        const ghost = document.createElement("div");
        ghost.className = "div-chunk-ghost";
        ghost.style.position = "absolute";
        ghost.style.top = "0";
        ghost.style.left = chunk.style.left;
        ghost.style.width = chunk.style.width;
        ghost.style.height = "100%";
        ghost.style.border = "2px dashed #e74c3c";
        ghost.style.borderRadius = "4px";
        ghost.style.boxSizing = "border-box";
        ghost.style.backgroundColor = "rgba(231, 76, 60, 0.1)";
        ghost.style.zIndex = "1";
        originParent.appendChild(ghost);
      }

      chunk.style.visibility = "visible";
      chunk.style.opacity = "1";
      // The flyer is re-parented to document.body, outside the .fa38-root scope
      // where --red is defined, so use an explicit colour to stay red mid-flight.
      chunk.style.backgroundColor = "#e74c3c";
      chunk.style.position = "fixed";
      chunk.style.top = startRect.top + "px";
      chunk.style.left = startRect.left + "px";
      chunk.style.width = startRect.width + "px";
      chunk.style.height = startRect.height + "px";
      chunk.style.margin = "0";
      chunk.style.cursor = "default";
      chunk.style.zIndex = "9999";
      chunk.style.transition = transition;
      document.body.appendChild(chunk);

      void chunk.offsetWidth;

      // 第一段：飛入藍色除數容器（z-index 9999 完全遮蓋模具內的隔線）
      chunk.style.top = containerRect.top + "px";
      chunk.style.left = containerRect.left + "px";
      chunk.style.width = animWidth + "px";
      chunk.style.height = containerRect.height + "px";

      // 第二段：停留後，垂直落入下方結果模具
      T(() => {
        chunk.style.top = resultRect.top + "px";
        chunk.style.left = resultRect.left + "px";
        chunk.style.width = animWidth + "px";
        chunk.style.height = resultRect.height + "px";
      }, (flightSec + pauseSec) * 1000);

      // 動畫結束後的處理（完成後才釋放藍色容器並處理佇列，避免多塊紅色重疊）
      T(() => {
        chunk.remove();
        // 在結果區模具中生成顏色填充（z-index 4，位於模具內 z-index 5 的隔線之下，
        // 讓每一格與「1 整份」的分割線在紅色填充上仍清楚可見）
        const fill = document.createElement("div");
        fill.style.position = "absolute";
        fill.style.top = "0";
        fill.style.left = "0";
        fill.style.width = (size / P2) * 100 + "%";
        fill.style.height = "100%";
        fill.style.backgroundColor = "var(--red)";
        fill.style.opacity = "1";
        fill.style.zIndex = "4";
        targetMold.appendChild(fill);

        blueMoldBusy = false;
        processDropQueue();

        // 記錄有幾個動畫已完成
        let animsFinished = parseInt(wrap3.getAttribute("data-anims-finished") || "0") || 0;
        animsFinished++;
        wrap3.setAttribute("data-anims-finished", String(animsFinished));

        // 如果全部拼圖都放完且動畫結束，顯示答案區
        // （保留上方拖拉層中的紅色虛線佔位，表示被除數原本的位置）
        if (animsFinished === totalChunks) {
          wrap3.style.outline = "none";
          wrap3.style.backgroundColor = "transparent";
          showAnswerZone(P1, P2, cd);
        }
      }, (flightSec * 2 + pauseSec) * 1000);
    }

    function showAnswerZone(_P1: number, _P2: number, _cd: number) {
      const vals = getSafeValues();
      $e("bottom-answer-zone")!.style.display = "flex";
      T(() => ($e("bottom-answer-zone")!.style.opacity = "1"), 50);

      $e("bot-frac1")!.innerHTML = getDisplayHtml(vals.w1, vals.n1 * s1, vals.d1 * s1, "var(--red)");
      $e("bot-frac2")!.innerHTML = getDisplayHtml(vals.w2, vals.n2 * s2, vals.d2 * s2, "var(--blue)");

      const exactN = vals.total_n1 * vals.d2;
      const exactD = vals.total_n2 * vals.d1;

      let hint = "";
      if (exactN >= exactD) {
        $e("ans-w")!.style.display = "inline-block";
        hint = "（可填帶分數）";
      } else {
        $e("ans-w")!.style.display = "none";
        $i("ans-w")!.value = "";
      }

      $e("bot-public-unit")!.style.display = "none";
      $e("drag-instruction")!.innerHTML = `💡 數完了，請填寫下方答案${hint}`;
    }

    function updateUI() {
      enforceInputLimits();
      updateMaxWholes();
      const vals = getSafeValues();

      s1 = 1;
      s2 = 1;
      bar1Visible = false;
      bar2Visible = false;
      isCommonDenomReady = false;
      divisionAnimationStarted = false;

      $i("show-nl-cb")!.disabled = false;

      const wpEl = $e("word-problem")!;
      if (currentWordProblemTemplate) {
        const frac1Html = `<b>${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}</b>`;
        const frac2Html = `<b>${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}</b>`;
        wpEl.innerHTML = currentWordProblemTemplate.replace(/\[FRAC1\]/g, frac1Html).replace(/\[FRAC2\]/g, frac2Html);
        wpEl.style.display = "block";
      } else {
        wpEl.style.display = "none";
      }

      $i("ans-w")!.value = "";
      $e("ans-w")!.style.display = "none";
      $i("ans-num")!.value = "";
      $i("ans-den")!.value = "";
      $e("feedback")!.style.opacity = "0";
      $e("bottom-answer-zone")!.style.display = "none";
      $e("bottom-answer-zone")!.style.opacity = "0";

      $e("anim-area")!.innerHTML = `
        <div id="bar1-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between;">
            <div id="label1" style="width:15%; text-align:center;"></div>
            <div class="bars-column">
                <div id="bar1-wrap" class="bar-wrap-container"></div>
                <div id="bar1-nl" class="nl-wrap-container" style="display:none;"></div>
            </div>
            <div style="width:15%; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <button class="tool-btn" onclick="window.__FA38.applyTool(1, 'expand')">➕ 擴分</button>
                <button class="tool-btn" onclick="window.__FA38.applyTool(1, 'simplify')">➖ 約分</button>
            </div>
        </div>
        <div id="bar2-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between;">
            <div id="label2" style="width:15%; text-align:center;"></div>
            <div class="bars-column">
                <div id="bar2-wrap" class="bar-wrap-container"></div>
                <div id="bar2-nl" class="nl-wrap-container" style="display:none;"></div>
            </div>
            <div style="width:15%; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <button class="tool-btn" onclick="window.__FA38.applyTool(2, 'expand')">➕ 擴分</button>
                <button class="tool-btn" onclick="window.__FA38.applyTool(2, 'simplify')">➖ 約分</button>
            </div>
        </div>

        <div id="bar3-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between; margin-top: 10px; padding-top: 15px; border-top: 2px dashed #ccc;">
            <div id="label3" style="width:15%; text-align:center; font-weight:bold; color:var(--dark); font-size:1.1rem; display:flex; flex-direction:column; align-items:center;"></div>
            <div class="bars-column">
                <div id="bar3-wrap" class="bar-wrap-container" style="min-height: 50px; border-radius: 4px; transition: 0.3s; flex-direction: row; align-items: center;"></div>
            </div>
            <div style="width:15%;"></div>
        </div>
      `;

      renderBar(1, "none");
      renderBar(2, "none");
      $e("drag-instruction")!.innerHTML = `💡 點上方的分數，顯示長條圖`;
    }

    function randomChallenge() {
      let d1 = Math.floor(Math.random() * 5) + 3;
      let d2 = Math.floor(Math.random() * 5) + 3;
      while (d2 === d1) {
        d2 = Math.floor(Math.random() * 5) + 3;
      }
      let n1 = Math.floor(Math.random() * (d1 * 2)) + 1;
      const n2 = Math.floor(Math.random() * d2) + 1;
      let w1: number | string = "";
      const w2 = "";

      const showWhole = $i("show-whole-cb")!.checked;
      if (showWhole && Math.random() > 0.5 && n1 >= d1) {
        w1 = Math.floor(n1 / d1);
        n1 = n1 % d1;
        if (n1 === 0) n1 = 1;
      }

      $i("w1")!.value = String(w1);
      $i("n1")!.value = String(n1);
      $i("d1")!.value = String(d1);
      $i("w2")!.value = String(w2);
      $i("n2")!.value = String(n2);
      $i("d2")!.value = String(d2);

      currentWordProblemTemplate = wordProblemTemplates[Math.floor(Math.random() * wordProblemTemplates.length)];
      updateUI();
    }

    function autoCheck() {
      const vals = getSafeValues();
      const ansWStr = $i("ans-w")!.value;
      const ansNStr = $i("ans-num")!.value;
      const ansDStr = $i("ans-den")!.value;

      const ansW = parseInt(ansWStr) || 0;
      let ansN = parseInt(ansNStr);
      let ansD = parseInt(ansDStr);

      if (ansNStr === "" && ansDStr === "") {
        ansN = 0;
        ansD = 1;
      }

      const fb = $e("feedback")!;

      if (!isNaN(ansN) && !isNaN(ansD) && ansD !== 0) {
        const userTotalN = ansW * ansD + ansN;
        const userVal = userTotalN / ansD;

        const exactN = vals.total_n1 * vals.d2;
        const exactD = vals.total_n2 * vals.d1;
        const exactVal = exactN / exactD;

        const divisor = gcd(exactN, exactD);
        const simpleImproperN = exactN / divisor;
        const simpleD = exactD / divisor;
        const simpleW = Math.floor(simpleImproperN / simpleD);
        const simpleMixedN = simpleImproperN % simpleD;

        const currentD = vals.d1 * s1;
        const LcmD = lcm(vals.d1, vals.d2);

        if (Math.abs(userVal - exactVal) < 0.0001) {
          let msg = "";
          let isSimplest = false;
          if (ansW === 0 && ansN === simpleImproperN && ansD === simpleD) isSimplest = true;
          if (ansW === simpleW && ansN === simpleMixedN && ansD === simpleD) isSimplest = true;
          if (ansN === 0 && ansW === simpleW && simpleMixedN === 0) isSimplest = true;

          if (isSimplest) {
            msg = "🎉 完全正確！";
          } else {
            msg = "🌟 數值對了，可以再約分或寫成帶分數";
          }
          if (currentD !== LcmD) {
            msg += '<br><span style="color:var(--orange); font-size:1rem; font-weight:normal;">（提示：通分時分母不是最小公倍數）</span>';
          }
          fb.style.opacity = "1";
          fb.style.color = "var(--success)";
          fb.innerHTML = msg;
        } else {
          fb.style.opacity = "1";
          fb.style.color = "var(--red)";
          fb.innerText = "👀 答案不對，再數一次裝了幾個容器";
        }
      } else {
        fb.style.opacity = "0";
      }
    }

    // ---------- bootstrap ----------
    const api: FA38Api = {
      toggleWholeNumber,
      toggleNumberLine,
      updateSpeed,
      randomChallenge,
      onFrac1Click,
      onFrac2Click,
      updateUI,
      autoCheck,
      applyTool,
    };
    window.__FA38 = api;

    de.style.setProperty("--max-wholes", "1");
    de.style.setProperty("--anim-time", "0.6s");
    root.innerHTML = BODY_HTML;

    const onCtx = (e: Event) => e.preventDefault();
    root.addEventListener("contextmenu", onCtx);

    // window.onload sequence
    updateSpeed();
    toggleWholeNumber();
    updateUI();

    return () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      root.removeEventListener("contextmenu", onCtx);
      // Flying chunks are re-parented to document.body during handleDropChunk; remove any orphans.
      document.querySelectorAll('[id^="div-chunk-"]').forEach((el) => {
        if (el.parentElement === document.body) el.remove();
      });
      if (window.__FA38 === api) delete window.__FA38;
      de.style.removeProperty("--max-wholes");
      de.style.removeProperty("--anim-time");
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`fa38-root${embedded ? " embedded" : ""}`} ref={rootRef} />
    </>
  );
}
