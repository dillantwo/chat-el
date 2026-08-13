"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 異分母分數減法 (Subtraction of fractions with unlike denominators).
 *
 * Ported from public/math/FractionApp-Subtraction.html (arith-common.css +
 * nav.css + FractionApp48.css + bar-component.css + FractionApp48.js).
 *
 * Same porting strategy as the Addition tool: the app is extremely imperative
 * (drag-and-drop into a trash can, dynamically generated rows with inline
 * onclick handlers, grid expand/simplify animations and a Promise-based
 * tutorial-finger). The original script is ported almost verbatim into a single
 * mount effect that scopes CSS under `.fa48-root`, injects the markup, exposes
 * the inline-handler functions on `window.__FA48`, and tears everything down on
 * unmount.
 *
 * `--anim-time` and `--max-wholes` are kept on document.documentElement because
 * the script reads `--max-wholes` back via getComputedStyle(documentElement).
 */

const STYLES = `
.fa48-root{
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
.fa48-root *{ margin:0; padding:0; box-sizing:border-box; }
.fa48-root .container{ background:#fff; padding:20px 30px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.1);
  max-width:1000px; width:100%; box-sizing:border-box; overflow-x:hidden; }

/* nav */
.fa48-root .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
  border-bottom:1px solid #ddd; padding-bottom:12px; flex-wrap:wrap; gap:15px; }
.fa48-root .header-left{ display:flex; align-items:center; gap:15px; }
.fa48-root .title-badge{ color:#0056b3; font-weight:bold; font-size:1.4rem; letter-spacing:1px; }
.fa48-root .header-right{ display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end; }
.fa48-root .controls-pill{ display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #ccc;
  border-radius:8px; padding:6px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.fa48-root .checkbox-label{ display:flex; align-items:center; gap:6px; font-size:0.95rem; color:#333; cursor:pointer; user-select:none; font-weight:bold; }
.fa48-root .checkbox-label input[type=checkbox]{ cursor:pointer; width:16px; height:16px; accent-color:var(--nav-primary); }
.fa48-root .divider{ width:1px; height:18px; background:#ccc; }
.fa48-root .speed-ctrl{ display:flex; align-items:center; gap:8px; font-size:0.95rem; color:#333; font-weight:bold; }
.fa48-root .speed-ctrl input[type=range]{ width:80px; cursor:pointer; accent-color:var(--nav-primary); }
.fa48-root .lang-btn{ padding:6px 16px; border:2px solid var(--nav-gray); background:#fff; color:#333; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:0.95rem; box-shadow:0 3px 0 var(--nav-gray); outline:none; transition:0.15s; transform:translateY(0); }
.fa48-root .lang-btn:active{ box-shadow:0 0 0 var(--nav-gray); transform:translateY(3px); }
.fa48-root .lang-btn.btn-active-mode{ border-color:#34495e; color:#34495e; box-shadow:0 3px 0 #34495e; }
.fa48-root .lang-btn.btn-random{ border-color:#9b59b6; color:#9b59b6; box-shadow:0 3px 0 #9b59b6; }
.fa48-root .lang-btn.btn-random:hover{ background:#9b59b6; color:#fff; }
.fa48-root .lang-btn.btn-random:active{ box-shadow:0 0 0 #9b59b6; transform:translateY(3px); background:#8e44ad; color:#fff; }

/* problem / formula */
.fa48-root .word-problem{ font-size:1.3rem; font-weight:bold; color:var(--dark); background:#e8f4f8; padding:15px 25px;
  border-radius:12px; border-left:6px solid var(--blue); margin-bottom:10px; width:100%; text-align:center;
  box-sizing:border-box; display:none; line-height:1.8; box-shadow:0 4px 6px rgba(0,0,0,0.05); }
.fa48-root .word-problem b{ color:var(--red); font-size:1.5rem; margin:0 5px; padding:2px 6px; background:#fff;
  border-radius:6px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1); display:inline-flex; align-items:center; }
.fa48-root .answer-zone{ padding:5px 0; text-align:center; color:var(--dark); display:flex; flex-direction:column; align-items:center; }
.fa48-root .formula{ display:flex; align-items:center; justify-content:center; gap:15px; font-size:2rem; flex-wrap:wrap; margin-bottom:0; }
.fa48-root .mixed-frac{ display:flex; align-items:center; gap:5px; cursor:pointer; padding:5px; border-radius:10px; transition:0.2s; }
.fa48-root .mixed-frac:hover{ background:#f0f0f0; }
.fa48-root .whole-input{ width:45px; height:50px; font-size:1.8rem; text-align:center; border-radius:8px; border:2px solid #ccc;
  outline:none; transition:0.3s; font-weight:bold; color:var(--dark); background:#fff; display:none; }
.fa48-root .whole-input:focus{ border-color:var(--blue); box-shadow:0 0 8px rgba(52,152,219,0.4); }
.fa48-root .frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; }
.fa48-root .frac-input{ width:55px; height:45px; font-size:1.5rem; text-align:center; border-radius:8px; font-weight:bold;
  color:var(--dark); transition:0.3s; outline:none; border:2px solid #ccc; background:#fff; }
.fa48-root .frac-text{ font-size:2rem; font-weight:bold; text-align:center; padding:0 10px; color:var(--dark); }
.fa48-root .frac-line{ width:100%; height:3px; background:var(--dark); margin:5px 0; }

/* animation zone */
.fa48-root .animation-zone{ width:100%; padding-top:5px; display:flex; flex-direction:column; align-items:center; position:relative; }
.fa48-root .instruction-text{ font-size:1.3rem; font-weight:bold; color:var(--dark); text-align:center; margin-bottom:10px;
  background:#fff4e6; padding:12px 25px; border-radius:12px; border-left:6px solid var(--orange); width:100%; max-width:850px;
  box-sizing:border-box; transition:opacity 0.5s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa48-root .inline-frac{ display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; font-weight:bold;
  line-height:1; margin:0 5px; position:relative; top:-0.1em; }
.fa48-root .inline-frac span{ font-size:1.1em; padding:1px 4px; }
.fa48-root .inline-frac .line{ height:2px; background-color:currentColor; width:100%; margin:2px 0; }
.fa48-root #anim-area{ width:100%; min-height:200px; position:relative; overflow:visible; margin-top:5px; display:flex; flex-direction:column; gap:20px; }

@keyframes fa48FadeInSlow { 0%{ opacity:0; transform:translateY(10px); } 100%{ opacity:1; transform:translateY(0); } }
.fa48-root .fade-in-slow{ animation:fa48FadeInSlow 1s ease-out forwards; }

.fa48-root .tool-btn{ background:#3498db; color:#fff; border:2px solid transparent; padding:8px 12px; border-radius:8px;
  cursor:pointer; font-weight:bold; font-size:1rem; transition:transform 0.1s, background 0.2s; display:flex; align-items:center; justify-content:center; gap:5px; }
.fa48-root .tool-btn:hover{ background:#2980b9; transform:scale(1.05); }
.fa48-root .tool-btn:active{ transform:scale(0.95); background:#1f618d; }

.fa48-root .bars-column{ width:70%; display:flex; flex-direction:column; }
.fa48-root .bar-wrap-container{ width:100%; display:flex; flex-wrap:wrap; gap:15px; justify-content:flex-start; align-items:center;
  background:transparent; border:none; min-height:60px; transition:0.5s ease; }
.fa48-root .bar-unit{ position:relative; height:50px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes));
  min-width:120px; flex:none; border:var(--bar-border-width) solid var(--bar-border-color); box-sizing:border-box;
  background:var(--bar-bg); border-radius:var(--bar-border-radius); overflow:hidden; }
.fa48-root .bar-fill{ height:100%; transition:width var(--anim-time) ease; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); }
.fa48-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; overflow:hidden; }
.fa48-root .abs-thick-line{ position:absolute; top:0; width:var(--grid-thick-width); height:100%; background:var(--grid-thick-color); transform:translateX(-50%); z-index:4; }
.fa48-root .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa48-root .bar-wrap-container.continuous{ gap:0 !important; }
.fa48-root .bar-wrap-container.continuous .bar-unit{ width:calc(100% / var(--max-wholes)) !important; border-right:none; border-radius:0; }
.fa48-root .bar-wrap-container.continuous .bar-unit:last-child{ border-right:var(--bar-border-width) solid var(--bar-border-color); border-top-right-radius:4px; border-bottom-right-radius:4px; }
.fa48-root .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:4px; border-bottom-left-radius:4px; }
.fa48-root .nl-wrap-container{ width:100%; display:flex; flex-wrap:wrap; justify-content:flex-start; align-items:flex-start;
  min-height:45px; margin-top:2px; border:none; position:relative; gap:15px; }
.fa48-root .nl-wrap-container.continuous{ gap:0 !important; }
.fa48-root .nl-unit{ position:relative; height:45px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes)); min-width:120px; flex:none; box-sizing:border-box; }
.fa48-root .nl-wrap-container.continuous .nl-unit{ width:calc(100% / var(--max-wholes)) !important; }

.fa48-root #bottom-answer-zone{ width:100%; max-width:650px; background:#fff8e1; padding:20px; border-radius:15px;
  border:2px dashed var(--red); margin-top:15px; display:none; flex-direction:column; align-items:center; gap:10px;
  box-shadow:0 4px 10px rgba(0,0,0,0.05); transition:opacity 0.5s; z-index:50; position:relative; }
.fa48-root .feedback-msg{ font-size:1.2rem; font-weight:bold; min-height:28px; margin-top:5px; opacity:0; transition:opacity 0.3s, color 0.3s; text-align:center; }
.fa48-root .drag-block{ transition:transform 0.1s, opacity 0.2s, box-shadow 0.2s; touch-action:manipulation; }
.fa48-root .drag-block:active{ transform:scale(0.95); }

/* Disabled: layout now scales proportionally via .scale-viewport instead of reflowing */
@media (max-width:0px){
  .fa48-root .header{ flex-direction:column; align-items:stretch; text-align:center; }
  .fa48-root .header-left{ justify-content:center; }
  .fa48-root .header-right{ justify-content:center; width:100%; }
  .fa48-root .controls-pill{ width:100%; justify-content:center; flex-wrap:wrap; }
  .fa48-root .title-badge{ font-size:1.1rem; }
  .fa48-root .lang-btn{ padding:6px 14px; font-size:0.85rem; }
  .fa48-root .container{ padding:10px; }
  .fa48-root .formula{ font-size:1.5rem; }
  .fa48-root .whole-input{ width:35px; height:40px; font-size:1.4rem; }
  .fa48-root .frac-input{ width:45px; height:35px; font-size:1.2rem; }
  .fa48-root .instruction-text, .fa48-root .word-problem{ font-size:1.1rem; padding:8px 15px; flex-wrap:wrap; }
  .fa48-root #bar1-row, .fa48-root #bar2-row{ flex-direction:column; height:auto !important; gap:5px; padding-bottom:5px; }
  .fa48-root .bars-column{ width:100% !important; }
  .fa48-root .bar-wrap-container, .fa48-root .nl-wrap-container{ justify-content:flex-start; }
  .fa48-root .bar-unit, .fa48-root .nl-unit{ min-width:80px; }
}

/* embedded (inside iframe) — 去除底層灰底並自適應父頁面，比照相等分數 */
.fa48-root.embedded{ background:transparent; padding:15px; }
.fa48-root.embedded .container{ box-shadow:none; border-radius:0; padding:1rem; }

/* Proportional scaling wrapper: keep the desktop layout intact and shrink the
   whole tool to fit narrow viewports instead of reflowing/stacking, so the
   擴分/約分 buttons never drop below the bars. */
.fa48-root .scale-viewport{ width:100%; display:flex; justify-content:center; align-items:flex-start; }
.fa48-root .scale-viewport > .container{ transform-origin:top center; flex:none; }
`;

