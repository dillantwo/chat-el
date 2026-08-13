"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 分數乘法教學 (Multiplication of fractions).
 *
 * Ported from public/math/FractionApp-Multiplication.html (arith-common.css +
 * nav.css + FractionApp45.css + bar-component.css + FractionApp45.js).
 *
 * Same porting strategy as the Addition / Subtraction tools: the app is very
 * imperative (a single animated main bar that subdivides → extracts → rearranges
 * across 5 steps, plus a CSS tutorial-finger with idle/hover hints). The original
 * script is ported almost verbatim into one mount effect that scopes CSS under
 * `.fa45-root`, injects the markup, exposes the inline-handler functions on
 * `window.__FA45`, and tears everything down on unmount.
 *
 * `--anim-time` / `--max-wholes` stay on document.documentElement because the
 * script reads `--max-wholes` back via getComputedStyle(documentElement).
 */

const STYLES = `
.fa45-root{
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
.fa45-root *{ margin:0; padding:0; box-sizing:border-box; }
.fa45-root .container{ background:#fff; padding:20px 30px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.1);
  max-width:1000px; width:100%; box-sizing:border-box; overflow-x:hidden; }

/* nav */
.fa45-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fa45-root .header-left{ display:flex; align-items:center; gap:15px; }
.fa45-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fa45-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fa45-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fa45-root .checkbox-label{ display:flex; align-items:center; gap:6px; font-size:0.95rem; color:#333; cursor:pointer; user-select:none; font-weight:bold; }
.fa45-root .checkbox-label input[type=checkbox]{ cursor:pointer; width:16px; height:16px; accent-color:var(--nav-primary); }
.fa45-root .divider{ width:1px; height:18px; background:#ccc; }
.fa45-root .speed-ctrl{ display:flex; align-items:center; gap:8px; font-size:0.95rem; color:#333; font-weight:bold; }
.fa45-root .speed-ctrl input[type=range]{ width:80px; cursor:pointer; accent-color:var(--nav-primary); }
.fa45-root .lang-btn{ padding:6px 16px; border:2px solid var(--nav-gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--nav-gray); outline:none; transition:0.15s; transform:translateY(0); }
.fa45-root .lang-btn:active{ box-shadow:0 0 0 var(--nav-gray); transform:translateY(3px); }
.fa45-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }
.fa45-root .lang-btn.btn-random{ border-color:#9b59b6; color:#9b59b6; box-shadow:0 3px 0 #9b59b6; }
.fa45-root .lang-btn.btn-random:hover{ background:#9b59b6; color:#fff; }
.fa45-root .lang-btn.btn-random:active{ box-shadow:0 0 0 #9b59b6; transform:translateY(3px); background:#8e44ad; color:#fff; }

/* problem / formula */
.fa45-root .word-problem{ font-size:1.3rem; font-weight:bold; color:var(--dark); background:#e8f4f8; padding:15px 25px;
  border-radius:12px; border-left:6px solid var(--blue); margin-bottom:10px; width:100%; text-align:center;
  box-sizing:border-box; display:none; line-height:1.8; box-shadow:0 4px 6px rgba(0,0,0,0.05); }
.fa45-root .word-problem b{ color:var(--red); font-size:1.5rem; margin:0 5px; padding:2px 6px; background:#fff;
  border-radius:6px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1); display:inline-flex; align-items:center; }
.fa45-root .answer-zone{ padding:5px 0; text-align:center; color:var(--dark); display:flex; flex-direction:column; align-items:center; }
.fa45-root .formula{ display:flex; align-items:center; justify-content:center; gap:15px; font-size:2rem; flex-wrap:wrap; margin-bottom:0; }
.fa45-root .mixed-frac{ display:flex; align-items:center; gap:5px; cursor:pointer; padding:5px; border-radius:10px; transition:0.2s; }
.fa45-root .mixed-frac:hover{ background:#f0f0f0; }
.fa45-root .whole-input{ width:45px; height:50px; font-size:1.8rem; text-align:center; border-radius:8px; border:2px solid #ccc;
  outline:none; transition:0.3s; font-weight:bold; color:var(--dark); background:#fff; display:none; }
.fa45-root .whole-input:focus{ border-color:var(--blue); box-shadow:0 0 8px rgba(52,152,219,0.4); }
.fa45-root .frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; }
.fa45-root .frac-input{ width:55px; height:45px; font-size:1.5rem; text-align:center; border-radius:8px; font-weight:bold;
  color:var(--dark); transition:0.3s; outline:none; border:2px solid #ccc; background:#fff; }
.fa45-root .frac-text{ font-size:2rem; font-weight:bold; text-align:center; padding:0 10px; color:var(--dark); }
.fa45-root .frac-line{ width:100%; height:3px; background:var(--dark); margin:5px 0; }

/* animation zone */
.fa45-root .animation-zone{ width:100%; padding-top:5px; display:flex; flex-direction:column; align-items:center; position:relative; }
.fa45-root .instruction-text{ font-size:1.3rem; font-weight:bold; color:var(--dark); text-align:center; margin-bottom:10px;
  background:#fff4e6; padding:12px 25px; border-radius:12px; border-left:6px solid var(--orange); width:100%; max-width:850px;
  box-sizing:border-box; transition:opacity 0.5s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa45-root .inline-frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; font-weight:bold;
  line-height:1; margin:0 5px; position:relative; top:-0.1em; }
.fa45-root .inline-frac span{ font-size:1.1em; padding:1px 4px; }
.fa45-root .inline-frac .line{ height:2px; background-color:currentColor; width:100%; margin:2px 0; }
.fa45-root #anim-area{ width:100%; min-height:200px; position:relative; overflow:visible; margin-top:5px; display:flex; flex-direction:column; gap:20px; }

@keyframes fa45FadeInSlow { 0%{ opacity:0; transform:translateY(10px); } 100%{ opacity:1; transform:translateY(0); } }
.fa45-root .fade-in-slow{ animation:fa45FadeInSlow 1s ease-out forwards; }
@keyframes fa45ClickAnim { 0%,100%{ transform:scale(1) translate(0,0); } 50%{ transform:scale(0.85) translate(0,10px); } }

.fa45-root .tool-btn{ background:#3498db; color:#fff; border:2px solid transparent; padding:8px 12px; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:1rem; transition:transform 0.1s, background 0.2s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa45-root .tool-btn:hover{ background:#2980b9; transform:scale(1.05); }
.fa45-root .tool-btn:active{ transform:scale(0.95); background:#1f618d; }

.fa45-root .bars-column{ width:70%; display:flex; flex-direction:column; }
.fa45-root .bar-wrap-container{ width:100%; display:flex; flex-wrap:wrap; gap:15px; justify-content:flex-start; align-items:center;
  background:transparent; border:none; min-height:60px; transition:0.5s ease; }
.fa45-root .bar-unit{ position:relative; height:50px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes));
  min-width:120px; flex:none; border:var(--bar-border-width) solid var(--bar-border-color); box-sizing:border-box;
  background:var(--bar-bg); border-radius:var(--bar-border-radius); overflow:hidden; }
.fa45-root .bar-fill{ height:100%; transition:width var(--anim-time) ease; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); }
.fa45-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; overflow:hidden; }
.fa45-root .abs-thick-line{ position:absolute; top:0; width:var(--grid-thick-width); height:100%; background:var(--grid-thick-color); transform:translateX(-50%); z-index:4; }
.fa45-root .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa45-root .bar-wrap-container.continuous{ gap:0 !important; }
.fa45-root .bar-wrap-container.continuous .bar-unit{ width:calc(100% / var(--max-wholes)) !important; border-right:none; border-radius:0; }
.fa45-root .bar-wrap-container.continuous .bar-unit:last-child{ border-right:var(--bar-border-width) solid var(--bar-border-color); border-top-right-radius:4px; border-bottom-right-radius:4px; }
.fa45-root .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:4px; border-bottom-left-radius:4px; }
.fa45-root .nl-wrap-container{ width:100%; display:flex; flex-wrap:wrap; justify-content:flex-start; align-items:flex-start;
  min-height:45px; margin-top:2px; border:none; position:relative; gap:15px; }
.fa45-root .nl-wrap-container.continuous{ gap:0 !important; }
.fa45-root .nl-unit{ position:relative; height:45px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes)); min-width:120px; flex:none; box-sizing:border-box; }
.fa45-root .nl-wrap-container.continuous .nl-unit{ width:calc(100% / var(--max-wholes)) !important; }

.fa45-root #bottom-answer-zone{ width:100%; max-width:650px; background:#fff8e1; padding:20px; border-radius:15px;
  border:2px dashed var(--red); margin-top:15px; display:none; flex-direction:column; align-items:center; gap:10px;
  box-shadow:0 4px 10px rgba(0,0,0,0.05); transition:opacity 0.5s; z-index:50; position:relative; }
.fa45-root .feedback-msg{ font-size:1.2rem; font-weight:bold; min-height:28px; margin-top:5px; opacity:0; transition:opacity 0.3s, color 0.3s; text-align:center; }
.fa45-root .drag-block{ transition:transform 0.1s, opacity 0.2s, box-shadow 0.2s; touch-action:manipulation; }

@media (max-width:768px){
  .fa45-root .header{ flex-direction:column; align-items:stretch; text-align:center; }
  .fa45-root .header-left{ justify-content:center; }
  .fa45-root .header-right{ justify-content:center; width:100%; }
  .fa45-root .controls-pill{ width:100%; justify-content:center; flex-wrap:wrap; }
  .fa45-root .title-badge{ font-size:1.1rem; }
  .fa45-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
  .fa45-root .container{ padding:15px; }
  .fa45-root .formula{ font-size:1.5rem; }
  .fa45-root .whole-input{ width:35px; height:40px; font-size:1.4rem; }
  .fa45-root .frac-input{ width:45px; height:35px; font-size:1.2rem; }
  .fa45-root .instruction-text, .fa45-root .word-problem{ font-size:1.1rem; padding:12px 15px; }
  .fa45-root .bars-column{ width:100% !important; }
  .fa45-root #bar1-row{ flex-direction:column; }
  .fa45-root #label1{ width:100% !important; margin-bottom:10px; }
}

/* embedded (inside iframe) — 去除底層灰底並自適應父頁面，比照相等分數 */
.fa45-root.embedded{ background:transparent; padding:15px; }
.fa45-root.embedded .container{ box-shadow:none; border-radius:0; padding:1rem; }
`;

