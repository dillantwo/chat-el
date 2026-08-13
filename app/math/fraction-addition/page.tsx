"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 異分母分數加法 (Addition of fractions with unlike denominators).
 *
 * Ported from public/math/FractionApp-Addition.html (arith-common.css + nav.css +
 * FractionApp47.css + bar-component.css + FractionApp47.js).
 *
 * This tool is extremely imperative (HTML5 drag-and-drop, a tutorial-hand idle
 * animation, dynamically generated rows whose controls use inline onclick
 * handlers, and grid expand/simplify animations). Rather than rewrite ~2000
 * lines of drag logic declaratively, the original script is ported almost
 * verbatim into a single mount effect that:
 *   - scopes all CSS under `.fa47-root`
 *   - injects the tool markup into a ref'd container
 *   - exposes the handful of functions referenced by inline onclick attributes
 *     on `window.__FA47` so the generated markup keeps working
 *   - tracks timers / listeners / the tutorial hand and tears them all down on
 *     unmount so nothing leaks into the rest of the app
 *
 * NOTE: `--anim-time` and `--max-wholes` are intentionally kept on
 * document.documentElement (not `.fa47-root`) because the script reads
 * `--max-wholes` back via getComputedStyle(documentElement).
 */

const STYLES = `
.fa47-root{
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
.fa47-root *{ margin:0; padding:0; box-sizing:border-box; }
.fa47-root .container{ background:#fff; padding:20px 30px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.1);
  max-width:1000px; width:100%; box-sizing:border-box; overflow-x:hidden; }

/* nav */
.fa47-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fa47-root .header-left{ display:flex; align-items:center; gap:15px; }
.fa47-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fa47-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fa47-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fa47-root .checkbox-label{ display:flex; align-items:center; gap:6px; font-size:0.95rem; color:#333; cursor:pointer; user-select:none; font-weight:bold; }
.fa47-root .checkbox-label input[type=checkbox]{ cursor:pointer; width:16px; height:16px; accent-color:var(--nav-primary); }
.fa47-root .divider{ width:1px; height:18px; background:#ccc; }
.fa47-root .speed-ctrl{ display:flex; align-items:center; gap:8px; font-size:0.95rem; color:#333; font-weight:bold; }
.fa47-root .speed-ctrl input[type=range]{ width:80px; cursor:pointer; accent-color:var(--nav-primary); }
.fa47-root .lang-btn{ padding:6px 16px; border:2px solid var(--nav-gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--nav-gray); outline:none; transition:0.15s; transform:translateY(0); }
.fa47-root .lang-btn:active{ box-shadow:0 0 0 var(--nav-gray); transform:translateY(3px); }
.fa47-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }
.fa47-root .lang-btn.btn-random{ border-color:#9b59b6; color:#9b59b6; box-shadow:0 3px 0 #9b59b6; }
.fa47-root .lang-btn.btn-random:hover{ background:#9b59b6; color:#fff; }
.fa47-root .lang-btn.btn-random:active{ box-shadow:0 0 0 #9b59b6; transform:translateY(3px); background:#8e44ad; color:#fff; }

/* problem / formula */
.fa47-root .word-problem{ font-size:1.3rem; font-weight:bold; color:var(--dark); background:#e8f4f8; padding:15px 25px;
  border-radius:12px; border-left:6px solid var(--blue); margin-bottom:10px; width:100%; text-align:center;
  box-sizing:border-box; display:none; line-height:1.8; box-shadow:0 4px 6px rgba(0,0,0,0.05); }
.fa47-root .word-problem b{ color:var(--red); font-size:1.5rem; margin:0 5px; padding:2px 6px; background:#fff;
  border-radius:6px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1); display:inline-flex; align-items:center; }
.fa47-root .answer-zone{ padding:5px 0; text-align:center; color:var(--dark); display:flex; flex-direction:column; align-items:center; }
.fa47-root .formula{ display:flex; align-items:center; justify-content:center; gap:15px; font-size:2rem; flex-wrap:wrap; margin-bottom:0; }
.fa47-root .mixed-frac{ display:flex; align-items:center; gap:5px; cursor:pointer; padding:5px; border-radius:10px; transition:0.2s; }
.fa47-root .mixed-frac:hover{ background:#f0f0f0; }
.fa47-root .whole-input{ width:45px; height:50px; font-size:1.8rem; text-align:center; border-radius:8px; border:2px solid #ccc;
  outline:none; transition:0.3s; font-weight:bold; color:var(--dark); background:#fff; display:none; }
.fa47-root .whole-input:focus{ border-color:var(--blue); box-shadow:0 0 8px rgba(52,152,219,0.4); }
.fa47-root .frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; }
.fa47-root .frac-input{ width:55px; height:45px; font-size:1.5rem; text-align:center; border-radius:8px; font-weight:bold;
  color:var(--dark); transition:0.3s; outline:none; border:2px solid #ccc; background:#fff; }
.fa47-root .frac-text{ font-size:2rem; font-weight:bold; text-align:center; padding:0 10px; color:var(--dark); }
.fa47-root .frac-line{ width:100%; height:3px; background:var(--dark); margin:5px 0; }

/* animation zone */
.fa47-root .animation-zone{ width:100%; padding-top:5px; display:flex; flex-direction:column; align-items:center; position:relative; }
.fa47-root .instruction-text{ font-size:1.3rem; font-weight:bold; color:var(--dark); text-align:center; margin-bottom:10px;
  background:#fff4e6; padding:12px 25px; border-radius:12px; border-left:6px solid var(--orange); width:100%; max-width:850px;
  box-sizing:border-box; transition:opacity 0.5s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa47-root .inline-frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; font-weight:bold;
  line-height:1; margin:0 5px; position:relative; top:-0.1em; }
.fa47-root .inline-frac span{ font-size:1.1em; padding:1px 4px; }
.fa47-root .inline-frac .line{ height:2px; background-color:currentColor; width:100%; margin:2px 0; }
.fa47-root #anim-area{ width:100%; min-height:200px; position:relative; overflow:visible; margin-top:5px; display:flex; flex-direction:column; gap:20px; }

@keyframes fa47FadeInSlow { 0%{ opacity:0; transform:translateY(10px); } 100%{ opacity:1; transform:translateY(0); } }
.fa47-root .fade-in-slow{ animation:fa47FadeInSlow 1s ease-out forwards; }

.fa47-root .tool-btn{ background:#3498db; color:#fff; border:2px solid transparent; padding:8px 12px; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:1rem; transition:transform 0.1s, background 0.2s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa47-root .tool-btn:hover{ background:#2980b9; transform:scale(1.05); }
.fa47-root .tool-btn:active{ transform:scale(0.95); background:#1f618d; }

.fa47-root .bars-column{ width:70%; display:flex; flex-direction:column; }
.fa47-root .bar-wrap-container{ width:100%; display:flex; flex-wrap:wrap; gap:15px; justify-content:flex-start; align-items:center;
  background:transparent; border:none; min-height:60px; transition:0.5s ease; }
.fa47-root .bar-unit{ position:relative; height:50px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes));
  min-width:120px; flex:none; border:var(--bar-border-width) solid var(--bar-border-color); box-sizing:border-box;
  background:var(--bar-bg); border-radius:var(--bar-border-radius); overflow:hidden; }
.fa47-root .bar-fill{ height:100%; transition:width var(--anim-time) ease; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); }
.fa47-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; overflow:hidden; }
.fa47-root .abs-thick-line{ position:absolute; top:0; width:var(--grid-thick-width); height:100%; background:var(--grid-thick-color); transform:translateX(-50%); z-index:4; }
.fa47-root .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa47-root .bar-wrap-container.continuous{ gap:0 !important; }
.fa47-root .bar-wrap-container.continuous .bar-unit{ width:calc(100% / var(--max-wholes)) !important; border-right:none; border-radius:0; }
.fa47-root .bar-wrap-container.continuous .bar-unit:last-child{ border-right:var(--bar-border-width) solid var(--bar-border-color); border-top-right-radius:4px; border-bottom-right-radius:4px; }
.fa47-root .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:4px; border-bottom-left-radius:4px; }
.fa47-root .nl-wrap-container{ width:100%; display:flex; flex-wrap:wrap; justify-content:flex-start; align-items:flex-start;
  min-height:45px; margin-top:2px; border:none; position:relative; gap:15px; }
.fa47-root .nl-wrap-container.continuous{ gap:0 !important; }
.fa47-root .nl-unit{ position:relative; height:45px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes)); min-width:120px; flex:none; box-sizing:border-box; }
.fa47-root .nl-wrap-container.continuous .nl-unit{ width:calc(100% / var(--max-wholes)) !important; }

.fa47-root #bottom-answer-zone{ width:100%; max-width:650px; background:#fff8e1; padding:20px; border-radius:15px;
  border:2px dashed var(--red); margin-top:15px; display:none; flex-direction:column; align-items:center; gap:10px;
  box-shadow:0 4px 10px rgba(0,0,0,0.05); transition:opacity 0.5s; z-index:50; position:relative; }
.fa47-root .feedback-msg{ font-size:1.2rem; font-weight:bold; min-height:28px; margin-top:5px; opacity:0; transition:opacity 0.3s, color 0.3s; text-align:center; }
.fa47-root .drag-block{ transition:transform 0.1s, opacity 0.2s, box-shadow 0.2s; touch-action:manipulation; }
.fa47-root .drag-block:active{ transform:scale(0.95); }

/* Disabled: layout now scales proportionally via .scale-viewport instead of reflowing */
@media (max-width:0px){
  .fa47-root .header{ flex-direction:column; align-items:stretch; text-align:center; }
  .fa47-root .header-left{ justify-content:center; }
  .fa47-root .header-right{ justify-content:center; width:100%; }
  .fa47-root .controls-pill{ width:100%; justify-content:center; flex-wrap:wrap; }
  .fa47-root .title-badge{ font-size:1.1rem; }
  .fa47-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
  .fa47-root .container{ padding:15px; }
  .fa47-root .formula{ font-size:1.5rem; }
  .fa47-root .whole-input{ width:35px; height:40px; font-size:1.4rem; }
  .fa47-root .frac-input{ width:45px; height:35px; font-size:1.2rem; }
  .fa47-root .instruction-text, .fa47-root .word-problem{ font-size:1.1rem; padding:12px 15px; flex-wrap:wrap; }
  .fa47-root #bar1-row, .fa47-root #bar2-row{ flex-direction:column; height:auto !important; gap:10px; padding-bottom:10px; }
  .fa47-root .bars-column{ width:100% !important; }
  .fa47-root .bar-wrap-container, .fa47-root .nl-wrap-container{ justify-content:flex-start; }
  .fa47-root .bar-unit, .fa47-root .nl-unit{ min-width:80px; }
}

/* embedded (inside iframe) — 去除底層灰底並自適應父頁面，比照相等分數 */
.fa47-root.embedded{ background:transparent; padding:15px; }
.fa47-root.embedded .container{ box-shadow:none; border-radius:0; padding:1rem; }

/* Proportional scaling wrapper: keep the desktop layout intact and shrink the
   whole tool to fit narrow viewports instead of reflowing/stacking, so the
   擴分/約分 buttons never drop below the bars. */
.fa47-root .scale-viewport{ width:100%; display:flex; justify-content:center; align-items:flex-start; }
.fa47-root .scale-viewport > .container{ transform-origin:top center; flex:none; }
`;