const BODY_HTML = `
<div class="scale-viewport">
<div class="container">
  <div class="header">
    <div class="header-left">
      <div class="title-badge">分數相減</div>
    </div>
    <div class="header-right">
      <div class="controls-pill">
        <label class="checkbox-label">
          <input type="checkbox" id="show-whole-cb" onchange="window.__FA48.toggleWholeNumber()"> 顯示帶分數
        </label>
        <span class="divider"></span>
        <label class="checkbox-label">
          <input type="checkbox" id="show-nl-cb" onchange="window.__FA48.toggleNumberLine()" checked> 顯示數線
        </label>
        <span class="divider"></span>
        <div class="speed-ctrl">
          <label for="speed-slider" title="調整擴分/約分的動畫速度">動畫速度: <span id="speed-val" style="color: var(--blue);">1.0</span>x</label>
          <input type="range" id="speed-slider" min="0.5" max="3" step="0.1" value="1.0" oninput="window.__FA48.updateSpeed()">
        </div>
      </div>
      <button class="lang-btn btn-random" onclick="window.__FA48.randomChallenge()">🎲 隨機出題</button>
    </div>
  </div>

  <div id="word-problem" class="word-problem"></div>

  <div class="answer-zone">
    <div class="formula">
      <div class="mixed-frac" id="frac1-group" onclick="window.__FA48.onFrac1Click()" title="點擊重置並顯示被減數圖形">
        <input type="number" class="whole-input" id="w1" placeholder=" " min="0" max="10" oninput="window.__FA48.updateUI()" onchange="window.__FA48.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n1" value="1" min="1" max="100" oninput="window.__FA48.updateUI()" onchange="window.__FA48.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d1" value="2" min="1" max="100" oninput="window.__FA48.updateUI()" onchange="window.__FA48.updateUI()">
        </div>
      </div>
      <span>-</span>
      <div class="mixed-frac" id="frac2-group" onclick="window.__FA48.onFrac2Click()" title="點擊重置並顯示減數圖形">
        <input type="number" class="whole-input" id="w2" placeholder=" " min="0" max="10" oninput="window.__FA48.updateUI()" onchange="window.__FA48.updateUI()">
        <div class="frac">
          <input type="number" class="frac-input" id="n2" value="1" min="1" max="100" oninput="window.__FA48.updateUI()" onchange="window.__FA48.updateUI()">
          <div class="frac-line"></div>
          <input type="number" class="frac-input" id="d2" value="3" min="1" max="100" oninput="window.__FA48.updateUI()" onchange="window.__FA48.updateUI()">
        </div>
      </div>
    </div>
  </div>

  <div class="animation-zone" id="anim-zone">
    <div id="drag-instruction" class="instruction-text">💡 準備中...</div>
    <div id="anim-area"></div>

    <div id="bottom-answer-zone">
      <div id="bot-public-unit" style="font-size:1.2rem; color:var(--blue); margin-bottom:5px; font-weight:bold; background:#e8f4f8; padding:5px 15px; border-radius:8px;"></div>
      <div class="formula">
        <div id="bot-frac1"></div>
        <span>-</span>
        <div id="bot-frac2"></div>
        <span>=</span>
        <div class="mixed-frac" style="cursor: default;">
          <input type="number" class="whole-input" id="ans-w" placeholder=" " min="0" oninput="window.__FA48.autoCheck()">
          <div class="frac">
            <input type="number" class="frac-input" id="ans-num" placeholder="?" min="0" oninput="window.__FA48.autoCheck()">
            <div class="frac-line" style="background:#ccc;"></div>
            <input type="number" class="frac-input" id="ans-den" placeholder="?" min="1" oninput="window.__FA48.autoCheck()">
          </div>
        </div>
      </div>
      <div id="feedback" class="feedback-msg"></div>
    </div>
  </div>
</div>
</div>
`;