const BODY_HTML = `
<div class="container">
  <div class="header">
    <div class="header-left">
      <div class="title-badge">分數相乘</div>
    </div>
    <div class="header-right">
      <div class="controls-pill">
        <label class="checkbox-label">
          <input type="checkbox" id="show-whole-cb" onchange="window.__FA45.toggleWholeNumber()"> 顯示帶分數
        </label>
        <span class="divider"></span>
        <label class="checkbox-label">
          <input type="checkbox" id="show-nl-cb" onchange="window.__FA45.toggleNumberLine()" checked> 顯示數線
        </label>
        <span class="divider"></span>
        <div class="speed-ctrl">
          <label for="speed-slider" title="調整動畫速度">動畫速度: <span id="speed-val" style="color: var(--blue);">1.0</span>x</label>
          <input type="range" id="speed-slider" min="0.5" max="3" step="0.1" value="1.0" oninput="window.__FA45.updateSpeed()">
        </div>
      </div>
      <button class="lang-btn btn-random" onclick="window.__FA45.randomChallenge()">🎲 隨機出題</button>
    </div>
  </div>

  <div id="word-problem" class="word-problem"></div>

  <div class="answer-zone">
    <div class="formula">
      <div class="mixed-frac" id="frac1-group" onclick="window.__FA45.onFrac1Click()" title="點擊設定被乘數圖形">
        <input type="number" class="whole-input" id="w1" placeholder=" " min="0" max="10" oninput="window.__FA45.updateUI()" onchange="window.__FA45.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n1" value="2" min="1" max="10" oninput="window.__FA45.updateUI()" onchange="window.__FA45.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d1" value="3" min="1" max="10" oninput="window.__FA45.updateUI()" onchange="window.__FA45.updateUI()">
        </div>
      </div>
      <span style="cursor:pointer;" onclick="window.__FA45.onFrac2Click()" title="點擊播放乘法動畫">×</span>
      <div class="mixed-frac" id="frac2-group" onclick="window.__FA45.onFrac2Click()" title="點擊播放乘法動畫">
        <input type="number" class="whole-input" id="w2" placeholder=" " min="0" max="10" oninput="window.__FA45.updateUI()" onchange="window.__FA45.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n2" value="1" min="1" max="10" oninput="window.__FA45.updateUI()" onchange="window.__FA45.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d2" value="2" min="1" max="10" oninput="window.__FA45.updateUI()" onchange="window.__FA45.updateUI()">
        </div>
      </div>
    </div>
  </div>

  <div class="animation-zone" id="anim-zone">
    <div id="drag-instruction" class="instruction-text">💡 準備中...請先點擊上方的「被乘數」</div>
    <div id="anim-area">
      <div id="bar1-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between;">
        <div id="label1" style="width:15%; text-align:center; font-size:1.3rem; transition: opacity 0.5s; opacity: 1; font-weight:bold;"></div>
        <div class="bars-column">
          <div id="main-bar-wrap" class="bar-wrap-container" onclick="window.__FA45.toggleRearrange()"></div>
          <div id="bar1-nl" class="nl-wrap-container" style="display:none;"></div>
        </div>
        <div style="width:15%;"></div>
      </div>
    </div>

    <div id="bottom-answer-zone">
      <div class="formula">
        <div id="bot-frac1"></div>
        <span>×</span>
        <div id="bot-frac2"></div>
        <span>=</span>
        <div class="mixed-frac" style="cursor: default;">
          <input type="number" class="whole-input" id="ans-w" placeholder=" " min="0" oninput="window.__FA45.autoCheck()">
          <div class="frac">
            <input type="number" class="frac-input" id="ans-num" placeholder="?" min="0" oninput="window.__FA45.autoCheck()">
            <div class="frac-line" style="background:#ccc;"></div>
            <input type="number" class="frac-input" id="ans-den" placeholder="?" min="1" oninput="window.__FA45.autoCheck()">
          </div>
        </div>
      </div>
      <div id="feedback" class="feedback-msg"></div>
    </div>
  </div>
</div>
`;