const BODY_HTML = `
<div class="scale-viewport">
<div class="container">
  <div class="header">
    <div class="header-left">
      <div class="title-badge">分數相加</div>
    </div>
    <div class="header-right">
      <div class="controls-pill">
        <label class="checkbox-label">
          <input type="checkbox" id="show-whole-cb" onchange="window.__FA47.toggleWholeNumber()"> 顯示帶分數
        </label>
        <span class="divider"></span>
        <label class="checkbox-label">
          <input type="checkbox" id="show-nl-cb" onchange="window.__FA47.toggleNumberLine()" checked> 顯示數線
        </label>
        <span class="divider"></span>
        <div class="speed-ctrl">
          <label for="speed-slider">速度: <span id="speed-val" style="color: var(--blue);">1.0</span>x</label>
          <input type="range" id="speed-slider" min="0.5" max="3" step="0.1" value="1.0" oninput="window.__FA47.updateSpeed()">
        </div>
      </div>
      <button class="lang-btn btn-random" onclick="window.__FA47.randomChallenge()">🎲 隨機出題</button>
    </div>
  </div>

  <div id="word-problem" class="word-problem"></div>

  <div class="answer-zone">
    <div class="formula">
      <div class="mixed-frac" id="frac1-group" onclick="window.__FA47.onFrac1Click()">
        <input type="number" class="whole-input" id="w1" placeholder=" " min="0" max="10" oninput="window.__FA47.updateUI()" onchange="window.__FA47.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n1" value="1" min="1" max="100" oninput="window.__FA47.updateUI()" onchange="window.__FA47.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d1" value="2" min="1" max="100" oninput="window.__FA47.updateUI()" onchange="window.__FA47.updateUI()">
        </div>
      </div>
      <span>+</span>
      <div class="mixed-frac" id="frac2-group" onclick="window.__FA47.onFrac2Click()">
        <input type="number" class="whole-input" id="w2" placeholder=" " min="0" max="10" oninput="window.__FA47.updateUI()" onchange="window.__FA47.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n2" value="1" min="1" max="100" oninput="window.__FA47.updateUI()" onchange="window.__FA47.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d2" value="3" min="1" max="100" oninput="window.__FA47.updateUI()" onchange="window.__FA47.updateUI()">
        </div>
      </div>
    </div>
  </div>

  <div class="animation-zone" id="anim-zone">
    <div id="drag-instruction" class="instruction-text">💡 準備中...</div>
    <div id="anim-area"></div>

    <div id="bottom-answer-zone">
      <div id="bot-public-unit" style="font-size:1.2rem; color:var(--blue); margin-bottom:10px; font-weight:bold; background:#e8f4f8; padding:5px 15px; border-radius:8px;"></div>
      <div class="formula">
        <div id="bot-frac1"></div>
        <span>+</span>
        <div id="bot-frac2"></div>
        <span>=</span>
        <div class="mixed-frac" style="cursor: default;">
          <input type="number" class="whole-input" id="ans-w" placeholder=" " min="0" oninput="window.__FA47.autoCheck()">
          <div class="frac">
            <input type="number" class="frac-input" id="ans-num" placeholder="?" min="0" oninput="window.__FA47.autoCheck()">
            <div class="frac-line" style="background:#ccc;"></div>
            <input type="number" class="frac-input" id="ans-den" placeholder="?" min="1" oninput="window.__FA47.autoCheck()">
          </div>
        </div>
      </div>
      <div id="feedback" class="feedback-msg"></div>
    </div>
  </div>
</div>
</div>
`;