type FA48Api = {
  toggleWholeNumber: () => void;
  toggleNumberLine: () => void;
  toggleTrashContent: () => void;
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
    __FA48?: FA48Api;
  }
}

export default function FractionSubtractionPage() {
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

    // ---------- state (mirrors FractionApp48.js module vars) ----------
    let currentWordProblemTemplate: string | null = null;
    let s1 = 1;
    let s2 = 1;
    let bar1Visible = false;
    let bar2Visible = false;
    let currentSpeed = 1.0;
    let isCommonDenomReady = false;
    let trashedCount = 0;

    // tutorial-finger state
    let hintAnimId = 0;
    let idleTimer: number | null = null;
    let hoverTimer: number | null = null;
    let isHintPlaying = false;

    const timers: number[] = [];
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

    const wordProblemTemplates = [
      "小明原本有 [FRAC1] 塊披薩，吃掉了 [FRAC2] 塊。請問還剩下多少塊披薩？",
      "第一塊農田面積為 [FRAC1] 公頃，第二塊面積比第一塊少 [FRAC2] 公頃。請問第二塊農田的面積是多少公頃？",
      "媽媽買了 [FRAC1] 公斤的蘋果，送給鄰居 [FRAC2] 公斤。請問還剩下多少公斤？",
      "水桶裡原有 [FRAC1] 公升的水，倒出了 [FRAC2] 公升。請問現在水桶裡還剩下多少公升的水？",
      "紅彩帶長 [FRAC1] 公尺，藍彩帶長 [FRAC2] 公尺。請問紅彩帶比藍彩帶長多少公尺？",
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
      const showNL = $i("show-nl-cb")!.checked;
      ["bar1", "bar2", "error", "final"].forEach((prefix) => {
        const nlWrap = $e(
          prefix === "error" ? "error-nl-wrap" : prefix === "final" ? "final-nl" : `${prefix}-nl`,
        );
        if (nlWrap && nlWrap.innerHTML.trim() !== "") {
          if (showNL) {
            nlWrap.style.display = "flex";
            nlWrap.classList.add("continuous");
          } else {
            nlWrap.style.display = "none";
          }
        }
      });
    }

    function toggleTrashContent() {
      const tc = $e("trash-content");
      const btn = $e("toggle-trash-btn");
      if (!tc || !btn) return;
      if (tc.style.display === "none") {
        tc.style.display = "flex";
        btn.innerText = "隱藏內容";
      } else {
        tc.style.display = "none";
        btn.innerText = "顯示內容";
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
      de.style.setProperty("--max-wholes", String(Math.max(wholes1, wholes2)));
    }

    function getFracHtml(n: number, d: number, color = "inherit") {
      return `<div class="inline-frac" style="color: ${color};"><span>${n}</span><div class="line"></div><span>${d}</span></div>`;
    }

    function getDisplayHtml(w: number, n: number, d: number, color: string) {
      if (w > 0)
        return `<div style="display:inline-flex; align-items:center;"><span style="color:${color}; font-size:1.8rem; font-weight:bold; margin-right:4px; line-height:1;">${w}</span>${getFracHtml(n, d, color)}</div>`;
      return getFracHtml(n, d, color);
    }

    function gcd(a: number, b: number): number {
      return b ? gcd(b, a % b) : a;
    }
    function lcm(a: number, b: number) {
      return (a * b) / gcd(a, b);
    }

    function onFrac1Click() {
      const fArea = $e("final-answer-area");
      if (fArea) {
        fArea.style.opacity = "0";
        fArea.style.display = "none";
      }
      const row = $e("bar1-row")!;
      if (row) {
        row.style.maxHeight = "";
        row.style.minHeight = "50px";
        row.style.overflow = "";
        row.style.opacity = "1";
        row.style.margin = "";
        row.style.padding = "";
        row.style.transition = "";
        row.style.display = "flex";
      }
      s1 = 1;
      trashedCount = 0;
      renderBar(1, "none");
      row.classList.remove("fade-in-slow");
      void row.offsetWidth;
      row.classList.add("fade-in-slow");
      bar1Visible = true;
      checkCommonDenom();
    }

    function onFrac2Click() {
      const fArea = $e("final-answer-area");
      if (fArea) {
        fArea.style.opacity = "0";
        fArea.style.display = "none";
      }
      const row = $e("bar2-row")!;
      if (row) {
        row.style.maxHeight = "";
        row.style.minHeight = "50px";
        row.style.overflow = "";
        row.style.opacity = "1";
        row.style.margin = "";
        row.style.padding = "";
        row.style.transition = "";
        row.style.display = "flex";
      }
      s2 = 1;
      trashedCount = 0;
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

      for (let k = 1; k < d; k++) html += `<div class="abs-thick-line" style="left: ${(k / d) * 100}%;"></div>`;

      if (action === "simplify") {
        for (let k = 0; k < d; k++) {
          const remove_j = Math.floor(old_s / 2);
          for (let j = 1; j < old_s; j++) {
            const oldLeftPct = ((k * old_s + j) / (d * old_s)) * 100;
            const lineId = `line_${Math.random().toString(36).substr(2, 5)}`;
            if (j === remove_j) {
              html += `<div id="${lineId}" class="abs-thin-line removed-line" style="left: ${oldLeftPct}%; height: 100%; transition: height ${halfAnimMs}ms ease-in;"></div>`;
            } else {
              const new_j = j < remove_j ? j : j - 1;
              const newLeftPct = ((k * s + new_j) / (d * s)) * 100;
              html += `<div id="${lineId}" class="abs-thin-line retained-line" style="left: ${oldLeftPct}%; height: 100%; transition: left ${halfAnimMs}ms ease-out;" data-target-left="${newLeftPct}%"></div>`;
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
            html += `<div class="abs-thin-line expand-anim-line" style="left: ${((k * s + j) / (d * s)) * 100}%; height: 0%; background: var(--orange); transition: height ${animTimeMs}ms cubic-bezier(0.4, 0, 0.2, 1), background-color ${animTimeMs}ms;"></div>`;
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
            html += `<div class="abs-thin-line" style="left: ${((k * s + j) / (d * s)) * 100}%;"></div>`;
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

      if (label) label.innerHTML = getDisplayHtml(w, n * s, d * s, color);

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
          const pct = (Math.max(0, Math.min(d * s, total_n * s - idx * d * s)) / (d * s)) * 100;
          if (fill) {
            fill.style.width = `${pct}%`;
            fill.style.backgroundColor = color;
          }
          if (grid) applyGridAnimation(grid, d, s, old_s, action);
        });
      }

      if (nlWrap) {
        nlWrap.innerHTML = "";
        for (let i = 0; i < maxW; i++) {
          const nlUnit = document.createElement("div");
          nlUnit.className = "nl-unit";
          let labelsHtml = "";
          const currentD = d * s;
          for (let k = 0; k < currentD; k++) {
            let valHtml =
              k === 0
                ? `<span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i}</span>`
                : `<div class="inline-frac" style="font-size:0.85em; color:var(--dark);"><span>${k}</span><div class="line"></div><span>${currentD}</span></div>`;
            if (k > 0 && i > 0)
              valHtml = `<div style="display: flex; align-items: center; justify-content: center;"><span style="font-weight:bold; font-size:1.05rem; margin-right:2px; color:var(--dark);">${i}</span>${valHtml}</div>`;
            labelsHtml += `<div style="position: absolute; left: ${(k / currentD) * 100}%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;"><div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div>${valHtml}</div>`;
          }
          if (i === maxW - 1)
            labelsHtml += `<div style="position: absolute; left: 100%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;"><div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div><span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i + 1}</span></div>`;
          nlUnit.innerHTML = labelsHtml;
          nlWrap.appendChild(nlUnit);
        }
        nlWrap.classList.add("continuous");
        nlWrap.style.display = showNL ? "flex" : "none";
      }

      if (action !== "none") {
        T(() => {
          if ((num === 1 ? s1 : s2) === s) renderBar(num, "none");
        }, 50 + (0.6 / currentSpeed) * 1000);
      }
    }

    function convertBarToDraggable(num: number, cd: number, color: string) {
      const units = $e(`bar${num}-wrap`)!.querySelectorAll(".bar-unit");
      const vals = getSafeValues();
      const total_n = num === 1 ? vals.total_n1 : vals.total_n2;
      const s = num === 1 ? s1 : s2;

      units.forEach((unitEl, uIdx) => {
        const unit = unitEl as HTMLElement;
        const existingFill = unit.querySelector(".bar-fill") as HTMLElement | null;
        if (existingFill) existingFill.style.display = "none";
        const clamped = Math.max(0, Math.min(cd, total_n * s - uIdx * cd));

        Array.from(unit.childNodes).forEach((child) => {
          const el = child as HTMLElement;
          if (el.classList && !el.classList.contains("bar-grid") && !el.classList.contains("bar-fill"))
            unit.removeChild(child);
        });
        unit.style.display = "flex";
        unit.style.flexDirection = "row";

        if (clamped > 0) {
          const block = document.createElement("div");
          block.className = "drag-block";
          block.id = `drag-${num}-${uIdx}-whole`;
          block.style.width = `${(clamped / cd) * 100}%`;
          block.style.height = "100%";
          block.style.backgroundColor = color;
          block.style.opacity = "0.85";
          if (num === 1) {
            block.draggable = true;
            block.style.cursor = "grab";
          }
          block.style.position = "relative";
          block.style.boxSizing = "border-box";
          block.style.borderRight = isCommonDenomReady && clamped === cd ? "1px solid rgba(255,255,255,0.4)" : "none";
          block.style.zIndex = "1";
          block.setAttribute("data-pieces", String(clamped));

          if (num === 1) {
            block.ondragstart = (e: DragEvent) => {
              e.dataTransfer!.setData("text/plain", block.id);
              setTimeout(() => (block.style.opacity = "0.4"), 0);
            };
            block.ondragend = () => {
              if (block.draggable) block.style.opacity = "0.85";
            };
            block.onclick = () => {
              if (block.draggable) {
                if (isCommonDenomReady) trashPieces(block, num, cd);
                else triggerErrorMerge();
              }
            };
          }
          const grid = unit.querySelector(".bar-grid");
          if (grid) unit.insertBefore(block, grid);
          else unit.appendChild(block);
        }
      });
    }

    function triggerErrorMerge() {
      $e("drag-instruction")!.innerHTML = `⚠️ 分母不同，無法直接相減！請先點擊「擴分/約分」尋找公共的分母。`;
      showErrorMergeBar();
    }

    function showErrorMergeBar() {
      const errArea = $e("error-merge-area");
      if (!errArea) return;
      errArea.style.display = "flex";
      const wrap = $e("error-bar-wrap")!;
      const nlWrap = $e("error-nl-wrap")!;
      const showNL = $i("show-nl-cb")!.checked;
      const vals = getSafeValues();
      const maxW = maxWholes();

      wrap.innerHTML = "";
      nlWrap.innerHTML = "";

      const errorLabel = $e("error-label");
      if (errorLabel) {
        errorLabel.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; gap:5px; flex-wrap:wrap; font-size:1.8rem;">${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}<span style="font-weight:bold; color:var(--dark); font-size:1.8rem;">-</span>${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}<span style="font-weight:bold; color:var(--dark); font-size:1.8rem;">?</span></div>`;
      }

      for (let i = 0; i < maxW; i++) {
        const unit = document.createElement("div");
        unit.className = "bar-unit";
        const pct1 = Math.max(0, Math.min(100, ((vals.total_n1 - i * vals.d1) / vals.d1) * 100));
        const pct2 = Math.max(0, Math.min(100, ((vals.total_n2 - i * vals.d2) / vals.d2) * 100));
        let grids = '<div class="grid-overlay">';
        for (let k = 1; k < vals.d1; k++) grids += `<div class="abs-thin-line" style="left:${(k / vals.d1) * 100}%; height: 100%; top: 0;"></div>`;
        for (let k = 1; k < vals.d2; k++) grids += `<div class="abs-thin-line" style="left:${(k / vals.d2) * 100}%; height: 100%; top: 0;"></div>`;
        grids += "</div>";
        unit.innerHTML = `<div class="bar-fill" style="width: ${pct1}%; background-color: var(--red); opacity: 0.85; height: 100%; top: 0; position: absolute; left: 0; z-index: 1;"></div><div class="bar-fill" style="width: ${pct2}%; background-color: var(--blue); opacity: 0.85; height: 100%; top: 0; position: absolute; left: 0; z-index: 2;"></div>${grids}`;
        wrap.appendChild(unit);

        const nlUnit = document.createElement("div");
        nlUnit.className = "nl-unit";
        let labelsHtml =
          i === 0
            ? `<div style="position: absolute; left: 0%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;"><div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div><span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">0</span></div>`
            : "";
        labelsHtml += `<div style="position: absolute; left: 100%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;"><div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div><span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i + 1}</span></div>`;

        const f1 = vals.total_n1 / vals.d1;
        const f2 = vals.total_n2 / vals.d2;
        if (f1 > i && f1 <= i + 1)
          labelsHtml += `<div style="position: absolute; left: ${(f1 - i) * 100}%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 6;"><div style="width: 2px; height: 10px; background: var(--red); margin-bottom: 2px;"></div><div style="transform: scale(0.85); transform-origin: top center; background: rgba(255,255,255,0.85); border-radius: 4px; padding: 2px; white-space:nowrap;">${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}</div></div>`;
        if (f2 > i && f2 <= i + 1)
          labelsHtml += `<div style="position: absolute; left: ${(f2 - i) * 100}%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 6;"><div style="width: 2px; height: 10px; background: var(--blue); margin-bottom: 2px;"></div><div style="transform: scale(0.85); transform-origin: top center; background: rgba(255,255,255,0.85); border-radius: 4px; padding: 2px; white-space:nowrap;">${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}</div></div>`;
        nlUnit.innerHTML = labelsHtml;
        nlWrap.appendChild(nlUnit);
      }

      wrap.classList.add("continuous");
      nlWrap.classList.add("continuous");
      nlWrap.style.display = showNL ? "flex" : "none";
    }

    function showFinalAnswerBar() {
      const vals = getSafeValues();
      const cd = vals.d1 * s1;
      const finalParts = vals.total_n1 * s1 - vals.total_n2 * s2;
      const area = $e("final-answer-area")!;
      const wrap = $e("final-wrap")!;
      const nlWrap = $e("final-nl")!;
      const showNL = $i("show-nl-cb")!.checked;
      const maxW = maxWholes();

      wrap.innerHTML = "";
      nlWrap.innerHTML = "";
      $e("final-label")!.innerHTML = `<div style="font-weight:bold; color:var(--dark); font-size:1.1rem; margin-bottom:5px;">剩餘</div>`;

      for (let i = 0; i < maxW; i++) {
        const unit = document.createElement("div");
        unit.className = "bar-unit";
        const pct = Math.max(0, Math.min(100, ((finalParts - i * cd) / cd) * 100));
        let grids = '<div class="grid-overlay">';
        for (let k = 1; k < cd; k++) grids += `<div class="abs-thin-line" style="left:${(k / cd) * 100}%;"></div>`;
        grids += "</div>";
        unit.innerHTML = `<div class="bar-fill" style="width: ${pct}%; background-color: var(--red); opacity: 0.85; height: 100%; top: 0; position: absolute; left: 0;"></div>${grids}`;
        wrap.appendChild(unit);

        const nlUnit = document.createElement("div");
        nlUnit.className = "nl-unit";
        let labelsHtml =
          i === 0
            ? `<div style="position: absolute; left: 0%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;"><div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div><span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">0</span></div>`
            : "";
        labelsHtml += `<div style="position: absolute; left: 100%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;"><div style="width: 2px; height: 6px; background: var(--dark); margin-bottom: 2px;"></div><span style="font-weight:bold; font-size:1.1rem; color:var(--dark);">${i + 1}</span></div>`;
        if (finalParts / cd > i && finalParts / cd <= i + 1) {
          labelsHtml += `<div style="position: absolute; left: ${(finalParts / cd - i) * 100}%; top: 0px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 6;"><div style="width: 2px; height: 10px; background: var(--red); margin-bottom: 2px;"></div><div style="transform: scale(0.85); transform-origin: top center; background: rgba(255,255,255,0.85); border-radius: 4px; padding: 2px; font-weight: bold; color: var(--red);">?</div></div>`;
        }
        nlUnit.innerHTML = labelsHtml;
        nlWrap.appendChild(nlUnit);
      }

      wrap.classList.add("continuous");
      nlWrap.classList.add("continuous");
      nlWrap.style.display = showNL ? "flex" : "none";
      area.style.display = "flex";
      T(() => (area.style.opacity = "1"), 50);
    }

    function updateLabelsDuringDrag(cd: number) {
      const vals = getSafeValues();
      const rem1 = vals.total_n1 * s1 - trashedCount;
      if ($e("label1")) $e("label1")!.innerHTML = getDisplayHtml(Math.floor(rem1 / cd), rem1 % cd, cd, "var(--red)");
      const rem2 = vals.total_n2 * s2 - trashedCount;
      if ($e("label2")) $e("label2")!.innerHTML = getDisplayHtml(Math.floor(rem2 / cd), rem2 % cd, cd, "var(--blue)");
    }

    function animateToTrash(
      el: HTMLElement,
      rect: { left: number; top: number; width: number; height: number } | null = null,
      isClone = false,
      durationMs = 3000,
    ) {
      const trash = $e("trash-can")!;
      const startRect = rect || el.getBoundingClientRect();
      const clone = (isClone ? el : el.cloneNode(true)) as HTMLElement;
      clone.classList.add("fa48-fly");
      if (!isClone) el.style.display = "none";
      clone.style.position = "fixed";
      clone.style.left = startRect.left + "px";
      clone.style.top = startRect.top + "px";
      clone.style.width = startRect.width + "px";
      clone.style.height = startRect.height + "px";
      clone.style.margin = "0";
      clone.style.zIndex = "1000";
      clone.style.transition = `all ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`;
      clone.style.pointerEvents = "none";
      document.body.appendChild(clone);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!alive) return;
          const tRect = trash.getBoundingClientRect();
          clone.style.left = tRect.left + tRect.width / 2 - startRect.width / 2 + "px";
          clone.style.top = tRect.top + tRect.height / 2 - startRect.height / 2 + "px";
          clone.style.transform = "scale(0.1)";
          clone.style.opacity = "0";
        });
      });
      T(() => clone.remove(), durationMs + 50);
    }

    function trashPieces(block: HTMLElement, num: number, cd: number) {
      if (num !== 1) return;
      const vals = getSafeValues();
      const p = parseInt(block.getAttribute("data-pieces") || "0");
      const p_actual = Math.min(p, vals.total_n2 * s2 - trashedCount);
      if (p_actual <= 0) return;

      const animDuration = 3000 / currentSpeed;

      if (p_actual === p) {
        animateToTrash(block, null, false, animDuration);
      } else {
        const origRect = block.getBoundingClientRect();
        const remW = origRect.width * (p_actual / p);
        const remL = origRect.left + origRect.width - remW;
        block.setAttribute("data-pieces", String(p - p_actual));
        block.style.width = ((p - p_actual) / cd) * 100 + "%";
        const tPart = block.cloneNode(true) as HTMLElement;
        tPart.style.width = (p_actual / cd) * 100 + "%";
        tPart.style.position = "fixed";
        tPart.style.left = remL + "px";
        tPart.style.top = origRect.top + "px";
        animateToTrash(tPart, { left: remL, top: origRect.top, width: remW, height: origRect.height }, true, animDuration);
      }

      const bar2Blocks = Array.from(document.querySelectorAll('[id^="drag-2-"]')).reverse() as HTMLElement[];
      let leftToTrash = p_actual;
      for (const b2 of bar2Blocks) {
        if (leftToTrash <= 0) break;
        if (b2.style.display === "none") continue;
        const b2_p = parseInt(b2.getAttribute("data-pieces") || "0");
        if (b2_p <= leftToTrash) {
          animateToTrash(b2, null, false, animDuration);
          leftToTrash -= b2_p;
        } else {
          const oRect = b2.getBoundingClientRect();
          const rW = oRect.width * (leftToTrash / b2_p);
          const rL = oRect.left + oRect.width - rW;
          b2.setAttribute("data-pieces", String(b2_p - leftToTrash));
          b2.style.width = ((b2_p - leftToTrash) / cd) * 100 + "%";
          const b2Temp = b2.cloneNode(true) as HTMLElement;
          b2Temp.style.width = (leftToTrash / cd) * 100 + "%";
          b2Temp.style.position = "fixed";
          b2Temp.style.left = rL + "px";
          b2Temp.style.top = oRect.top + "px";
          animateToTrash(b2Temp, { left: rL, top: oRect.top, width: rW, height: oRect.height }, true, animDuration);
          leftToTrash = 0;
        }
      }

      trashedCount += p_actual;
      updateTrashTooltip(cd);
      updateLabelsDuringDrag(cd);

      if (trashedCount === vals.total_n2 * s2) {
        T(() => {
          const row1 = $e("bar1-row");
          const row2 = $e("bar2-row");
          [row1, row2].forEach((row) => {
            if (row) {
              row.style.overflow = "hidden";
              row.style.maxHeight = row.scrollHeight + "px";
              row.style.transition =
                "max-height 0.8s cubic-bezier(0.4, 0, 0.2, 1), min-height 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, margin 0.8s ease, padding 0.8s ease";
            }
          });
          void document.body.offsetHeight;
          [row1, row2].forEach((row) => {
            if (row) {
              row.style.opacity = "0";
              row.style.maxHeight = "0px";
              row.style.minHeight = "0px";
              row.style.margin = "0";
              row.style.padding = "0";
            }
          });
          T(() => {
            if (row1) row1.style.display = "none";
            if (row2) row2.style.display = "none";
            showFinalAnswerBar();
            showAnswerZone();
          }, 850);
        }, animDuration + 50);
      }
    }

    function updateTrashTooltip(cd: number) {
      const tooltip = $e("trash-content");
      if (!tooltip) return;
      if (trashedCount === 0 || !isCommonDenomReady) {
        tooltip.innerHTML = "<div style='text-align:center; color:#7f8c8d; padding:10px; font-weight:normal;'>目前垃圾桶是空的</div>";
        return;
      }
      const w = Math.floor(trashedCount / cd);
      const n = trashedCount % cd;
      let fracHtml = "";
      if (w > 0 && n === 0) fracHtml = `<b>${w}</b> 個整數`;
      else if (w > 0) fracHtml = `<b>${w}</b> 個整數 和 <div class="inline-frac"><span>${n}</span><div class="line"></div><span>${cd}</span></div>`;
      else fracHtml = `<div class="inline-frac"><span>${n}</span><div class="line"></div><span>${cd}</span></div>`;

      const genMini = (count: number, color: string) => {
        if (cd <= 0) return "";
        let html = '<div class="bar-wrap-container continuous" style="margin-top: 8px;">';
        for (let i = 0; i < maxWholes(); i++) {
          const fillPct =
            i < Math.floor(count / cd) ? 100 : i === Math.floor(count / cd) && count % cd > 0 ? ((count % cd) / cd) * 100 : 0;
          html += `<div class="bar-unit" style="background: transparent;">${fillPct > 0 ? `<div class="bar-fill" style="width:${fillPct}%; background-color:${color}; opacity: 0.85;"></div>` : ""}<div class="grid-overlay">${Array.from({ length: cd - 1 }, (_, k) => `<div class="abs-thin-line" style="left:${((k + 1) / cd) * 100}%;"></div>`).join("")}</div></div>`;
        }
        return html + "</div>";
      };
      tooltip.innerHTML = `<div style="margin-bottom: 15px;"><div style="padding: 0 15px;"><span style="color:var(--red); font-weight:bold;">被減數 (紅) 已丟棄: ${fracHtml}</span></div>${genMini(trashedCount, "var(--red)")}</div><div><div style="padding: 0 15px;"><span style="color:var(--blue); font-weight:bold;">減數 (藍) 已對消: ${fracHtml}</span></div>${genMini(trashedCount, "var(--blue)")}</div>`;
    }

    function showAnswerZone() {
      const vals = getSafeValues();
      const cd1 = vals.d1 * s1;
      $e("bottom-answer-zone")!.style.display = "flex";
      T(() => ($e("bottom-answer-zone")!.style.opacity = "1"), 50);
      $e("bot-frac1")!.innerHTML = getDisplayHtml(vals.w1, vals.n1 * s1, cd1, "var(--red)");
      $e("bot-frac2")!.innerHTML = getDisplayHtml(vals.w2, vals.n2 * s2, cd1, "var(--blue)");
      if ($e("tools1")) $e("tools1")!.style.visibility = "hidden";
      if ($e("tools2")) $e("tools2")!.style.visibility = "hidden";
      const exactN = vals.total_n1 * vals.d2 - vals.total_n2 * vals.d1;
      if (exactN >= vals.d1 * vals.d2) {
        $e("ans-w")!.style.display = "inline-block";
      } else {
        $e("ans-w")!.style.display = "none";
        $i("ans-w")!.value = "";
      }
      $e("bot-public-unit")!.innerHTML = `💡 公共分數單位為： <b style="display:inline-flex; align-items:center; vertical-align:middle;">${getFracHtml(1, cd1, "var(--dark)")}</b>`;
      $e("drag-instruction")!.innerHTML = `💡 減去完畢！請填寫下方最終答案！`;
    }

    function setupSubtraction(cd1: number, cd2: number) {
      if ($e("trash-area")) $e("trash-area")!.style.display = "flex";
      convertBarToDraggable(1, cd1, "var(--red)");
      convertBarToDraggable(2, cd2, "var(--blue)");
      updateTrashTooltip(cd1);

      const wrap1 = $e("bar1-wrap")!;
      const wrap2 = $e("bar2-wrap")!;
      const dragOver = (e: DragEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).style.opacity = "0.7";
      };
      const dragLeave = (e: DragEvent) => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
      };

      if (isCommonDenomReady) {
        wrap2.ondragover = dragOver;
        wrap2.ondragleave = dragLeave;
        wrap2.ondrop = (e: DragEvent) => {
          e.preventDefault();
          wrap2.style.opacity = "1";
          const el = $e(e.dataTransfer!.getData("text/plain"));
          if (el && el.classList.contains("drag-block")) trashPieces(el, 1, cd1);
        };
        wrap1.ondragover = null;
        wrap1.ondrop = null;
        wrap1.ondragleave = null;
      } else {
        const dropErr = (e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).style.opacity = "1";
          triggerErrorMerge();
        };
        wrap1.ondragover = dragOver;
        wrap1.ondragleave = dragLeave;
        wrap1.ondrop = dropErr;
        wrap2.ondragover = dragOver;
        wrap2.ondragleave = dragLeave;
        wrap2.ondrop = dropErr;
      }
    }

    function checkCommonDenom() {
      if (!bar1Visible || !bar2Visible) return;
      $e("bar1-row")!.style.display = "flex";
      $e("bar2-row")!.style.display = "flex";
      if ($e("tools1")) $e("tools1")!.style.visibility = "visible";
      if ($e("tools2")) $e("tools2")!.style.visibility = "visible";

      const vals = getSafeValues();
      const cd1 = vals.d1 * s1;
      const cd2 = vals.d2 * s2;
      isCommonDenomReady = cd1 === cd2 && cd1 > 0;
      if ($e("trash-area")) $e("trash-area")!.style.display = "flex";

      setupSubtraction(cd1, cd2);
      $e("bottom-answer-zone")!.style.opacity = "0";
      T(() => ($e("bottom-answer-zone")!.style.display = "none"), 300);

      if (isCommonDenomReady) {
        $e("drag-instruction")!.innerHTML = `💡 分母相同了！請點擊被減數的色塊，或將它拖入下方「減數長條圖」中扣除！`;
        $e("label1")!.style.opacity = "0";
        $e("label2")!.style.opacity = "0";
      } else {
        $e("drag-instruction")!.innerHTML = `💡 試著將兩條長條圖拖拉在一起相減，看看會發生什麼事？（或點擊「擴/約分」讓分母相同）`;
        $e("label1")!.style.opacity = "1";
        $e("label2")!.style.opacity = "1";
      }
    }

    function updateUI() {
      const valsInput = getSafeValues();
      if (valsInput.total_n1 / valsInput.d1 < valsInput.total_n2 / valsInput.d2) {
        $i("w1")!.value = String(valsInput.w2);
        $i("n1")!.value = String(valsInput.n2);
        $i("d1")!.value = String(valsInput.d2);
        $i("w2")!.value = String(valsInput.w1);
        $i("n2")!.value = String(valsInput.n1);
        $i("d2")!.value = String(valsInput.d1);
      }
      enforceInputLimits();
      updateMaxWholes();
      const vals = getSafeValues();
      s1 = 1;
      s2 = 1;
      bar1Visible = false;
      bar2Visible = false;
      isCommonDenomReady = false;
      trashedCount = 0;

      const wpEl = $e("word-problem")!;
      if (currentWordProblemTemplate) {
        wpEl.innerHTML = currentWordProblemTemplate
          .replace(/\[FRAC1\]/g, `<b>${getDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")}</b>`)
          .replace(/\[FRAC2\]/g, `<b>${getDisplayHtml(vals.w2, vals.n2, vals.d2, "var(--blue)")}</b>`);
        wpEl.style.display = "block";
      } else wpEl.style.display = "none";

      ["ans-w", "ans-num", "ans-den"].forEach((id) => ($i(id)!.value = ""));
      $e("ans-w")!.style.display = "none";
      $e("feedback")!.style.opacity = "0";
      $e("bottom-answer-zone")!.style.display = "none";
      $e("bottom-answer-zone")!.style.opacity = "0";

      $e("anim-area")!.innerHTML = `
        <div id="bar1-row" style="display:none; position:relative; width:100%; min-height:50px; align-items:center; justify-content:space-between;">
            <div id="label1" style="width:15%; text-align:center; transition: opacity 0.5s; opacity: 1;"></div>
            <div class="bars-column"><div id="bar1-wrap" class="bar-wrap-container"></div><div id="bar1-nl" class="nl-wrap-container" style="display:none;"></div></div>
            <div id="tools1" style="width:15%; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; visibility:visible;">
                <button class="tool-btn" onclick="window.__FA48.applyTool(1, 'expand')">➕ 擴分</button><button class="tool-btn" onclick="window.__FA48.applyTool(1, 'simplify')">➖ 約分</button>
            </div>
        </div>
        <div id="bar2-row" style="display:none; position:relative; width:100%; min-height:50px; align-items:center; justify-content:space-between;">
            <div id="label2" style="width:15%; text-align:center; transition: opacity 0.5s; opacity: 1;"></div>
            <div class="bars-column"><div id="bar2-wrap" class="bar-wrap-container"></div><div id="bar2-nl" class="nl-wrap-container" style="display:none;"></div></div>
            <div id="tools2" style="width:15%; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; visibility:visible;">
                <button class="tool-btn" onclick="window.__FA48.applyTool(2, 'expand')">➕ 擴分</button><button class="tool-btn" onclick="window.__FA48.applyTool(2, 'simplify')">➖ 約分</button>
            </div>
        </div>
        <div id="error-merge-area" style="display:none; position:relative; width:100%; min-height:50px; align-items:center; justify-content:space-between;">
            <div id="error-label" style="width:15%; text-align:center;"></div>
            <div class="bars-column"><div id="error-bar-wrap" class="bar-wrap-container"></div><div id="error-nl-wrap" class="nl-wrap-container" style="display:none; margin-top:2px;"></div></div>
            <div style="width:15%;"></div>
        </div>
        <div id="final-answer-area" style="display:none; opacity:0; position:relative; width:100%; min-height:50px; align-items:center; justify-content:space-between; transition: opacity 0.5s;">
            <div id="final-label" style="width:15%; text-align:center;"></div>
            <div class="bars-column"><div id="final-wrap" class="bar-wrap-container"></div><div id="final-nl" class="nl-wrap-container" style="display:none; margin-top:2px;"></div></div>
            <div style="width:15%;"></div>
        </div>
        <div id="trash-area" style="display:none; position:relative; width:100%; min-height:50px; align-items:flex-start; justify-content:space-between; border-top: 2px dashed #ccc; padding-top: 5px;">
            <div style="width:15%; display: flex; flex-direction: column; align-items: center; gap: 5px;"><div id="trash-can" style="font-size: 3rem;">🗑️</div><div style="font-weight:bold; color:var(--dark); font-size:1rem;">垃圾桶</div><button id="toggle-trash-btn" class="tool-btn" style="font-size: 0.85rem; padding: 4px 8px; width: auto;" onclick="window.__FA48.toggleTrashContent()">隱藏內容</button></div>
            <div id="trash-content" class="bars-column" style="background: white; padding: 15px 0; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border: 1px solid #eee;"><div style='text-align:center; color:#7f8c8d; padding:10px; font-weight:normal;'>目前垃圾桶是空的</div></div>
            <div style="width:15%;"></div>
        </div>
      `;
      renderBar(1, "none");
      renderBar(2, "none");
      $e("drag-instruction")!.innerHTML = `💡 點擊上方分數，顯示圖形！`;
    }

    function randomChallenge() {
      let d1 = Math.floor(Math.random() * 5) + 3;
      let d2 = Math.floor(Math.random() * 5) + 3;
      while (d2 === d1) d2 = Math.floor(Math.random() * 5) + 3;
      let total1 = Math.floor(Math.random() * (d1 * 3)) + 2;
      let total2 = Math.floor(Math.random() * (d2 * 2)) + 1;
      if (total1 / d1 < total2 / d2) {
        [total1, total2] = [total2, total1];
        [d1, d2] = [d2, d1];
      }
      let w1: number | string = "";
      let n1 = total1;
      let w2: number | string = "";
      let n2 = total2;
      if ($i("show-whole-cb")!.checked) {
        let ww1 = Math.floor(total1 / d1);
        n1 = total1 % d1;
        if (n1 === 0 && ww1 > 0) {
          ww1--;
          n1 = d1;
        }
        let ww2 = Math.floor(total2 / d2);
        n2 = total2 % d2;
        if (n2 === 0 && ww2 > 0) {
          ww2--;
          n2 = d2;
        }
        w1 = ww1 === 0 ? "" : ww1;
        w2 = ww2 === 0 ? "" : ww2;
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
      const ansW = parseInt($i("ans-w")!.value) || 0;
      let ansN = parseInt($i("ans-num")!.value);
      let ansD = parseInt($i("ans-den")!.value);
      if ($i("ans-num")!.value === "" && $i("ans-den")!.value === "") {
        ansN = 0;
        ansD = 1;
      }
      const fb = $e("feedback")!;

      if (!isNaN(ansN) && !isNaN(ansD) && ansD !== 0) {
        const userVal = (ansW * ansD + ansN) / ansD;
        const exactN = vals.total_n1 * vals.d2 - vals.total_n2 * vals.d1;
        const exactD = vals.d1 * vals.d2;
        const divisor = exactN === 0 ? 1 : gcd(Math.abs(exactN), exactD);
        const simpleImproperN = exactN / divisor;
        const simpleD = exactD / divisor;
        const simpleW = Math.floor(simpleImproperN / simpleD);
        const simpleMixedN = simpleImproperN % simpleD;

        if (Math.abs(userVal - exactN / exactD) < 0.0001) {
          let isSimplest = false;
          if (exactN === 0 && ansW === 0 && ansN === 0) isSimplest = true;
          else if (ansW === 0 && ansN === simpleImproperN && ansD === simpleD) isSimplest = true;
          else if (ansW === simpleW && ansN === simpleMixedN && ansD === simpleD) isSimplest = true;
          else if (ansN === 0 && ansW === simpleW && simpleMixedN === 0) isSimplest = true;

          let msg = isSimplest
            ? "🎉 完全正確！而且已經是最簡化的答案了！"
            : '🌟 答對了數值！但試試看，這個答案可以再「約分」或「轉成帶分數」喔！';
          if (vals.d1 * s1 !== lcm(vals.d1, vals.d2) && exactN !== 0)
            msg +=
              '<br><span style="color:var(--orange); font-size:1rem; font-weight:normal;">（提示：你通分時使用的分母不是最小公倍數喔！雖然算得對，但數字會比較大。）</span>';
          fb.style.opacity = "1";
          fb.style.color = "var(--success)";
          fb.innerHTML = msg;
        } else {
          fb.style.opacity = "1";
          fb.style.color = "var(--red)";
          fb.innerText = "👀 答案不對喔，再檢查一下整數和分子相減的結果！";
        }
      } else {
        fb.style.opacity = "0";
      }
    }

    // ---------- tutorial finger (idle 3s / hover 1s) ----------
    function interruptHint() {
      hintAnimId++;
      isHintPlaying = false;
      const finger = $e("hint-finger");
      if (finger) {
        finger.style.display = "none";
        finger.style.opacity = "0";
      }
    }

    function resetIdleTimer() {
      interruptHint();
      if (idleTimer) clearTimeout(idleTimer);
      if (hoverTimer) clearTimeout(hoverTimer);
      idleTimer = window.setTimeout(playHintAnimation, 3000);
      timers.push(idleTimer);
    }

    function hintDelay(ms: number, myAnimId: number) {
      return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          if (myAnimId === hintAnimId) resolve();
          else reject(new Error("interrupted"));
        }, ms);
      });
    }

    async function playHintAnimation() {
      if (isHintPlaying || !alive) return;
      let step = -1;
      if (!bar1Visible || !bar2Visible) {
        step = 0;
      } else if (!isCommonDenomReady) {
        const errArea = $e("error-merge-area");
        if (errArea && errArea.style.display !== "flex") step = 1;
        else step = 2;
      } else {
        const ansZone = $e("bottom-answer-zone");
        if (ansZone && ansZone.style.display !== "flex") step = 3;
      }
      if (step === -1) return;

      isHintPlaying = true;
      const currentAnimId = hintAnimId;

      let finger = $e("hint-finger");
      if (!finger) {
        finger = document.createElement("div");
        finger.id = "hint-finger";
        finger.innerHTML = "👆";
        finger.style.position = "fixed";
        finger.style.fontSize = "4rem";
        finger.style.zIndex = "10000";
        finger.style.pointerEvents = "none";
        finger.style.filter = "drop-shadow(2px 4px 6px rgba(0,0,0,0.3))";
        finger.style.transformOrigin = "top left";
        document.body.appendChild(finger);
      }

      finger.style.transition = "none";
      finger.style.transform = "translate(0px, 0px) scale(1)";
      finger.style.opacity = "0";
      finger.style.display = "block";

      try {
        if (step === 0) {
          const target = !bar1Visible ? $e("frac1-group")! : $e("frac2-group")!;
          const rect = target.getBoundingClientRect();
          finger.style.left = rect.left + rect.width / 2 - 20 + "px";
          finger.style.top = rect.top + rect.height / 2 + 10 + "px";
          await hintDelay(50, currentAnimId);
          finger.style.transition = "opacity 0.3s";
          finger.style.opacity = "1";
          await hintDelay(400, currentAnimId);
          finger.style.transition = "transform 0.2s";
          finger.style.transform = "translate(0px, -15px) scale(0.8)";
          await hintDelay(200, currentAnimId);
          finger.style.transform = "translate(0px, 0px) scale(1)";
          await hintDelay(400, currentAnimId);
        } else if (step === 1 || step === 3) {
          const sourceBlocks = Array.from(document.querySelectorAll("#bar1-wrap .drag-block")) as HTMLElement[];
          const source = sourceBlocks.find((b) => b.style.display !== "none");
          const dest = $e("bar2-wrap");
          if (!source || !dest) throw new Error("element not found");
          const sRect = source.getBoundingClientRect();
          const dRect = dest.getBoundingClientRect();
          finger.style.left = sRect.left + sRect.width / 2 - 20 + "px";
          finger.style.top = sRect.top + sRect.height / 2 + 10 + "px";
          await hintDelay(50, currentAnimId);
          finger.style.transition = "opacity 0.3s";
          finger.style.opacity = "1";
          await hintDelay(400, currentAnimId);
          finger.style.transition = "transform 0.2s";
          finger.style.transform = "translate(0px, -15px) scale(0.8)";
          await hintDelay(300, currentAnimId);
          finger.style.transition = "left 1s ease-in-out, top 1s ease-in-out, transform 1s";
          finger.style.left = dRect.left + dRect.width / 2 - 20 + "px";
          finger.style.top = dRect.top + dRect.height / 2 + 10 + "px";
          await hintDelay(1100, currentAnimId);
          finger.style.transition = "transform 0.2s";
          finger.style.transform = "translate(0px, 0px) scale(1)";
          await hintDelay(400, currentAnimId);
        } else if (step === 2) {
          const target = document.querySelector("#tools1 .tool-btn") as HTMLElement | null;
          if (!target) throw new Error("element not found");
          const rect = target.getBoundingClientRect();
          finger.style.left = rect.left + rect.width / 2 - 20 + "px";
          finger.style.top = rect.top + rect.height / 2 + 10 + "px";
          await hintDelay(50, currentAnimId);
          finger.style.transition = "opacity 0.3s";
          finger.style.opacity = "1";
          await hintDelay(400, currentAnimId);
          finger.style.transition = "transform 0.2s";
          finger.style.transform = "translate(0px, -15px) scale(0.8)";
          await hintDelay(200, currentAnimId);
          finger.style.transform = "translate(0px, 0px) scale(1)";
          await hintDelay(400, currentAnimId);
        }
        finger.style.transition = "opacity 0.3s";
        finger.style.opacity = "0";
        await hintDelay(300, currentAnimId);
      } catch {
        // interrupted by user interaction — silent
      }
      if (finger) finger.style.display = "none";
      isHintPlaying = false;
    }

    // ---------- bootstrap ----------
    const api: FA48Api = {
      toggleWholeNumber,
      toggleNumberLine,
      toggleTrashContent,
      updateSpeed,
      randomChallenge,
      onFrac1Click,
      onFrac2Click,
      updateUI,
      autoCheck,
      applyTool,
    };
    window.__FA48 = api;

    de.style.setProperty("--max-wholes", "1");
    de.style.setProperty("--anim-time", "0.6s");
    root.innerHTML = BODY_HTML;

    const onMouseMove = (e: MouseEvent) => {
      if (isHintPlaying) interruptHint();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = window.setTimeout(playHintAnimation, 3000);
      timers.push(idleTimer);
      if (hoverTimer) clearTimeout(hoverTimer);
      const interactiveSelectors = [".mixed-frac", ".drag-block", ".tool-btn", ".bar-wrap-container"];
      const isInteractive = interactiveSelectors.some((sel) => (e.target as HTMLElement).closest?.(sel));
      if (isInteractive) {
        hoverTimer = window.setTimeout(playHintAnimation, 1000);
        timers.push(hoverTimer);
      }
    };
    const onMouseOut = () => {
      if (hoverTimer) clearTimeout(hoverTimer);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", resetIdleTimer);
    document.addEventListener("touchstart", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("mouseout", onMouseOut);
    const onCtx = (e: Event) => e.preventDefault();
    root.addEventListener("contextmenu", onCtx);

    // window.onload sequence
    updateSpeed();
    toggleWholeNumber();
    updateUI();
    resetIdleTimer();

    return () => {
      alive = false;
      interruptHint();
      timers.forEach((id) => clearTimeout(id));
      if (idleTimer) clearTimeout(idleTimer);
      if (hoverTimer) clearTimeout(hoverTimer);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", resetIdleTimer);
      document.removeEventListener("touchstart", resetIdleTimer);
      document.removeEventListener("keydown", resetIdleTimer);
      document.removeEventListener("mouseout", onMouseOut);
      root.removeEventListener("contextmenu", onCtx);
      document.getElementById("hint-finger")?.remove();
      document.querySelectorAll(".fa48-fly").forEach((el) => el.remove());
      if (window.__FA48 === api) delete window.__FA48;
      de.style.removeProperty("--max-wholes");
      de.style.removeProperty("--anim-time");
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`fa48-root${embedded ? " embedded" : ""}`} ref={rootRef} />
    </>
  );
}