type FA45Api = {
  toggleWholeNumber: () => void;
  toggleNumberLine: () => void;
  updateSpeed: () => void;
  randomChallenge: () => void;
  onFrac1Click: () => void;
  onFrac2Click: () => void;
  updateUI: () => void;
  autoCheck: () => void;
  toggleRearrange: () => void;
};

declare global {
  interface Window {
    __FA45?: FA45Api;
  }
}

type AnimBlock = { el: HTMLElement; state: string };

export default function FractionMultiplicationPage() {
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

    let alive = true;
    const de = document.documentElement;

    const $e = (id: string) => document.getElementById(id) as HTMLElement | null;
    const $i = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    // ---------- state (mirrors FractionApp45.js module vars) ----------
    let currentWordProblemTemplate: string | null = null;
    let currentSpeed = 1.0;
    let isRearranged = false;
    let isAnimating = false;
    let isRearranging = false;
    let awaitingRearrangeClick = false;
    let animBlocks: AnimBlock[] = [];
    let preRearrangePositions: { left: string; unit: HTMLElement }[] = [];
    let currentNL_D = 1;
    let isPhase1OrLater = false;

    let idleTimer: number | null = null;
    let hoverTimer: number | null = null;
    let currentTutorialStep = 0;

    const timers: number[] = [];
    const T = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      timers.push(id);
      return id;
    };
    const maxWholesVar = () => parseInt(getComputedStyle(de).getPropertyValue("--max-wholes")) || 1;

    const wordProblemTemplates = [
      "一盒巧克力重 [FRAC1] 公斤，小明買了 [FRAC2] 盒。請問總共重多少公斤？",
      "一塊農田面積為 [FRAC1] 公頃，第二塊面積是第一塊的 [FRAC2] 倍。請問第二塊農田的面積是多少公頃？",
      "媽媽做一塊蛋糕需要 [FRAC1] 杯麵粉，她做了 [FRAC2] 塊蛋糕。請問總共需要多少杯麵粉？",
      "水桶容量為 [FRAC1] 公升，目前裝了 [FRAC2] 桶水。請問總共有多少公升的水？",
      "紅彩帶長 [FRAC1] 公尺，藍彩帶長度是紅彩帶的 [FRAC2] 倍。請問藍彩帶長多少公尺？",
    ];

    // ---------- tutorial finger ----------
    function pointAtTarget(element: HTMLElement | null) {
      const finger = $e("tutorial-finger");
      if (!finger || !element) return;
      const rect = element.getBoundingClientRect();
      finger.style.display = "block";
      const targetX = rect.left + rect.width / 2 + window.scrollX;
      const targetY = rect.top + rect.height / 2 + window.scrollY;
      finger.style.left = targetX - 25 + "px";
      finger.style.top = targetY - 10 + "px";
      finger.style.animation = "fa45ClickAnim 1s infinite";
    }

    function hideFinger() {
      const finger = $e("tutorial-finger");
      if (finger) {
        finger.style.display = "none";
        finger.style.animation = "";
      }
    }

    function showIdleHint() {
      if (isAnimating || !alive) return;
      let target: HTMLElement | null = null;
      if (currentTutorialStep === 0) target = $e("frac1-group");
      else if (currentTutorialStep === 1) target = $e("frac2-group");
      else if (currentTutorialStep === 2) target = $e("main-bar-wrap");
      else if (currentTutorialStep === 3) target = $e("ans-num");
      if (target && target.style.display !== "none" && target.getBoundingClientRect().width > 0) {
        pointAtTarget(target);
      }
    }

    function setupHoverHints() {
      const triggers = [
        { id: "frac1-group", step: 0 },
        { id: "frac2-group", step: 1 },
        { id: "main-bar-wrap", step: 2 },
        { id: "bottom-answer-zone", step: 3 },
      ];
      triggers.forEach((t) => {
        const el = $e(t.id);
        if (!el) return;
        el.addEventListener("mouseenter", () => {
          if (currentTutorialStep === t.step && !isAnimating) {
            if (hoverTimer) clearTimeout(hoverTimer);
            hoverTimer = window.setTimeout(() => pointAtTarget(el), 1000);
            timers.push(hoverTimer);
          }
        });
        el.addEventListener("mouseleave", () => {
          if (hoverTimer) clearTimeout(hoverTimer);
          hideFinger();
          if (!isAnimating) {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = window.setTimeout(showIdleHint, 3000);
            timers.push(idleTimer);
          }
        });
      });
    }

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
    }

    function toggleNumberLine() {
      if (isPhase1OrLater) {
        const nlWrap = $e("bar1-nl");
        if (nlWrap) nlWrap.style.display = "none";
        $i("show-nl-cb")!.checked = false;
        return;
      }
      const maxW = maxWholesVar();
      renderNumberLine("bar1-nl", maxW, currentNL_D);
      const wrap = $e("main-bar-wrap")!;
      wrap.classList.add("continuous");
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
      if (d1 > 10) d1 = 10;
      if (d2 < 1) d2 = 1;
      if (d2 > 10) d2 = 10;
      if (n1 < 0) n1 = 0;
      if (n2 < 0) n2 = 0;
      if (w1 === 0 && n1 === 0) n1 = 1;
      if (w2 === 0 && n2 === 0) n2 = 1;

      return { w1, n1, d1, w2, n2, d2, total_n1: w1 * d1 + n1, total_n2: w2 * d2 + n2 };
    }

    function updateMaxWholes() {
      const vals = getSafeValues();
      const maxW = Math.max(
        1,
        Math.ceil(vals.total_n1 / vals.d1),
        Math.ceil((vals.total_n1 * vals.total_n2) / (vals.d1 * vals.d2)),
      );
      de.style.setProperty("--max-wholes", String(maxW));
      return maxW;
    }

    function updateUI() {
      const vals = getSafeValues();
      $i("d1")!.value = String(vals.d1);
      $i("d2")!.value = String(vals.d2);

      const wpEl = $e("word-problem")!;
      if (currentWordProblemTemplate) {
        const frac1Html = `<b>${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}</b>`;
        const frac2Html = `<b>${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}</b>`;
        wpEl.innerHTML = currentWordProblemTemplate.replace(/\[FRAC1\]/g, frac1Html).replace(/\[FRAC2\]/g, frac2Html);
        wpEl.style.display = "block";
      }

      isPhase1OrLater = false;
      awaitingRearrangeClick = false;
      currentTutorialStep = 0;
      isAnimating = false;
      isRearranged = false;
      hideFinger();
      if (idleTimer) clearTimeout(idleTimer);

      $e("bar1-row")!.style.display = "none";
      const wrap = $e("main-bar-wrap")!;
      wrap.innerHTML = "";
      wrap.style.cursor = "default";
      wrap.title = "";
      $e("bottom-answer-zone")!.style.display = "none";
      $e("bottom-answer-zone")!.style.opacity = "0";
      $e("drag-instruction")!.innerHTML = `💡 準備中...請先點擊上方的「被乘數」`;
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

    function renderNumberLine(wrapId: string, maxW: number, d: number) {
      const nlWrap = $e(wrapId);
      if (!nlWrap) return;
      const showNL = $i("show-nl-cb")!.checked;
      if (!showNL) {
        nlWrap.style.display = "none";
        return;
      }
      nlWrap.style.display = "flex";
      nlWrap.classList.add("continuous");
      nlWrap.innerHTML = "";
      for (let i = 0; i < maxW; i++) {
        const nlUnit = document.createElement("div");
        nlUnit.className = "nl-unit";
        let labelsHtml = "";
        for (let k = 0; k < d; k++) {
          const leftPct = (k / d) * 100;
          let valHtml = "";
          if (k === 0) {
            valHtml = `<span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i}</span>`;
          } else {
            const fracPart = `<div class="inline-frac" style="font-size:0.85em; color:var(--dark);"><span>${k}</span><div class="line"></div><span>${d}</span></div>`;
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
    }

    function onFrac1Click() {
      if (isAnimating) return;
      isPhase1OrLater = false;
      currentTutorialStep = 1;

      const vals = getSafeValues();
      const A = vals.total_n1;
      const B = vals.d1;
      const maxW = updateMaxWholes();

      $e("bar1-row")!.style.display = "flex";
      $e("bar1-row")!.classList.add("fade-in-slow");

      $e("label1")!.style.opacity = "1";
      $e("label1")!.innerHTML = getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)");

      const wrap = $e("main-bar-wrap")!;
      wrap.innerHTML = "";
      wrap.style.cursor = "default";
      wrap.title = "";

      for (let i = 0; i < maxW; i++) {
        const unit = document.createElement("div");
        unit.className = "bar-unit";
        for (let k = 1; k < B; k++) {
          const thickLine = document.createElement("div");
          thickLine.className = "abs-thick-line";
          thickLine.style.left = `${(k / B) * 100}%`;
          unit.appendChild(thickLine);
        }
        const startCol = i * B;
        const endCol = Math.min(startCol + B, A);
        for (let k = startCol; k < endCol; k++) {
          const block = document.createElement("div");
          block.className = "stage0-block";
          block.style.position = "absolute";
          block.style.left = `${((k - startCol) / B) * 100}%`;
          block.style.width = `${100 / B}%`;
          block.style.height = "100%";
          block.style.backgroundColor = "var(--red)";
          block.style.opacity = "0.85";
          unit.appendChild(block);
        }
        wrap.appendChild(unit);
      }

      currentNL_D = B;
      toggleNumberLine();

      $e("drag-instruction")!.innerHTML =
        `<span style="display:inline-block; background:var(--success); color:#fff; border-radius:12px; padding:2px 10px; font-size:0.95rem; margin-right:8px; vertical-align:middle;">步驟 1 / 5</span>` +
        `<span style="vertical-align:middle;">已顯示被乘數（紅）的長條圖。👉 點擊 × ${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")} 繼續</span>`;
      $e("bottom-answer-zone")!.style.display = "none";
      $e("bottom-answer-zone")!.style.opacity = "0";
    }

    // ---------- animation helpers ----------
    const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

    function setAnimStep(num: number, text: string) {
      const el = $e("drag-instruction");
      if (!el) return;
      el.innerHTML = `<span style="display:inline-block; background:var(--blue); color:#fff; border-radius:12px; padding:2px 10px; font-size:0.95rem; margin-right:8px; vertical-align:middle;">步驟 ${num} / 5</span><span style="color:var(--dark); font-weight:bold; vertical-align:middle;">${text}</span>`;
    }

    function makeGhost(rect: DOMRect) {
      const ghost = document.createElement("div");
      ghost.className = "fa45-ghost";
      ghost.style.position = "fixed";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      // 鬼影被掛在 document.body（.fa45-root 作用域之外），var(--red) 在此無定義，
      // 會導致背景透明、看不到移動中的紅色方塊，故用明確色碼。
      ghost.style.backgroundColor = "#e74c3c";
      ghost.style.opacity = "0.85";
      ghost.style.transition = "all 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
      ghost.style.zIndex = "100";
      ghost.style.pointerEvents = "none";
      return ghost;
    }

    function animateSubdivide(dashedLines: HTMLElement[], duration: number) {
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const loop = (now: number) => {
          if (!alive) {
            resolve();
            return;
          }
          const p = Math.min((now - start) / duration, 1);
          dashedLines.forEach((l) => (l.style.height = `${p * 100}%`));
          if (p < 1) requestAnimationFrame(loop);
          else resolve();
        };
        requestAnimationFrame(loop);
      });
    }

    function animateExtract(duration: number) {
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const loop = (now: number) => {
          if (!alive) {
            resolve();
            return;
          }
          const p = Math.min((now - start) / duration, 1);
          animBlocks.forEach((b) => {
            if (b.state === "discarded") b.el.style.opacity = `${0.85 * (1 - p)}`;
            else if (b.state === "added") b.el.style.opacity = `${0.85 * p}`;
            else b.el.style.opacity = "0.85";
          });
          if (p < 1) requestAnimationFrame(loop);
          else resolve();
        };
        requestAnimationFrame(loop);
      });
    }

    function rearrangeForward() {
      return new Promise<void>((resolve) => {
        const vals = getSafeValues();
        const slotsPerUnit = vals.d1 * vals.d2;
        preRearrangePositions = [];
        const ghosts: HTMLElement[] = [];

        animBlocks.forEach((b) => {
          const rect = b.el.getBoundingClientRect();
          preRearrangePositions.push({ left: b.el.style.left, unit: b.el.parentElement as HTMLElement });
          const ghost = makeGhost(rect);
          document.body.appendChild(ghost);
          ghosts.push(ghost);
          b.el.style.visibility = "hidden";
        });

        T(() => {
          ghosts.forEach((ghost, i) => {
            const unitIdx = Math.floor(i / slotsPerUnit);
            const rem = i % slotsPerUnit;
            const targetUnit = $e(`unit-${unitIdx}`);
            if (!targetUnit) return;
            const tRect = targetUnit.getBoundingClientRect();
            const targetLeft = tRect.left + rem * (tRect.width / slotsPerUnit);
            ghost.style.left = `${targetLeft}px`;
            ghost.style.top = `${tRect.top}px`;
          });
        }, 50);

        T(() => {
          animBlocks.forEach((b, i) => {
            const unitIdx = Math.floor(i / slotsPerUnit);
            const rem = i % slotsPerUnit;
            const targetUnit = $e(`unit-${unitIdx}`);
            if (targetUnit) targetUnit.appendChild(b.el);
            b.el.style.left = `${(rem / slotsPerUnit) * 100}%`;
            b.el.style.visibility = "visible";
          });
          ghosts.forEach((g) => g.remove());
          isRearranged = true;
          resolve();
        }, 650);
      });
    }

    function rearrangeBackward() {
      return new Promise<void>((resolve) => {
        const ghosts: HTMLElement[] = [];
        animBlocks.forEach((b) => {
          const rect = b.el.getBoundingClientRect();
          const ghost = makeGhost(rect);
          document.body.appendChild(ghost);
          ghosts.push(ghost);
          b.el.style.visibility = "hidden";
        });

        T(() => {
          ghosts.forEach((ghost, i) => {
            const orig = preRearrangePositions[i];
            orig.unit.appendChild(animBlocks[i].el);
            animBlocks[i].el.style.left = orig.left;
            const tRect = animBlocks[i].el.getBoundingClientRect();
            ghost.style.left = `${tRect.left}px`;
            ghost.style.top = `${tRect.top}px`;
          });
        }, 50);

        T(() => {
          animBlocks.forEach((b) => (b.el.style.visibility = "visible"));
          ghosts.forEach((g) => g.remove());
          isRearranged = false;
          resolve();
        }, 650);
      });
    }

    async function onFrac2Click() {
      if (isAnimating) return;
      const rowCheck = $e("bar1-row")!;
      if (rowCheck.style.display === "none") {
        onFrac1Click();
        T(onFrac2Click, 1600);
        return;
      }

      isAnimating = true;
      isPhase1OrLater = true;
      currentTutorialStep = 2;
      hideFinger();

      const nlCb = $i("show-nl-cb");
      if (nlCb) {
        nlCb.disabled = true;
        nlCb.checked = false;
      }
      $e("bar1-nl")!.style.display = "none";
      $e("label1")!.style.opacity = "0";

      const vals = getSafeValues();
      const A = vals.total_n1;
      const B = vals.d1;
      const C = vals.total_n2;
      const D = vals.d2;
      const maxW = updateMaxWholes();

      setAnimStep(2, "準備中...");

      const wrap = $e("main-bar-wrap")!;
      wrap.innerHTML = "";
      animBlocks = [];
      const dashedLines: HTMLElement[] = [];

      for (let i = 0; i < maxW; i++) {
        const unit = document.createElement("div");
        unit.className = "bar-unit";
        unit.id = `unit-${i}`;

        for (let k = 0; k < B * D; k++) {
          const globalIdx = i * B * D + k;
          let state = "empty";
          if (C <= D) {
            if (globalIdx < A * D) {
              const rem = globalIdx % D;
              state = rem < C ? "kept" : "discarded";
            }
          } else {
            if (globalIdx < A * D) state = "kept";
            else if (globalIdx < A * C) state = "added";
          }
          if (state !== "empty") {
            const block = document.createElement("div");
            block.className = "sub-block";
            block.style.position = "absolute";
            block.style.left = `${(k / (B * D)) * 100}%`;
            block.style.width = `${100 / (B * D)}%`;
            block.style.height = "100%";
            block.style.backgroundColor = "var(--red)";
            block.style.opacity = state === "added" ? "0" : "0.85";
            block.dataset.state = state;
            unit.appendChild(block);
            animBlocks.push({ el: block, state });
          }
        }

        for (let k = 1; k < B * D; k++) {
          if (k % D !== 0) {
            const thinLine = document.createElement("div");
            thinLine.className = "abs-thin-line";
            thinLine.style.left = `${(k / (B * D)) * 100}%`;
            thinLine.style.height = "0%";
            thinLine.style.borderLeft = "2px dashed var(--dark)";
            thinLine.style.background = "transparent";
            thinLine.style.transform = "translateX(-50%)";
            unit.appendChild(thinLine);
            dashedLines.push(thinLine);
          }
        }

        for (let k = 1; k < B; k++) {
          const thickLine = document.createElement("div");
          thickLine.className = "abs-thick-line";
          thickLine.style.left = `${(k / B) * 100}%`;
          unit.appendChild(thickLine);
        }

        wrap.appendChild(unit);
      }

      // Step 2: subdivide by multiplier's denominator
      setAnimStep(2, `引入乘數的分母 <b style="color:var(--blue)">${D}</b>，把被乘數的每一格平均再切分成 <b>${D}</b> 份`);
      await delay(500 / currentSpeed);
      if (!alive) return;
      await animateSubdivide(dashedLines, 1300 / currentSpeed);
      if (!alive) return;
      await delay(400 / currentSpeed);
      if (!alive) return;

      // Step 3: extract by multiplier's numerator
      if (C <= D) {
        setAnimStep(3, `依乘數的分子 <b style="color:var(--blue)">${C}</b>，從每 <b>${D}</b> 小格中提取 <b style="color:var(--red)">${C}</b> 格（其餘淡出）`);
      } else {
        setAnimStep(3, `乘數大於 1，補上不足的格子，共提取 <b style="color:var(--red)">${C}</b> 倍的份量`);
      }
      await animateExtract(1300 / currentSpeed);
      if (!alive) return;
      await delay(300 / currentSpeed);
      if (!alive) return;

      animBlocks = animBlocks.filter((b) => {
        if (b.state === "discarded") {
          b.el.remove();
          return false;
        }
        return true;
      });

      // Step 4: wait for user click to rearrange
      isAnimating = false;
      awaitingRearrangeClick = true;
      currentTutorialStep = 2;
      setAnimStep(4, `將提取出的紅色微細格子依序移動、整齊排列`);
      const wrap2 = $e("main-bar-wrap")!;
      wrap2.style.cursor = "pointer";
      wrap2.title = "點擊方塊整齊排列";
      pointAtTarget(wrap2);
    }

    function finishAnimation() {
      isAnimating = false;
      currentTutorialStep = 3;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = window.setTimeout(showIdleHint, 3000);
      timers.push(idleTimer);

      const nlCb = $i("show-nl-cb");
      if (nlCb) nlCb.disabled = false;

      const vals = getSafeValues();
      const A = vals.total_n1;
      const B = vals.d1;
      const C = vals.total_n2;
      const D = vals.d2;
      const resultD = B * D;
      const resultN = A * C;

      $e("drag-instruction")!.innerHTML =
        `<span style="display:inline-block; background:var(--success); color:#fff; border-radius:12px; padding:2px 10px; font-size:0.95rem; margin-right:8px; vertical-align:middle;">步驟 5 / 5</span>` +
        `<span style="color:var(--dark); font-weight:bold; vertical-align:middle;">數一數！紅色微細格子共 <b style="color:var(--red)">${resultN}</b> 格（分子）；每個整體分成 <b style="color:var(--blue)">${resultD}</b> 格（分母）。請填寫答案，也可點擊長條圖切換排列。</span>`;

      $e("bottom-answer-zone")!.style.display = "flex";
      T(() => ($e("bottom-answer-zone")!.style.opacity = "1"), 50);

      $e("bot-frac1")!.innerHTML = getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)");
      $e("bot-frac2")!.innerHTML = getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)");

      if (resultN >= resultD) {
        $e("ans-w")!.style.display = "inline-block";
      } else {
        $e("ans-w")!.style.display = "none";
      }

      $i("ans-w")!.value = "";
      $i("ans-num")!.value = "";
      $i("ans-den")!.value = "";
      $e("feedback")!.style.opacity = "0";

      const wrap = $e("main-bar-wrap")!;
      wrap.style.cursor = "pointer";
      wrap.title = "點擊方塊切換排列";
    }

    function toggleRearrange() {
      if (awaitingRearrangeClick) {
        awaitingRearrangeClick = false;
        hideFinger();
        isAnimating = true;
        isRearranging = true;
        rearrangeForward().then(() => {
          isRearranging = false;
          finishAnimation();
        });
        return;
      }

      if ($e("bottom-answer-zone")!.style.display !== "flex") return;
      if (isRearranging || isAnimating) return;

      isRearranging = true;
      if (!isRearranged) currentTutorialStep = 3;

      const action = isRearranged ? rearrangeBackward() : rearrangeForward();
      action.then(() => {
        isRearranging = false;
      });
    }

    function autoCheck() {
      currentTutorialStep = 4;
      hideFinger();

      const vals = getSafeValues();
      const ansNStr = $i("ans-num")!.value;
      const ansDStr = $i("ans-den")!.value;
      if (ansNStr === "" || ansDStr === "") return;

      const ansW = parseInt($i("ans-w")!.value) || 0;
      const ansN = parseInt(ansNStr);
      const ansD = parseInt(ansDStr);

      const userVal = ansW + ansN / ansD;
      const exactN = vals.total_n1 * vals.total_n2;
      const exactD = vals.d1 * vals.d2;
      const exactVal = exactN / exactD;

      const fb = $e("feedback")!;

      if (Math.abs(userVal - exactVal) < 0.0001) {
        const simpleN = exactN / gcd(exactN, exactD);
        const simpleD = exactD / gcd(exactN, exactD);
        const simpleW = Math.floor(simpleN / simpleD);
        const simpleMixedN = simpleN % simpleD;

        let isSimplest = false;
        if (ansW === simpleW && ansN === simpleMixedN && ansD === simpleD) isSimplest = true;
        else if (ansW === 0 && ansN === simpleN && ansD === simpleD) isSimplest = true;

        if (isSimplest) {
          fb.innerHTML = "🎉 完全正確！而且已經是最簡化的答案了！";
        } else {
          fb.innerHTML = '🌟 答對了數值！但試試看，這個答案可以再「約分」或「轉成帶分數」喔！';
        }
        fb.style.opacity = "1";
        fb.style.color = "var(--success)";
      } else {
        fb.innerHTML = "❌ 答案不對喔！請再觀察一下紅色的方塊總數。";
        fb.style.opacity = "1";
        fb.style.color = "var(--red)";
      }
    }

    function randomChallenge() {
      if (isAnimating) return;
      isPhase1OrLater = false;
      awaitingRearrangeClick = false;
      isRearranged = false;

      currentTutorialStep = 0;
      hideFinger();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = window.setTimeout(showIdleHint, 3000);
      timers.push(idleTimer);

      const showWhole = $i("show-whole-cb")!.checked;
      let w1 = 0;
      let w2 = 0;

      const d1 = Math.floor(Math.random() * 4) + 2;
      let n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
      const d2 = Math.floor(Math.random() * 4) + 2;
      let n2 = Math.floor(Math.random() * (d2 - 1)) + 1;

      if (showWhole) {
        w1 = Math.floor(Math.random() * 2);
        w2 = Math.floor(Math.random() * 2);
        if (w1 === 0 && n1 === 0) n1 = 1;
        if (w2 === 0 && n2 === 0) n2 = 1;
      }

      $i("w1")!.value = w1 ? String(w1) : "";
      $i("n1")!.value = String(n1);
      $i("d1")!.value = String(d1);
      $i("w2")!.value = w2 ? String(w2) : "";
      $i("n2")!.value = String(n2);
      $i("d2")!.value = String(d2);

      currentWordProblemTemplate = wordProblemTemplates[Math.floor(Math.random() * wordProblemTemplates.length)];

      updateUI();
      $e("bar1-row")!.style.display = "none";
      $e("drag-instruction")!.innerHTML = `💡 準備中...請先點擊上方的「被乘數」`;
      $e("bottom-answer-zone")!.style.display = "none";
      $e("word-problem")!.style.display = "block";
    }

    // ---------- bootstrap ----------
    const api: FA45Api = {
      toggleWholeNumber,
      toggleNumberLine,
      updateSpeed,
      randomChallenge,
      onFrac1Click,
      onFrac2Click,
      updateUI,
      autoCheck,
      toggleRearrange,
    };
    window.__FA45 = api;

    de.style.setProperty("--max-wholes", "1");
    de.style.setProperty("--anim-time", "0.6s");
    root.innerHTML = BODY_HTML;

    const finger = document.createElement("div");
    finger.id = "tutorial-finger";
    finger.textContent = "👆";
    Object.assign(finger.style, {
      position: "absolute",
      fontSize: "3.5rem",
      pointerEvents: "none",
      zIndex: "9999",
      display: "none",
      filter: "drop-shadow(2px 4px 6px rgba(0,0,0,0.3))",
      transition: "left 0.3s ease, top 0.3s ease",
      left: "0",
      top: "0",
    } as CSSStyleDeclaration);
    document.body.appendChild(finger);

    const onDocClick = () => {
      hideFinger();
      if (!isAnimating) {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = window.setTimeout(showIdleHint, 3000);
        timers.push(idleTimer);
      }
    };
    const onDocMove = () => {
      const f = $e("tutorial-finger");
      if (f && f.style.display !== "block" && !isAnimating) {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = window.setTimeout(showIdleHint, 3000);
        timers.push(idleTimer);
      }
    };
    const onDocKey = () => {
      hideFinger();
      if (!isAnimating) {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = window.setTimeout(showIdleHint, 3000);
        timers.push(idleTimer);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("mousemove", onDocMove);
    document.addEventListener("keydown", onDocKey);
    const onCtx = (e: Event) => e.preventDefault();
    root.addEventListener("contextmenu", onCtx);

    // window.onload sequence
    randomChallenge();
    setupHoverHints();

    return () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      if (idleTimer) clearTimeout(idleTimer);
      if (hoverTimer) clearTimeout(hoverTimer);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("mousemove", onDocMove);
      document.removeEventListener("keydown", onDocKey);
      root.removeEventListener("contextmenu", onCtx);
      document.getElementById("tutorial-finger")?.remove();
      document.querySelectorAll(".fa45-ghost").forEach((el) => el.remove());
      if (window.__FA45 === api) delete window.__FA45;
      de.style.removeProperty("--max-wholes");
      de.style.removeProperty("--anim-time");
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`fa45-root${embedded ? " embedded" : ""}`} ref={rootRef} />
    </>
  );
}