type FA47Api = {
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
    __FA47?: FA47Api;
  }
}

export default function FractionAdditionPage() {
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

    // ---------- state (mirrors the module-level vars in FractionApp47.js) ----------
    let currentWordProblemTemplate: string | null = null;
    let s1 = 1;
    let s2 = 1;
    let bar1Visible = false;
    let bar2Visible = false;
    let currentSpeed = 1.0;
    let bar3BlocksCount = 0;
    let isCommonDenomReady = false;
    let barErrorModeValue = 0;
    let moved1 = 0;
    let moved2 = 0;
    let mergedBlocks: { num: number; pieces: number }[] = [];

    let inactivityTimer: number | null = null;
    let hoverTimer: number | null = null;
    let tutorialInterval: number | null = null;
    let isTutorialRunning = false;
    let animationTimeouts: number[] = [];
    const timers: number[] = [];

    const delay = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      animationTimeouts.push(id);
      timers.push(id);
      return id;
    };
    const T = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      timers.push(id);
      return id;
    };
    const maxWholes = () =>
      parseInt(getComputedStyle(de).getPropertyValue("--max-wholes")) || 1;

    // ---------- tutorial hand ----------
    function stopTutorial() {
      if (tutorialInterval) clearInterval(tutorialInterval);
      animationTimeouts.forEach((t) => clearTimeout(t));
      animationTimeouts = [];
      isTutorialRunning = false;
      const hand = $e("tutorial-hand");
      if (hand) {
        hand.style.transition = "opacity 0.2s";
        hand.style.opacity = "0";
      }
    }

    function resetInactivityTimer(e?: Event) {
      stopTutorial();
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (hoverTimer) clearTimeout(hoverTimer);
      inactivityTimer = T(startTutorialAnimation, 3000);
      if (e && e.type === "mousemove" && e.target && (e.target as HTMLElement).closest) {
        if (
          (e.target as HTMLElement).closest(
            ".tool-btn, .mixed-frac, .drag-block, .bar-wrap-container, #bottom-answer-zone",
          )
        ) {
          hoverTimer = T(startTutorialAnimation, 1000);
        }
      }
    }

    function startTutorialAnimation() {
      if (isTutorialRunning) return;
      isTutorialRunning = true;
      runTutorialStep();
      tutorialInterval = window.setInterval(runTutorialStep, 4500);
    }

    function runTutorialStep() {
      const fb = $e("feedback");
      if (fb && fb.style.opacity === "1" && fb.style.color === "var(--success)") return;

      const vals = getSafeValues();
      const hand = $e("tutorial-hand");
      if (!hand) return;

      let startEl: HTMLElement | null = null;
      let endEl: HTMLElement | null = null;
      let action = "click";

      const totalNeeded = vals.total_n1 * s1 + vals.total_n2 * s2;

      if (!bar1Visible) {
        startEl = $e("frac1-group");
      } else if (!bar2Visible) {
        startEl = $e("frac2-group");
      } else if (!isCommonDenomReady) {
        const errorRow = $e("bar-error-row");
        if (errorRow && errorRow.style.display === "flex") {
          const cd1 = vals.d1 * s1;
          const cd2 = vals.d2 * s2;
          if (cd1 < cd2) {
            const btns = document.querySelectorAll("#bar1-row .tool-btn");
            if (btns.length > 0) startEl = btns[0] as HTMLElement;
          } else {
            const btns = document.querySelectorAll("#bar2-row .tool-btn");
            if (btns.length > 0) startEl = btns[0] as HTMLElement;
          }
        } else {
          startEl =
            (document.querySelector("#bar1-wrap .drag-block") as HTMLElement) ||
            (document.querySelector("#bar2-wrap .drag-block") as HTMLElement);
          if (startEl) {
            endEl = startEl.closest("#bar1-wrap") ? $e("bar2-wrap") : $e("bar1-wrap");
            action = "drag";
          }
        }
      } else if (isCommonDenomReady && bar3BlocksCount < totalNeeded) {
        startEl =
          (document.querySelector("#bar1-wrap .drag-block") as HTMLElement) ||
          (document.querySelector("#bar2-wrap .drag-block") as HTMLElement);
        endEl = $e("bar3-wrap");
        action = "drag";
      } else if (isCommonDenomReady && bar3BlocksCount === totalNeeded) {
        startEl = $e("ans-num");
        if (!startEl || startEl.style.display === "none") return;
      }

      if (!startEl) return;

      const startRect = startEl.getBoundingClientRect();
      const startX = startRect.left + startRect.width / 2 + window.scrollX;
      const startY = startRect.top + startRect.height / 2 + window.scrollY;

      hand.style.transition = "none";
      hand.style.left = `${startX}px`;
      hand.style.top = `${startY}px`;
      hand.style.transform = "translate(-20%, -10%) scale(1)";
      hand.style.opacity = "1";

      void hand.offsetWidth;

      if (action === "click") {
        hand.style.transition = "transform 0.5s ease";
        delay(() => (hand.style.transform = "translate(-20%, -10%) scale(0.8)"), 1000);
        delay(() => (hand.style.transform = "translate(-20%, -10%) scale(1)"), 1500);
        delay(() => (hand.style.opacity = "0"), 3000);
      } else if (action === "drag" && endEl) {
        const endRect = endEl.getBoundingClientRect();
        const endX = endRect.left + endRect.width / 2 + window.scrollX;
        const endY = endRect.top + endRect.height / 2 + window.scrollY;
        delay(() => {
          hand.style.transition = "transform 0.4s ease";
          hand.style.transform = "translate(-20%, -10%) scale(0.8)";
          delay(() => {
            hand.style.transition =
              "left 1.2s cubic-bezier(0.25, 1, 0.5, 1), top 1.2s cubic-bezier(0.25, 1, 0.5, 1), transform 0.4s";
            hand.style.left = `${endX}px`;
            hand.style.top = `${endY}px`;
            delay(() => {
              hand.style.transform = "translate(-20%, -10%) scale(1)";
              delay(() => (hand.style.opacity = "0"), 400);
            }, 1200);
          }, 400);
        }, 1000);
      }
    }

    const wordProblemTemplates = [
      "小明吃了 [FRAC1] 塊披薩，小紅吃了 [FRAC2] 塊。請問他們共吃了多少塊披薩？",
      "第一塊農田面積為 [FRAC1] 公頃，第二塊為 [FRAC2] 公頃。請問兩塊農田的面積共是多少公頃？",
      "媽媽買了 [FRAC1] 公斤的蘋果和 [FRAC2] 公斤的橘子。請問水果總共有多少公斤？",
      "水桶裡原有 [FRAC1] 公升的水，又加入了 [FRAC2] 公升。請問現在水桶裡共有多少公升的水？",
      "紅彩帶長 [FRAC1] 公尺，藍彩帶長 [FRAC2] 公尺。請問兩條彩帶接在一起共長多少公尺？",
    ];

    // ---------- controls ----------
    function toggleWholeNumber() {
      const showWhole = ($i("show-whole-cb") as HTMLInputElement).checked;
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
      const showNL = $i("show-nl-cb")!.checked;
      ["bar1-nl", "bar2-nl", "bar3-nl", "bar-error-nl"].forEach((id) => {
        const nlWrap = $e(id);
        if (nlWrap && nlWrap.innerHTML.trim() !== "") {
          nlWrap.style.display = showNL ? "flex" : "none";
        }
      });
      if (showNL) {
        if (bar1Visible) {
          const nl1 = $e("bar1-nl");
          if (nl1 && nl1.innerHTML.trim() === "") renderBar(1, "none");
        }
        if (bar2Visible) {
          const nl2 = $e("bar2-nl");
          if (nl2 && nl2.innerHTML.trim() === "") renderBar(2, "none");
        }
        const vals = getSafeValues();
        const cd1 = vals.d1 * s1;
        const bar3Row = $e("bar3-row");
        if (bar3Row && bar3Row.style.display !== "none" && isCommonDenomReady) {
          renderBar3NumberLine(cd1);
        }
      }
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
      let maxW = Math.max(wholes1, wholes2);
      const sumN = vals.total_n1 * vals.d2 + vals.total_n2 * vals.d1;
      const sumD = vals.d1 * vals.d2;
      const wholesSum = Math.max(1, Math.ceil(sumN / sumD));
      maxW = Math.max(maxW, wholesSum);
      de.style.setProperty("--max-wholes", String(maxW));
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
      moved1 = 0;
      moved2 = 0;
      bar3BlocksCount = 0;
      mergedBlocks = [];
      isCommonDenomReady = false;
      const bar3Row = $e("bar3-row");
      if (bar3Row) bar3Row.style.display = "none";
      const botZone = $e("bottom-answer-zone");
      if (botZone) {
        botZone.style.display = "none";
        botZone.style.opacity = "0";
      }
      if (bar2Visible) renderBar(2, "none");
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
      moved1 = 0;
      moved2 = 0;
      bar3BlocksCount = 0;
      mergedBlocks = [];
      isCommonDenomReady = false;
      const bar3Row = $e("bar3-row");
      if (bar3Row) bar3Row.style.display = "none";
      const botZone = $e("bottom-answer-zone");
      if (botZone) {
        botZone.style.display = "none";
        botZone.style.opacity = "0";
      }
      if (bar1Visible) renderBar(1, "none");
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
        moved1 = 0;
        moved2 = 0;
        bar3BlocksCount = 0;
        mergedBlocks = [];
        isCommonDenomReady = false;
        const bar3Row = $e("bar3-row");
        if (bar3Row) bar3Row.style.display = "none";
        const botZone = $e("bottom-answer-zone");
        if (botZone) {
          botZone.style.display = "none";
          botZone.style.opacity = "0";
        }
        const other_num = num === 1 ? 2 : 1;
        if ((num === 1 && bar2Visible) || (num === 2 && bar1Visible)) {
          renderBar(other_num, "none");
        }
        renderBar(num, action, old_s);
        T(checkCommonDenom, 650 / currentSpeed);
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

      for (let k = 1; k < d; k++) {
        html += `<div class="abs-thick-line" style="left: ${(k / d) * 100}%;"></div>`;
      }

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
        units.forEach((unit, idx) => {
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
        if (showNL) {
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

    function renderBar3NumberLine(cd: number) {
      const nlWrap = $e("bar3-nl");
      if (!nlWrap) return;
      const showNL = $i("show-nl-cb")!.checked;
      if (!showNL || !isCommonDenomReady) {
        nlWrap.style.display = "none";
        nlWrap.innerHTML = "";
        return;
      }
      nlWrap.style.display = "flex";
      nlWrap.classList.add("continuous");
      nlWrap.innerHTML = "";
      const maxW = maxWholes();

      for (let i = 0; i < maxW; i++) {
        const nlUnit = document.createElement("div");
        nlUnit.className = "nl-unit";
        let labelsHtml = "";
        for (let k = 0; k < cd; k++) {
          const totalIdx = i * cd + k;
          const leftPct = (k / cd) * 100;
          const isCurrentCount = totalIdx === bar3BlocksCount;
          const showLabel = totalIdx <= bar3BlocksCount;
          let valHtml = "";
          if (showLabel) {
            const labelColor = isCurrentCount && totalIdx !== 0 ? "var(--red)" : "var(--dark)";
            const labelScale =
              isCurrentCount && totalIdx !== 0
                ? "transform: scale(1.15); font-weight: bold; transition: 0.3s;"
                : "transition: 0.3s;";
            if (k === 0) {
              valHtml = `<span style="font-weight:bold; font-size:1.1rem; color:${labelColor}; ${labelScale}">${i}</span>`;
            } else {
              const fracPart = `<div class="inline-frac" style="font-size:0.85em; color:${labelColor}; ${labelScale}"><span>${k}</span><div class="line"></div><span>${cd}</span></div>`;
              if (i > 0) {
                valHtml = `<div style="display: flex; align-items: center; justify-content: center;"><span style="font-weight:bold; font-size:1.05rem; margin-right:2px; color:${labelColor}; ${labelScale}">${i}</span>${fracPart}</div>`;
              } else {
                valHtml = fracPart;
              }
            }
          }
          const tickColor = totalIdx <= bar3BlocksCount && totalIdx !== 0 ? "var(--red)" : "var(--dark)";
          const tickHeight = isCurrentCount && totalIdx !== 0 ? "8px" : "6px";
          const tickWidth = isCurrentCount && totalIdx !== 0 ? "3px" : "2px";
          const zIndex = isCurrentCount ? 10 : 5;
          labelsHtml += `<div style="position: absolute; left: ${leftPct}%; top: 0px; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: ${zIndex};">
              <div style="width: ${tickWidth}; height: ${tickHeight}; background: ${tickColor}; margin-bottom: 2px; transition: 0.3s;"></div>
              ${valHtml}
          </div>`;
        }
        if (i === maxW - 1) {
          const maxTotalIdx = maxW * cd;
          const isCurrentCount = maxTotalIdx === bar3BlocksCount;
          const showLabel = maxTotalIdx <= bar3BlocksCount;
          let valHtml = "";
          if (showLabel) {
            const labelColor = isCurrentCount ? "var(--red)" : "var(--dark)";
            const labelScale = isCurrentCount
              ? "transform: scale(1.15); font-weight: bold; transition: 0.3s;"
              : "transition: 0.3s;";
            valHtml = `<span style="font-weight:bold; font-size:1.1rem; color:${labelColor}; ${labelScale}">${maxW}</span>`;
          }
          const tickColor = maxTotalIdx <= bar3BlocksCount ? "var(--red)" : "var(--dark)";
          const tickHeight = isCurrentCount ? "8px" : "6px";
          const tickWidth = isCurrentCount ? "3px" : "2px";
          const zIndex = isCurrentCount ? 10 : 5;
          labelsHtml += `<div style="position: absolute; left: 100%; top: 0px; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: ${zIndex};">
              <div style="width: ${tickWidth}; height: ${tickHeight}; background: ${tickColor}; margin-bottom: 2px; transition: 0.3s;"></div>
              ${valHtml}
          </div>`;
        }
        nlUnit.innerHTML = labelsHtml;
        nlWrap.appendChild(nlUnit);
      }
    }

    function updateDragDropState(cd: number) {
      convertBarToDraggable(1, cd, "var(--red)", moved1);
      convertBarToDraggable(2, cd, "var(--blue)", moved2);
      renderBar3Draggable(cd);
    }

    function convertBarToDraggable(num: number, cd: number, color: string, movedPieces = 0) {
      const wrap = $e(`bar${num}-wrap`)!;
      const units = wrap.querySelectorAll(".bar-unit");
      const vals = getSafeValues();
      const total_n = num === 1 ? vals.total_n1 : vals.total_n2;
      const s = num === 1 ? s1 : s2;
      const remaining_pieces = total_n * s - movedPieces;

      units.forEach((unitEl, uIdx) => {
        const unit = unitEl as HTMLElement;
        unit.querySelectorAll(".drag-block").forEach((b) => b.remove());
        const fill = unit.querySelector(".bar-fill") as HTMLElement | null;
        if (fill) fill.style.display = "none";
        unit.style.display = "flex";
        unit.style.flexDirection = "row";
        const pieces_in_this_unit = Math.max(0, Math.min(cd, remaining_pieces - uIdx * cd));
        const grid = unit.querySelector(".bar-grid") as HTMLElement | null;

        if (pieces_in_this_unit === cd || !isCommonDenomReady) {
          const block = document.createElement("div");
          block.className = "drag-block";
          block.id = `drag-${num}-${uIdx}-whole`;
          block.style.width = `${(pieces_in_this_unit / cd) * 100}%`;
          block.style.height = "100%";
          block.style.backgroundColor = color;
          block.style.opacity = "0.85";
          block.draggable = true;
          block.style.cursor = "grab";
          block.style.position = "relative";
          block.style.boxSizing = "border-box";
          block.style.borderRight =
            isCommonDenomReady && pieces_in_this_unit === cd ? "1px solid rgba(255,255,255,0.4)" : "none";
          block.style.zIndex = "1";
          block.setAttribute("data-pieces", String(pieces_in_this_unit));
          block.ondragstart = (e: DragEvent) => {
            const dragData = JSON.stringify({ source_num: num, pieces: pieces_in_this_unit });
            e.dataTransfer!.setData("text/plain", dragData);
            setTimeout(() => (block.style.opacity = "0.4"), 0);
          };
          block.ondragend = () => {
            if (block.draggable) block.style.opacity = "0.85";
          };
          block.onclick = () => {
            if (block.draggable) {
              if (isCommonDenomReady) {
                if (num === 1) moved1 += pieces_in_this_unit;
                else moved2 += pieces_in_this_unit;
                mergedBlocks.push({ num, pieces: pieces_in_this_unit });
                updateDragDropState(cd);
              } else triggerErrorMerge();
            }
          };
          if (pieces_in_this_unit > 0) {
            if (grid) unit.insertBefore(block, grid);
            else unit.appendChild(block);
          }
        } else {
          const pieceWidth = 100 / cd;
          for (let i = 0; i < pieces_in_this_unit; i++) {
            const block = document.createElement("div");
            block.className = "drag-block";
            block.id = `drag-${num}-${uIdx}-${i}`;
            block.style.width = `${pieceWidth}%`;
            block.style.height = "100%";
            block.style.backgroundColor = color;
            block.style.opacity = "0.85";
            block.draggable = true;
            block.style.cursor = "grab";
            block.style.position = "relative";
            block.style.boxSizing = "border-box";
            block.style.borderRight = isCommonDenomReady ? "1px solid rgba(255,255,255,0.4)" : "none";
            block.style.zIndex = "1";
            block.setAttribute("data-pieces", "1");
            block.ondragstart = (e: DragEvent) => {
              const dragData = JSON.stringify({ source_num: num, pieces: 1 });
              e.dataTransfer!.setData("text/plain", dragData);
              setTimeout(() => (block.style.opacity = "0.4"), 0);
            };
            block.ondragend = () => {
              if (block.draggable) block.style.opacity = "0.85";
            };
            block.onclick = () => {
              if (block.draggable) {
                if (isCommonDenomReady) {
                  if (num === 1) moved1 += 1;
                  else moved2 += 1;
                  mergedBlocks.push({ num, pieces: 1 });
                  updateDragDropState(cd);
                } else triggerErrorMerge();
              }
            };
            if (grid) unit.insertBefore(block, grid);
            else unit.appendChild(block);
          }
        }
      });
    }

    function renderBar3Draggable(cd: number) {
      const wrap3 = $e("bar3-wrap")!;
      const units = wrap3.querySelectorAll(".bar-unit");
      units.forEach((unit) => {
        unit.querySelectorAll(".drag-block").forEach((b) => b.remove());
      });

      bar3BlocksCount = moved1 + moved2;

      let currentUnitIdx = 0;
      let spaceInCurrentUnit = cd;

      for (let i = 0; i < mergedBlocks.length; i++) {
        const mBlock = mergedBlocks[i];
        let piecesRemaining = mBlock.pieces;
        const color = mBlock.num === 1 ? "var(--red)" : "var(--blue)";

        while (piecesRemaining > 0) {
          if (currentUnitIdx >= units.length) break;
          const unit = units[currentUnitIdx] as HTMLElement;
          const grid = unit.querySelector(".bar-grid") as HTMLElement | null;
          const piecesToPlace = Math.min(piecesRemaining, spaceInCurrentUnit);

          const block = document.createElement("div");
          block.className = "drag-block";
          block.style.width = `${(piecesToPlace / cd) * 100}%`;
          block.style.height = "100%";
          block.style.backgroundColor = color;
          block.style.opacity = "1";
          block.style.borderRight = "1px solid rgba(255,255,255,0.2)";
          block.style.position = "relative";
          block.style.boxSizing = "border-box";
          block.style.zIndex = "1";
          block.style.cursor = "pointer";

          const targetIndex = i;
          block.onclick = () => {
            const removed = mergedBlocks.splice(targetIndex, 1)[0];
            if (removed.num === 1) moved1 -= removed.pieces;
            else moved2 -= removed.pieces;
            updateDragDropState(cd);
          };

          if (grid) unit.insertBefore(block, grid);
          else unit.appendChild(block);

          piecesRemaining -= piecesToPlace;
          spaceInCurrentUnit -= piecesToPlace;
          if (spaceInCurrentUnit === 0) {
            currentUnitIdx++;
            spaceInCurrentUnit = cd;
          }
        }
      }

      renderBar3NumberLine(cd);
      const vals = getSafeValues();
      const totalNeeded = vals.total_n1 * s1 + vals.total_n2 * s2;
      checkAllDropped(totalNeeded);
    }

    function triggerErrorMerge() {
      const errorRow = $e("bar-error-row")!;
      errorRow.style.display = "flex";
      errorRow.classList.remove("fade-in-slow");
      void errorRow.offsetWidth;
      errorRow.classList.add("fade-in-slow");

      const wrapError = $e("bar-error-wrap")!;
      wrapError.innerHTML = "";
      wrapError.classList.add("continuous");

      const vals = getSafeValues();
      const maxW = maxWholes();

      for (let i = 0; i < maxW; i++) {
        const unit = document.createElement("div");
        unit.className = "bar-unit";
        unit.style.display = "flex";
        unit.style.flexDirection = "row";
        wrapError.appendChild(unit);
      }

      const labelError = $e("label-error")!;
      labelError.innerHTML = `<div style="display:inline-flex; align-items:center;">${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}<span style="margin: 0 5px;">+</span>${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}</div><span style="font-size:0.8rem; color:var(--red); margin-top:5px;">(分母不同，無格線)</span>`;

      const nlWrap = $e("bar-error-nl");
      if (nlWrap) {
        const showNL = $i("show-nl-cb")!.checked;
        nlWrap.style.display = showNL ? "flex" : "none";
        nlWrap.innerHTML = "";
        const val1 = (vals.w1 * vals.d1 + vals.n1) / vals.d1;
        const val2 = (vals.w2 * vals.d2 + vals.n2) / vals.d2;
        const sumVal = val1 + val2;

        for (let i = 0; i < maxW; i++) {
          const nlUnit = document.createElement("div");
          nlUnit.className = "nl-unit";
          let labelsHtml = "";
          const addTick = (val: number, htmlStr: string, isMajor = false, zIndex = 10) => {
            const leftPct = (val - i) * 100;
            const tickHeight = isMajor ? "8px" : "6px";
            labelsHtml += `<div style="position: absolute; left: ${leftPct}%; top: 0px; transform: translateX(-50%); display: flex; align-items: center; justify-content: flex-start; flex-direction: column; z-index: ${zIndex};">
                <div style="width: 2px; height: ${tickHeight}; background: var(--dark); margin-bottom: 2px;"></div>
                ${htmlStr}
            </div>`;
          };
          if (i === 0) {
            addTick(0, `<span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">0</span>`, true, 5);
          }
          addTick(i + 1, `<span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i + 1}</span>`, true, 5);
          if (val1 > i && val1 < i + 1) {
            addTick(val1, getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)"), false, 10);
          }
          if (sumVal > i && sumVal < i + 1) {
            const f1Html = getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)");
            const f2Html = getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)");
            const sumText = `<div style="display:flex; align-items:center; gap:3px; white-space:nowrap;">${f1Html} <span style="color:var(--dark);">+</span> ${f2Html}</div>`;
            addTick(sumVal, sumText, false, 10);
          }
          nlUnit.innerHTML = labelsHtml;
          nlWrap.appendChild(nlUnit);
        }
      }

      barErrorModeValue = 0;
      const blocks = document.querySelectorAll(".drag-block");
      blocks.forEach((block) => {
        const b = block as HTMLElement;
        if (b.id && b.id.startsWith("drag-1")) moveToBarErrorMode(b);
      });
      blocks.forEach((block) => {
        const b = block as HTMLElement;
        if (b.id && b.id.startsWith("drag-2")) moveToBarErrorMode(b);
      });

      $e("drag-instruction")!.innerHTML = `💡 發現了嗎？因為「分母」不相同，無法用相同的格線算出來。<br>請試著在上方的算式點擊「擴分/約分」尋找公共的分母！`;
    }

    function moveToBarErrorMode(block: HTMLElement) {
      const num = block.id.split("-")[1];
      const cd = num === "1" ? getSafeValues().d1 * s1 : getSafeValues().d2 * s2;
      const pieces = parseInt(block.getAttribute("data-pieces") || "1") || 1;
      const blockVal = pieces / cd;

      let remainingValToPlace = blockVal;
      while (remainingValToPlace > 0.0001) {
        const targetUnitIdx = Math.floor(barErrorModeValue);
        const currentUnitFilled = barErrorModeValue - targetUnitIdx;
        const spaceInUnit = 1.0 - currentUnitFilled;
        const valToPlaceNow = Math.min(remainingValToPlace, spaceInUnit);
        const wrapError = $e("bar-error-wrap")!;
        const targetUnit = wrapError.querySelectorAll(".bar-unit")[targetUnitIdx] as HTMLElement | undefined;
        if (targetUnit) {
          const pieceNode = document.createElement("div");
          pieceNode.style.width = `${valToPlaceNow * 100}%`;
          pieceNode.style.height = "100%";
          pieceNode.style.backgroundColor = block.style.backgroundColor;
          pieceNode.style.opacity = "1";
          pieceNode.style.borderRight = "none";
          pieceNode.style.position = "relative";
          pieceNode.style.boxSizing = "border-box";
          pieceNode.style.zIndex = "1";
          targetUnit.appendChild(pieceNode);
        }
        barErrorModeValue += valToPlaceNow;
        remainingValToPlace -= valToPlaceNow;
      }
    }

    function setupDragAndDrop(cd1: number, cd2: number) {
      const row3 = $e("bar3-row")!;
      const wrap3 = $e("bar3-wrap")!;
      const wrap1 = $e("bar1-wrap")!;
      const wrap2 = $e("bar2-wrap")!;
      const wrapError = $e("bar-error-wrap");
      const maxW = maxWholes();

      if (isCommonDenomReady) {
        const isFirstShow = row3.style.display !== "flex";
        row3.style.display = "flex";
        if (isFirstShow) {
          row3.classList.remove("fade-in-slow");
          void row3.offsetWidth;
          row3.classList.add("fade-in-slow");
        }
        wrap3.style.outline = "3px dashed var(--orange)";
        wrap3.style.backgroundColor = "#fafafa";
        wrap3.innerHTML = "";
        wrap3.classList.add("continuous");
        for (let i = 0; i < maxW; i++) {
          const unit = document.createElement("div");
          unit.className = "bar-unit";
          unit.style.display = "flex";
          unit.style.flexDirection = "row";
          const grid = document.createElement("div");
          grid.className = "bar-grid";
          unit.appendChild(grid);
          wrap3.appendChild(unit);
        }
        const label3 = $e("label3")!;
        label3.innerHTML = `合併結果<span style="font-size:0.8rem; color:var(--orange); margin-top:5px;">(點擊或拖拉)</span>`;
        wrap3.querySelectorAll(".bar-grid").forEach((gridContainer) => {
          applyGridAnimation(gridContainer as HTMLElement, cd1, 1, 1, "none");
        });
        moved1 = 0;
        moved2 = 0;
        mergedBlocks = [];
        updateDragDropState(cd1);

        wrap3.ondragover = (e: DragEvent) => {
          e.preventDefault();
          wrap3.style.backgroundColor = "#eef9f1";
        };
        wrap3.ondragleave = () => {
          wrap3.style.backgroundColor = "#fafafa";
        };
        wrap3.ondrop = (e: DragEvent) => {
          e.preventDefault();
          wrap3.style.backgroundColor = "#fafafa";
          const rawData = e.dataTransfer!.getData("text/plain");
          if (!rawData) return;
          try {
            const data = JSON.parse(rawData);
            const num = parseInt(data.source_num);
            const pieces = parseInt(data.pieces);
            if (isNaN(num) || isNaN(pieces)) return;
            if (num === 1) moved1 += pieces;
            else if (num === 2) moved2 += pieces;
            else return;
            mergedBlocks.push({ num, pieces });
            updateDragDropState(cd1);
          } catch (err) {
            console.error("Drop Data Error:", err);
          }
        };
        wrap1.ondragover = null;
        wrap1.ondrop = null;
        wrap1.ondragleave = null;
        wrap2.ondragover = null;
        wrap2.ondrop = null;
        wrap2.ondragleave = null;
        if (wrapError) {
          wrapError.ondragover = null;
          wrapError.ondrop = null;
          wrapError.ondragleave = null;
        }
      } else {
        row3.style.display = "none";
        convertBarToDraggable(1, cd1, "var(--red)", 0);
        convertBarToDraggable(2, cd2, "var(--blue)", 0);
        const dragOverHandler = (e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).style.opacity = "0.7";
        };
        const dragLeaveHandler = (e: DragEvent) => {
          (e.currentTarget as HTMLElement).style.opacity = "1";
        };
        const dropHandler = (e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).style.opacity = "1";
          triggerErrorMerge();
        };
        wrap1.ondragover = dragOverHandler;
        wrap1.ondragleave = dragLeaveHandler;
        wrap1.ondrop = dropHandler;
        wrap2.ondragover = dragOverHandler;
        wrap2.ondragleave = dragLeaveHandler;
        wrap2.ondrop = dropHandler;
        if (wrapError) {
          wrapError.ondragover = dragOverHandler;
          wrapError.ondragleave = dragLeaveHandler;
          wrapError.ondrop = dropHandler;
        }
      }
    }

    function checkAllDropped(totalNeeded: number) {
      if (!isCommonDenomReady) return;

      if (bar3BlocksCount === totalNeeded && totalNeeded !== 0) {
        const vals = getSafeValues();
        const cd1 = vals.d1 * s1;

        $e("bottom-answer-zone")!.style.display = "flex";
        T(() => ($e("bottom-answer-zone")!.style.opacity = "1"), 50);

        $e("bot-frac1")!.innerHTML = getDisplayHtml(vals.w1, vals.n1 * s1, cd1, "var(--red)");
        $e("bot-frac2")!.innerHTML = getDisplayHtml(vals.w2, vals.n2 * s2, cd1, "var(--blue)");
        $e("bar3-wrap")!.style.outline = "3px solid transparent";

        const exactN = vals.total_n1 * vals.d2 + vals.total_n2 * vals.d1;
        const exactD = vals.d1 * vals.d2;

        let hint = "";
        if (exactN >= exactD) {
          $e("ans-w")!.style.display = "inline-block";
          hint = " (可填帶分數或假分數)";
        } else {
          $e("ans-w")!.style.display = "none";
          $i("ans-w")!.value = "";
        }

        $e("bot-public-unit")!.innerHTML = `💡 公共分數單位為： <b style="display:inline-flex; align-items:center; vertical-align:middle;">${getFracHtml(1, cd1, "var(--dark)")}</b>`;
        $e("drag-instruction")!.innerHTML = `💡 太棒了！全部合併完成，請填寫下方最終答案！${hint}`;

        const bar1Row = $e("bar1-row");
        const bar2Row = $e("bar2-row");
        const bar3Wrap = $e("bar3-wrap");
        const errorWrap = $e("bar-error-wrap");

        if (bar3Wrap) bar3Wrap.style.pointerEvents = "none";
        if (errorWrap) errorWrap.style.pointerEvents = "none";

        [bar1Row, bar2Row].forEach((row) => {
          if (row) {
            row.classList.remove("fade-in-slow");
            row.style.transition = "opacity 0.8s ease-in-out";
            row.style.opacity = "0";
            row.style.pointerEvents = "none";
            T(() => (row.style.display = "none"), 800);
          }
        });
      } else {
        $e("bar3-wrap")!.style.outline = "3px dashed var(--orange)";
        $e("bottom-answer-zone")!.style.opacity = "0";
        T(() => {
          if (bar3BlocksCount !== totalNeeded) {
            $e("bottom-answer-zone")!.style.display = "none";
          }
        }, 300);
        $e("drag-instruction")!.innerHTML = `💡 分母相同了！請將上方的色塊「拖拉」或「點擊」到下方合併結果區。`;
      }
    }

    function checkCommonDenom() {
      if (!bar1Visible || !bar2Visible) return;
      const vals = getSafeValues();
      const cd1 = vals.d1 * s1;
      const cd2 = vals.d2 * s2;

      isCommonDenomReady = cd1 === cd2 && cd1 > 0;
      setupDragAndDrop(cd1, cd2);

      $e("bottom-answer-zone")!.style.opacity = "0";
      T(() => ($e("bottom-answer-zone")!.style.display = "none"), 300);

      if (isCommonDenomReady) {
        $e("drag-instruction")!.innerHTML = `💡 分母相同了！請將上方的色塊「拖拉」或「點擊」到下方合併結果區。`;
      } else {
        const errorRow = $e("bar-error-row");
        if (errorRow && errorRow.style.display === "flex") {
          $e("drag-instruction")!.innerHTML = `💡 發現了嗎？因為「分母」不相同，無法用相同的格線算出來。<br>請試著在上方的算式點擊「擴分/約分」尋找公共的分母！`;
        } else {
          $e("drag-instruction")!.innerHTML = `💡 試著將兩條長條圖拖拉在一起合併，看看會發生什麼事？（或點擊「擴/約分」讓分母相同）`;
        }
      }
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
      moved1 = 0;
      moved2 = 0;
      mergedBlocks = [];

      const wpEl = $e("word-problem")!;
      if (currentWordProblemTemplate) {
        const frac1Html = `<b>${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}</b>`;
        const frac2Html = `<b>${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}</b>`;
        wpEl.innerHTML = currentWordProblemTemplate
          .replace(/\[FRAC1\]/g, frac1Html)
          .replace(/\[FRAC2\]/g, frac2Html);
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

      const animArea = $e("anim-area")!;
      animArea.innerHTML = `
        <div id="bar1-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between;">
            <div id="label1" style="width:15%; text-align:center;"></div>
            <div class="bars-column">
                <div id="bar1-wrap" class="bar-wrap-container"></div>
                <div id="bar1-nl" class="nl-wrap-container" style="display:none;"></div>
            </div>
            <div style="width:15%; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <button class="tool-btn" onclick="window.__FA47.applyTool(1, 'expand')">➕ 擴分</button>
                <button class="tool-btn" onclick="window.__FA47.applyTool(1, 'simplify')">➖ 約分</button>
            </div>
        </div>
        <div id="bar2-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between;">
            <div id="label2" style="width:15%; text-align:center;"></div>
            <div class="bars-column">
                <div id="bar2-wrap" class="bar-wrap-container"></div>
                <div id="bar2-nl" class="nl-wrap-container" style="display:none;"></div>
            </div>
            <div style="width:15%; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <button class="tool-btn" onclick="window.__FA47.applyTool(2, 'expand')">➕ 擴分</button>
                <button class="tool-btn" onclick="window.__FA47.applyTool(2, 'simplify')">➖ 約分</button>
            </div>
        </div>

        <div id="bar-error-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between; margin-top: 10px; padding-top: 15px; border-top: 2px dashed #ccc;">
            <div id="label-error" style="width:15%; text-align:center; font-weight:bold; color:var(--dark); font-size:1.1rem; display:flex; flex-direction:column; align-items:center;">
                未通分合併
            </div>
            <div class="bars-column">
                <div id="bar-error-wrap" class="bar-wrap-container droppable-area" style="min-height: 50px; outline: 3px dashed var(--red); background-color: #fafafa; border-radius: 4px;"></div>
                <div id="bar-error-nl" class="nl-wrap-container continuous" style="display:none;"></div>
            </div>
            <div style="width:15%;"></div>
        </div>

        <div id="bar3-row" style="display:none; position:relative; width:100%; min-height:80px; align-items:center; justify-content:space-between; margin-top: 10px; padding-top: 15px; border-top: 2px dashed #ccc;">
            <div id="label3" style="width:15%; text-align:center; font-weight:bold; color:var(--dark); font-size:1.1rem; display:flex; flex-direction:column; align-items:center;">
                合併結果
                <span style="font-size:0.8rem; color:var(--orange); margin-top:5px;">(點擊或拖拉)</span>
            </div>
            <div class="bars-column">
                <div id="bar3-wrap" class="bar-wrap-container droppable-area" style="min-height: 50px; outline: 3px dashed var(--orange); outline-offset: 4px; border-radius: 4px; transition: 0.3s;"></div>
                <div id="bar3-nl" class="nl-wrap-container" style="display:none;"></div>
            </div>
            <div style="width:15%;"></div>
        </div>
      `;

      renderBar(1, "none");
      renderBar(2, "none");
      $e("drag-instruction")!.innerHTML = `💡 點擊上方分數，顯示圖形！`;
      resetInactivityTimer();
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

      currentWordProblemTemplate =
        wordProblemTemplates[Math.floor(Math.random() * wordProblemTemplates.length)];
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

        const exactN = vals.total_n1 * vals.d2 + vals.total_n2 * vals.d1;
        const exactD = vals.d1 * vals.d2;
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
            msg = "🎉 完全正確！而且已經是最簡化的答案了！";
          } else {
            msg = '🌟 答對了數值！但試試看，這個答案可以再「約分」或「轉成帶分數」喔！';
          }
          if (currentD !== LcmD) {
            msg +=
              '<br><span style="color:var(--orange); font-size:1rem; font-weight:normal;">（提示：你通分時使用的分母不是最小公倍數喔！雖然算得對，但數字會比較大。）</span>';
          }
          fb.style.opacity = "1";
          fb.style.color = "var(--success)";
          fb.innerHTML = msg;
        } else {
          fb.style.opacity = "1";
          fb.style.color = "var(--red)";
          fb.innerText = "👀 答案不對喔，再檢查一下整數和分子相加的結果！";
        }
      } else {
        fb.style.opacity = "0";
      }
    }

    // ---------- bootstrap ----------
    const api: FA47Api = {
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
    window.__FA47 = api;

    de.style.setProperty("--max-wholes", "1");
    de.style.setProperty("--anim-time", "0.6s");
    root.innerHTML = BODY_HTML;

    const hand = document.createElement("div");
    hand.id = "tutorial-hand";
    hand.textContent = "👆";
    Object.assign(hand.style, {
      position: "absolute",
      fontSize: "3.5rem",
      zIndex: "100000",
      pointerEvents: "none",
      opacity: "0",
      filter: "drop-shadow(2px 4px 6px rgba(0,0,0,0.4))",
      marginTop: "0",
      marginLeft: "0",
      left: "0",
      top: "0",
    } as CSSStyleDeclaration);
    document.body.appendChild(hand);

    // ---------- proportional scaling ----------
    // Keep the desktop layout intact and shrink the whole tool to fit narrow
    // viewports (so the 擴分/約分 buttons never drop below the bars).
    const DESIGN_WIDTH = 1000; // matches .container's desktop design width
    const scaleWrap = root.querySelector(".scale-viewport") as HTMLElement | null;
    const scaleContainer = root.querySelector(".scale-viewport > .container") as HTMLElement | null;
    const fitScale = () => {
      if (!scaleWrap || !scaleContainer) return;
      scaleContainer.style.width = DESIGN_WIDTH + "px";
      scaleContainer.style.maxWidth = "none";
      const rootStyle = getComputedStyle(root);
      const padX = parseFloat(rootStyle.paddingLeft) + parseFloat(rootStyle.paddingRight);
      const avail = root.clientWidth - padX;
      const scale = Math.min(1, avail / DESIGN_WIDTH);
      scaleContainer.style.transform = scale < 1 ? `scale(${scale})` : "none";
      scaleWrap.style.height = scaleContainer.offsetHeight * scale + "px";
    };
    window.addEventListener("resize", fitScale);
    let scaleObserver: ResizeObserver | null = null;
    if (window.ResizeObserver && scaleContainer) {
      scaleObserver = new ResizeObserver(() => {
        if (alive) fitScale();
      });
      scaleObserver.observe(scaleContainer);
    }
    fitScale();

    const resetEvents = ["mousemove", "mousedown", "keydown", "touchstart", "dragstart", "input", "change"];
    resetEvents.forEach((evt) => document.addEventListener(evt, resetInactivityTimer, { passive: true }));
    const onCtx = (e: Event) => e.preventDefault();
    root.addEventListener("contextmenu", onCtx);

    // window.onload sequence
    updateSpeed();
    toggleWholeNumber();
    updateUI();
    resetInactivityTimer();

    return () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (hoverTimer) clearTimeout(hoverTimer);
      if (tutorialInterval) clearInterval(tutorialInterval);
      resetEvents.forEach((evt) => document.removeEventListener(evt, resetInactivityTimer));
      root.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("resize", fitScale);
      if (scaleObserver) scaleObserver.disconnect();
      hand.remove();
      if (window.__FA47 === api) delete window.__FA47;
      de.style.removeProperty("--max-wholes");
      de.style.removeProperty("--anim-time");
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`fa47-root${embedded ? " embedded" : ""}`} ref={rootRef} />
    </>
  );
}
