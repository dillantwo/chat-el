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

/* 長條圖與數線放在同一個橫向捲動區：整數部分多（例如帶分數 9 2/8）時不再折行，
   而是保持一排並顯示水平捲軸，長條圖與數線一起捲動、刻度永遠對齊。 */
.fa48-root .bars-column{ width:70%; display:flex; flex-direction:column;
  overflow-x:auto; overflow-y:hidden; padding:4px 14px 8px 12px;
  overscroll-behavior-x:contain; scrollbar-width:thin; scrollbar-color:#bdc3c7 #eef1f3; }
.fa48-root .bars-column::-webkit-scrollbar{ height:10px; }
.fa48-root .bars-column::-webkit-scrollbar-track{ background:#eef1f3; border-radius:5px; }
.fa48-root .bars-column::-webkit-scrollbar-thumb{ background:#bdc3c7; border-radius:5px; }
.fa48-root .bars-column::-webkit-scrollbar-thumb:hover{ background:#95a5a6; }
.fa48-root .bar-wrap-container{ width:100%; display:flex; flex-wrap:nowrap; gap:15px; justify-content:flex-start; align-items:center;
  background:transparent; border:none; min-height:60px; transition:0.5s ease; }
.fa48-root .bar-unit{ position:relative; height:50px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes));
  min-width:var(--unit-min-w, 120px); flex:none; border:var(--bar-border-width) solid var(--bar-border-color); box-sizing:border-box;
  background:var(--bar-bg); border-radius:var(--bar-border-radius); overflow:hidden; }
.fa48-root .bar-fill{ height:100%; transition:width var(--anim-time) ease; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); }
.fa48-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; overflow:hidden; }
.fa48-root .abs-thick-line{ position:absolute; top:0; width:var(--grid-thick-width); height:100%; background:var(--grid-thick-color); transform:translateX(-50%); z-index:4; }
.fa48-root .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa48-root .bar-wrap-container.continuous{ gap:0 !important; }
.fa48-root .bar-wrap-container.continuous .bar-unit{ width:calc(100% / var(--max-wholes)) !important; border-right:none; border-radius:0; }
/* 帶分數時整數交界處原本是靠 .bar-unit 自己的 2px 左框畫出來的，
   比單位內的 3px 分數格線細、而且整條線都落在交界右側（box-sizing:border-box）。
   這裡把內側左框拿掉，交界線改用跟分數格線同一個 .abs-thick-line 來畫
   （見 unitEdgesHtml：左右兩個單位各畫一半，合起來就是置中的 3px 粗線），
   這樣有沒有帶分數，中間線條的粗細與位置都一致。 */
.fa48-root .bar-wrap-container.continuous .bar-unit:not(:first-child){ border-left:none; }
.fa48-root .bar-wrap-container.continuous .bar-unit:last-child{ border-right:var(--bar-border-width) solid var(--bar-border-color); border-top-right-radius:4px; border-bottom-right-radius:4px; }
.fa48-root .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:4px; border-bottom-left-radius:4px; }
.fa48-root .nl-wrap-container{ width:100%; display:flex; flex-wrap:nowrap; justify-content:flex-start; align-items:flex-start;
  min-height:56px; margin-top:2px; border:none; position:relative; gap:15px; }
.fa48-root .nl-wrap-container.continuous{ gap:0 !important; }
.fa48-root .nl-unit{ position:relative; height:56px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes)); min-width:var(--unit-min-w, 120px); flex:none; box-sizing:border-box; }
.fa48-root .nl-wrap-container.continuous .nl-unit{ width:calc(100% / var(--max-wholes)) !important; }
/* 數線刻度標籤：收緊分數左右內距，讓每個標籤佔的寬度小一點，比較不容易擠在一起 */
.fa48-root .nl-unit .inline-frac span{ padding:1px 2px; }
/* 帶分數刻度（例如 1 1/8）：去掉 .inline-frac 預設的 0 5px 外距，
   整數和分數才會靠在一起，讀起來像一個帶分數而不是兩個數字。 */
.fa48-root .nl-unit .inline-frac{ margin:0; }

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

    // 已丟進垃圾桶的每一步（紅色一份 + 對消掉的藍色一份），從垃圾桶還原時倒著取出。
    let trashHistory: { red: HTMLElement; blue: HTMLElement }[] = [];

    // 目前正在拖曳的那一份（紅色一份 + 跟著動的藍色一份）
    // mode: "trash" = 從長條圖丟進垃圾桶；"restore" = 從垃圾桶拉回長條圖
    let pieceDrag: {
      mode: "trash" | "restore";
      cd: number;
      startX: number;
      startY: number;
      moved: boolean;
      red: HTMLElement | null;
      blue: HTMLElement | null;
      redClone: HTMLElement;
      blueClone: HTMLElement;
    } | null = null;

    // 飛出 .fa48-root 之後 var(--red)/var(--blue) 就解析不到了，複製品一律用明確色碼。
    const PIECE_HEX: Record<string, string> = { "1": "#e74c3c", "2": "#3498db" };
    const pieceHex = (el: HTMLElement) => PIECE_HEX[el.getAttribute("data-num") || "1"] || "#e74c3c";

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
      ["bar1", "bar2"].forEach((prefix) => {
        const nlWrap = $e(`${prefix}-nl`);
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
      const maxW = Math.max(wholes1, wholes2);
      de.style.setProperty("--max-wholes", String(maxW));
      updateUnitMinWidth(maxW);
    }

    // 每個「整數格」的最小寬度（--unit-min-w）。數線上每個刻度標籤（例如 2/8、
    // 1 2/8）都需要一定的水平空間，格子太窄時標籤就會互相重疊看不清楚。這裡依
    // 目前的分母算出所需寬度；算出來比可用寬度大時，.bars-column 會出現水平捲軸。
    function updateUnitMinWidth(maxW = maxWholes()) {
      const vals = getSafeValues();
      // 分母可能因擴分而變大，通分後最少會用到最小公倍數，取三者最大值。
      const cd = Math.max(1, vals.d1 * s1, vals.d2 * s2, lcm(vals.d1, vals.d2));
      // 標籤寬度 ≈ 左右內距 + 每位數字的寬度（+ 帶分數的整數前綴）
      const perTick = 6 + 8 * String(cd).length + (maxW > 1 ? 12 : 0);
      de.style.setProperty("--unit-min-w", `${Math.max(120, Math.ceil(perTick * cd))}px`);
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
      const row = $e("bar1-row")!;
      if (row) {
        row.style.maxHeight = "";
        row.style.minHeight = "50px";
        row.style.overflow = "";
        row.style.opacity = "1";
        row.style.margin = "";
        row.style.padding = "";
        row.style.transition = "";
        row.style.pointerEvents = "";
        row.style.display = "flex";
      }
      s1 = 1;
      trashedCount = 0;
      trashHistory = [];
      renderBar(1, "none");
      row.classList.remove("fade-in-slow");
      void row.offsetWidth;
      row.classList.add("fade-in-slow");
      bar1Visible = true;
      checkCommonDenom();
    }

    function onFrac2Click() {
      const row = $e("bar2-row")!;
      if (row) {
        row.style.maxHeight = "";
        row.style.minHeight = "50px";
        row.style.overflow = "";
        row.style.opacity = "1";
        row.style.margin = "";
        row.style.padding = "";
        row.style.transition = "";
        row.style.pointerEvents = "";
        row.style.display = "flex";
      }
      s2 = 1;
      trashedCount = 0;
      trashHistory = [];
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

    /**
     * 整數單位交界處的分隔線（帶分數才會出現）。
     * .bar-unit 有 overflow:hidden，所以一條置中的線放在單一單位裡會被裁掉一半；
     * 這裡在左邊單位的 100% 與右邊單位的 0% 各放一條，各自露出一半，
     * 拼起來就是一條與單位內分數格線（.abs-thick-line）完全相同的置中粗線。
     */
    function unitEdgesHtml(idx: number, total: number) {
      let html = "";
      if (idx > 0) html += `<div class="abs-thick-line unit-edge" style="left:0;"></div>`;
      if (idx < total - 1) html += `<div class="abs-thick-line unit-edge" style="left:100%;"></div>`;
      return html;
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
      // 擴分／約分會改變分母，刻度需要的寬度也跟著變，所以每次重畫都重算一次。
      updateUnitMinWidth(maxW);

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
            unit.innerHTML = `<div class="bar-fill"></div><div class="bar-grid"></div>${unitEdgesHtml(i, maxW)}`;
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
          if (
            el.classList &&
            !el.classList.contains("bar-grid") &&
            !el.classList.contains("bar-fill") &&
            !el.classList.contains("unit-edge")
          )
            unit.removeChild(child);
        });
        unit.style.display = "flex";
        unit.style.flexDirection = "row";

        const grid = unit.querySelector(".bar-grid");
        const addBlock = (block: HTMLElement) => {
          if (grid) unit.insertBefore(block, grid);
          else unit.appendChild(block);
        };

        if (clamped <= 0) return;

        if (!isCommonDenomReady) {
          // 未通分前只畫一整塊、不開放互動：分母不同時相減沒有意義，
          // 先讓學生用「擴分/約分」把分母對齊。
          const block = document.createElement("div");
          block.className = "drag-block";
          block.id = `drag-${num}-${uIdx}-whole`;
          block.style.width = `${(clamped / cd) * 100}%`;
          block.style.height = "100%";
          block.style.backgroundColor = color;
          block.style.opacity = "0.85";
          block.style.position = "relative";
          block.style.boxSizing = "border-box";
          block.style.zIndex = "1";
          block.draggable = false;
          block.style.cursor = "default";
          block.setAttribute("data-pieces", String(clamped));
          addBlock(block);
          return;
        }

        // 通分後把長條圖切成一份一份的 1/cd，一次只處理一份。
        for (let i = 0; i < clamped; i++) {
          const piece = document.createElement("div");
          piece.className = "drag-block";
          piece.id = `drag-${num}-${uIdx}-${i}`;
          piece.style.width = `${100 / cd}%`;
          piece.style.height = "100%";
          piece.style.backgroundColor = color;
          piece.style.opacity = "0.85";
          piece.style.position = "relative";
          piece.style.boxSizing = "border-box";
          piece.style.borderRight = "1px solid rgba(255,255,255,0.4)";
          piece.style.zIndex = "1";
          piece.setAttribute("data-pieces", "1");
          piece.setAttribute("data-idx", String(uIdx * cd + i));
          piece.setAttribute("data-num", String(num));

          if (num === 1) {
            piece.style.cursor = "grab";
            piece.style.touchAction = "none";
            // 蓋掉 .drag-block:active{transform:scale(0.95)}：按下時縮小會讓我們量到錯的起始位置，
            // 而且 1/cd 的小塊縮一下也不好看，改用拖曳複製品的陰影當按壓回饋。
            piece.style.transform = "none";
            piece.onpointerdown = (e: PointerEvent) => beginPieceDrag(e, piece, cd);
          } else {
            piece.style.cursor = "default";
          }
          addBlock(piece);
        }
      });
    }

    // ---------- 一次丟一份：紅色（被減數）與藍色（減數）同時各扣掉一份 ----------

    function livePieces(num: number): HTMLElement[] {
      const wrap = $e(`bar${num}-wrap`);
      if (!wrap) return [];
      return (Array.from(wrap.querySelectorAll(".drag-block")) as HTMLElement[])
        .filter((el) => el.getAttribute("data-trashed") !== "1")
        .sort((a, b) => Number(a.getAttribute("data-idx") || 0) - Number(b.getAttribute("data-idx") || 0));
    }

    const piecesNeeded = () => {
      const vals = getSafeValues();
      return vals.total_n2 * s2;
    };

    // 丟掉的那一份原地改成同色虛線佔位（不移除），長條圖長度與格線位置都不會跑掉。
    function markPieceAsGhost(piece: HTMLElement, num: number) {
      piece.setAttribute("data-trashed", "1");
      piece.classList.add("trash-ghost");
      piece.onpointerdown = null;
      piece.onclick = null;
      piece.draggable = false;
      piece.style.opacity = "1";
      piece.style.cursor = "default";
      piece.style.pointerEvents = "none";
      piece.style.boxShadow = "none";
      piece.style.borderRadius = "4px";
      piece.style.border = `2px dashed ${num === 1 ? "var(--red)" : "var(--blue)"}`;
      piece.style.backgroundColor = num === 1 ? "rgba(231, 76, 60, 0.12)" : "rgba(52, 152, 219, 0.12)";
    }

    // markPieceAsGhost 的反向操作：從垃圾桶拉回來時把虛線佔位變回實心色塊並恢復互動。
    function unmarkPieceGhost(piece: HTMLElement, num: number, cd: number) {
      piece.removeAttribute("data-trashed");
      piece.classList.remove("trash-ghost");
      piece.style.border = "none";
      piece.style.borderRight = "1px solid rgba(255,255,255,0.4)";
      piece.style.borderRadius = "0";
      piece.style.backgroundColor = num === 1 ? "var(--red)" : "var(--blue)";
      piece.style.opacity = "0.85";
      piece.style.boxShadow = "none";
      piece.style.pointerEvents = "auto";
      if (num === 1) {
        piece.style.cursor = "grab";
        piece.style.touchAction = "none";
        piece.style.transform = "none";
        piece.onpointerdown = (e: PointerEvent) => beginPieceDrag(e, piece, cd);
      } else {
        piece.style.cursor = "default";
      }
    }

    function floatingClone(src: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
      const clone = src.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      clone.classList.add("fa48-fly");
      clone.style.position = "fixed";
      clone.style.left = rect.left + "px";
      clone.style.top = rect.top + "px";
      clone.style.width = rect.width + "px";
      clone.style.height = rect.height + "px";
      clone.style.margin = "0";
      clone.style.opacity = "1";
      clone.style.zIndex = "1200";
      clone.style.pointerEvents = "none";
      clone.style.transition = "none";
      clone.style.transform = "translate(0px, 0px)";
      clone.style.backgroundColor = pieceHex(src);
      clone.style.borderRight = "none";
      clone.style.borderRadius = "3px";
      clone.style.boxShadow = "0 6px 14px rgba(0,0,0,0.3)";
      document.body.appendChild(clone);
      return clone;
    }

    function flyPieceToTrash(
      piece: HTMLElement,
      durationMs: number,
      rect?: { left: number; top: number; width: number; height: number },
    ) {
      const r = rect || piece.getBoundingClientRect();
      const clone = piece.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      clone.style.boxShadow = "none";
      clone.style.backgroundColor = pieceHex(piece);
      clone.style.borderRight = "none";
      clone.style.borderRadius = "3px";
      clone.style.opacity = "1";
      animateToTrash(clone, { left: r.left, top: r.top, width: r.width, height: r.height }, true, durationMs);
    }

    // 把拖曳中的複製品接手交給垃圾桶動畫（先清掉 transform，才不會與 left/top 疊加）。
    function handOffToTrash(clone: HTMLElement, durationMs: number) {
      const r = clone.getBoundingClientRect();
      clone.style.transition = "none";
      clone.style.transform = "none";
      clone.style.boxShadow = "none";
      animateToTrash(clone, { left: r.left, top: r.top, width: r.width, height: r.height }, true, durationMs);
    }

    function commitOnePiece(
      cd: number,
      red: HTMLElement,
      blue: HTMLElement,
      durationMs: number,
      flyers?: { redClone: HTMLElement; blueClone: HTMLElement },
    ) {
      if (red.getAttribute("data-trashed") === "1" || blue.getAttribute("data-trashed") === "1") return;
      if (trashedCount >= piecesNeeded()) return;

      if (flyers) {
        handOffToTrash(flyers.redClone, durationMs);
        handOffToTrash(flyers.blueClone, durationMs);
      } else {
        flyPieceToTrash(red, durationMs);
        flyPieceToTrash(blue, durationMs);
      }
      markPieceAsGhost(red, 1);
      markPieceAsGhost(blue, 2);

      trashedCount += 1;
      trashHistory.push({ red, blue });
      updateTrashTooltip(cd);

      if (trashedCount === piecesNeeded()) {
        T(() => {
          // 動畫還在飛的期間學生可能已經從垃圾桶還原了一份，這時就不該再鎖住並顯示填答區。
          if (trashedCount !== piecesNeeded()) return;
          // 相減完成後保留上方兩條原始長條圖（減掉的部分留虛線佔位），讓學生仍能對照
          // 「被減數／減數」與「剩餘」；僅鎖住互動，不再收合隱藏。
          [$e("bar1-row"), $e("bar2-row")].forEach((row) => {
            if (row) {
              row.style.opacity = "1";
              row.style.pointerEvents = "none";
            }
          });
          showAnswerZone();
        }, durationMs + 50);
      } else {
        $e("drag-instruction")!.innerHTML = `💡 很好！繼續把被減數的色塊一份一份丟進垃圾桶（減數會同時扣掉一份）。`;
      }
    }

    // 把複製品從目前位置飛回指定色塊的位置（垃圾桶 → 長條圖的還原動畫）。
    function flyCloneToPiece(clone: HTMLElement, target: HTMLElement, durationMs: number) {
      const from = clone.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      clone.style.transition = "none";
      clone.style.transform = "none";
      clone.style.left = from.left + "px";
      clone.style.top = from.top + "px";
      clone.style.width = from.width + "px";
      clone.style.height = from.height + "px";
      clone.style.boxShadow = "none";
      clone.style.zIndex = "1000";
      void clone.offsetWidth;
      clone.style.transition = `all ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!alive) return;
          clone.style.left = to.left + "px";
          clone.style.top = to.top + "px";
          clone.style.width = to.width + "px";
          clone.style.height = to.height + "px";
        });
      });
      T(() => clone.remove(), durationMs + 50);
    }

    // 減完之後還想改？把垃圾桶裡的一份拉回（或點回）長條圖，一次還原一步。
    function restoreOnePiece(
      cd: number,
      durationMs: number,
      flyers?: { redClone: HTMLElement; blueClone: HTMLElement },
    ) {
      const entry = trashHistory.pop();
      if (!entry) {
        if (flyers) {
          flyers.redClone.remove();
          flyers.blueClone.remove();
        }
        return;
      }
      const { red, blue } = entry;

      unmarkPieceGhost(red, 1, cd);
      unmarkPieceGhost(blue, 2, cd);
      trashedCount = Math.max(0, trashedCount - 1);

      if (flyers) {
        flyCloneToPiece(flyers.redClone, red, durationMs);
        flyCloneToPiece(flyers.blueClone, blue, durationMs);
      } else {
        const redClone = floatingClone(red, red.getBoundingClientRect());
        const blueClone = floatingClone(blue, blue.getBoundingClientRect());
        // 點擊還原：從垃圾桶那一份的位置慢慢飛回長條圖。
        const trashRed = lastTrashMiniPiece(1);
        const trashBlue = lastTrashMiniPiece(2);
        if (trashRed) placeCloneAt(redClone, trashRed.getBoundingClientRect());
        if (trashBlue) placeCloneAt(blueClone, trashBlue.getBoundingClientRect());
        flyCloneToPiece(redClone, red, durationMs);
        flyCloneToPiece(blueClone, blue, durationMs);
      }

      updateTrashTooltip(cd);
      exitCompletedState();
    }

    function placeCloneAt(clone: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
      clone.style.transition = "none";
      clone.style.transform = "none";
      clone.style.left = rect.left + "px";
      clone.style.top = rect.top + "px";
      clone.style.width = rect.width + "px";
      clone.style.height = rect.height + "px";
    }

    function lastTrashMiniPiece(num: number): HTMLElement | null {
      const tooltip = $e("trash-content");
      if (!tooltip) return null;
      const pieces = Array.from(
        tooltip.querySelectorAll(`.trash-piece[data-num="${num}"]`),
      ) as HTMLElement[];
      return pieces[pieces.length - 1] || null;
    }

    // 從「減去完畢」退回未完成狀態：解鎖長條圖、收掉填答區、把擴分/約分按鈕放回來。
    function exitCompletedState() {
      [$e("bar1-row"), $e("bar2-row")].forEach((row) => {
        if (row) {
          row.style.opacity = "1";
          row.style.pointerEvents = "auto";
        }
      });
      if ($e("tools1")) $e("tools1")!.style.visibility = "visible";
      if ($e("tools2")) $e("tools2")!.style.visibility = "visible";
      if ($e("feedback")) $e("feedback")!.style.opacity = "0";
      const zone = $e("bottom-answer-zone")!;
      zone.style.opacity = "0";
      T(() => {
        if (trashedCount !== piecesNeeded()) zone.style.display = "none";
      }, 300);
      $e("drag-instruction")!.innerHTML =
        trashedCount === 0
          ? `💡 分母相同了！一次拖一份被減數的色塊丟進垃圾桶（減數會跟著一起扣掉一份），或點擊色塊讓它自己慢慢飛過去。`
          : `💡 已從垃圾桶還原一份。可以繼續丟，也可以再從垃圾桶拉回來。`;
    }

    function isOverTrash(x: number, y: number) {
      const can = $e("trash-can");
      if (!can) return false;
      const r = can.getBoundingClientRect();
      const pad = 60;
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    }

    // idle=沒在拖 / armed=拖曳中（提示這裡可以丟）/ over=已經在投放範圍內
    function setTrashDropState(state: "idle" | "armed" | "over") {
      const can = $e("trash-can");
      if (!can) return;
      can.style.transition = "transform 0.15s ease, filter 0.15s ease";
      can.style.borderRadius = "12px";
      can.style.outlineOffset = "6px";
      if (state === "idle") {
        can.style.transform = "scale(1)";
        can.style.filter = "none";
        can.style.outline = "none";
      } else if (state === "armed") {
        can.style.transform = "scale(1.05)";
        can.style.filter = "none";
        can.style.outline = "3px dashed var(--red)";
      } else {
        can.style.transform = "scale(1.25)";
        can.style.filter = "drop-shadow(0 0 10px rgba(231,76,60,0.8))";
        can.style.outline = "3px solid var(--red)";
      }
    }

    // 還原時的投放目標是上面兩條長條圖。
    function isOverBars(x: number, y: number) {
      const pad = 30;
      return [$e("bar1-wrap"), $e("bar2-wrap")].some((wrap) => {
        if (!wrap) return false;
        const r = wrap.getBoundingClientRect();
        return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
      });
    }

    function setBarsDropState(state: "idle" | "armed" | "over") {
      [$e("bar1-wrap"), $e("bar2-wrap")].forEach((wrap) => {
        if (!wrap) return;
        wrap.style.transition = "outline-color 0.15s ease";
        wrap.style.outlineOffset = "4px";
        wrap.style.borderRadius = "4px";
        if (state === "idle") wrap.style.outline = "none";
        else if (state === "armed") wrap.style.outline = "3px dashed var(--orange)";
        else wrap.style.outline = "3px solid var(--orange)";
      });
    }

    function endPieceDrag() {
      window.removeEventListener("pointermove", onPiecePointerMove);
      window.removeEventListener("pointerup", onPiecePointerUp);
      window.removeEventListener("pointercancel", onPiecePointerUp);
      setTrashDropState("idle");
      setBarsDropState("idle");
    }

    function onPiecePointerMove(e: PointerEvent) {
      const d = pieceDrag;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
      const shift = `translate(${dx}px, ${dy}px)`;
      d.redClone.style.transform = shift;
      d.blueClone.style.transform = shift;
      if (d.mode === "trash") {
        setTrashDropState(isOverTrash(e.clientX, e.clientY) ? "over" : "armed");
      } else {
        setBarsDropState(isOverBars(e.clientX, e.clientY) ? "over" : "armed");
      }
    }

    function onPiecePointerUp(e: PointerEvent) {
      const d = pieceDrag;
      pieceDrag = null;
      endPieceDrag();
      if (!d) return;

      if (d.red) d.red.style.opacity = "0.85";
      if (d.blue) d.blue.style.opacity = "0.85";

      const dropClones = () => {
        d.redClone.remove();
        d.blueClone.remove();
      };
      const slideBack = () => {
        [d.redClone, d.blueClone].forEach((clone) => {
          clone.style.transition = "transform 0.25s ease-out, opacity 0.25s ease-out";
          clone.style.transform = "translate(0px, 0px)";
          clone.style.opacity = "0";
          T(() => clone.remove(), 300);
        });
      };

      if (d.mode === "restore") {
        if (!d.moved) {
          // 點擊垃圾桶裡的色塊：慢慢飛回長條圖。
          dropClones();
          restoreOnePiece(d.cd, 3000 / currentSpeed);
        } else if (isOverBars(e.clientX, e.clientY)) {
          restoreOnePiece(d.cd, 500 / currentSpeed, { redClone: d.redClone, blueClone: d.blueClone });
        } else {
          slideBack();
        }
        return;
      }

      if (!d.red || !d.blue) {
        slideBack();
        return;
      }

      if (!d.moved) {
        // 當成點擊：複製品收掉，改用慢速動畫把色塊送進垃圾桶。
        dropClones();
        commitOnePiece(d.cd, d.red, d.blue, 3000 / currentSpeed);
        return;
      }

      if (isOverTrash(e.clientX, e.clientY)) {
        commitOnePiece(d.cd, d.red, d.blue, 500 / currentSpeed, {
          redClone: d.redClone,
          blueClone: d.blueClone,
        });
        return;
      }

      // 沒丟進垃圾桶：兩個複製品滑回原位。
      slideBack();
    }

    // 從垃圾桶的迷你長條圖往回拖（紅藍兩份一起動，和丟進去時一樣）。
    function beginRestoreDrag(e: PointerEvent, miniPiece: HTMLElement, cd: number) {
      if (!isCommonDenomReady || pieceDrag) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (trashedCount <= 0 || trashHistory.length === 0) return;

      const miniRed = lastTrashMiniPiece(1);
      const miniBlue = lastTrashMiniPiece(2);
      if (!miniRed || !miniBlue) return;

      e.preventDefault();
      pieceDrag = {
        mode: "restore",
        cd,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        red: null,
        blue: null,
        redClone: floatingClone(miniRed, miniRed.getBoundingClientRect()),
        blueClone: floatingClone(miniBlue, miniBlue.getBoundingClientRect()),
      };
      setBarsDropState("armed");

      window.addEventListener("pointermove", onPiecePointerMove);
      window.addEventListener("pointerup", onPiecePointerUp);
      window.addEventListener("pointercancel", onPiecePointerUp);
    }

    function beginPieceDrag(e: PointerEvent, piece: HTMLElement, cd: number) {
      if (!isCommonDenomReady || pieceDrag) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (piece.getAttribute("data-trashed") === "1") return;
      if (trashedCount >= piecesNeeded()) return;

      // 減數（藍色）從最右邊開始對消，學生只需要選被減數要丟哪一份。
      const blues = livePieces(2);
      const blue = blues[blues.length - 1];
      if (!blue) return;

      e.preventDefault();
      const redRect = piece.getBoundingClientRect();
      const blueRect = blue.getBoundingClientRect();

      pieceDrag = {
        mode: "trash",
        cd,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        red: piece,
        blue,
        redClone: floatingClone(piece, redRect),
        blueClone: floatingClone(blue, blueRect),
      };

      piece.style.opacity = "0.25";
      blue.style.opacity = "0.25";
      setTrashDropState("armed");

      window.addEventListener("pointermove", onPiecePointerMove);
      window.addEventListener("pointerup", onPiecePointerUp);
      window.addEventListener("pointercancel", onPiecePointerUp);
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

      // 迷你長條圖切成一份一份，才能被拉回／點回原來的長條圖還原。
      const genMini = (count: number, num: number) => {
        if (cd <= 0) return "";
        const color = num === 1 ? "var(--red)" : "var(--blue)";
        const pieceW = 100 / cd;
        // 這組迷你長條圖不在 .bars-column 內，自行提供橫向捲動，避免整數部分多時被裁切。
        let html =
          '<div class="bar-wrap-container continuous" style="margin-top: 8px; overflow-x: auto; overflow-y: hidden; padding-bottom: 6px;">';
        for (let i = 0; i < maxWholes(); i++) {
          html += `<div class="bar-unit" style="background: transparent; display:flex; flex-direction:row;">`;
          for (let k = 0; k < cd; k++) {
            const idx = i * cd + k;
            if (idx < count) {
              html += `<div class="trash-piece" data-num="${num}" data-trash-idx="${idx}" style="width:${pieceW}%; height:100%; flex:none; background-color:${color}; opacity:0.85; position:relative; box-sizing:border-box; border-right:1px solid rgba(255,255,255,0.4); z-index:1; cursor:grab; touch-action:none; transform:none;"></div>`;
            } else {
              html += `<div style="width:${pieceW}%; height:100%; flex:none;"></div>`;
            }
          }
          html += `<div class="grid-overlay">${Array.from({ length: cd - 1 }, (_, k) => `<div class="abs-thin-line" style="left:${((k + 1) / cd) * 100}%;"></div>`).join("")}</div>${unitEdgesHtml(i, maxWholes())}</div>`;
        }
        return html + "</div>";
      };
      const hint = `<div style="padding: 4px 15px 0; color:#7f8c8d; font-size:0.85rem;">💡 想改答案？把垃圾桶裡的色塊拖回上面的長條圖，或直接點它，就能還原一份。</div>`;
      tooltip.innerHTML = `<div style="margin-bottom: 15px;"><div style="padding: 0 15px;"><span style="color:var(--red); font-weight:bold;">被減數 (紅) 已丟棄: ${fracHtml}</span></div>${genMini(trashedCount, 1)}</div><div><div style="padding: 0 15px;"><span style="color:var(--blue); font-weight:bold;">減數 (藍) 已對消: ${fracHtml}</span></div>${genMini(trashedCount, 2)}</div>${hint}`;

      tooltip.querySelectorAll(".trash-piece").forEach((el) => {
        const miniPiece = el as HTMLElement;
        miniPiece.onpointerdown = (ev: PointerEvent) => beginRestoreDrag(ev, miniPiece, cd);
      });
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
      // 長條圖在這裡整個重畫成滿的，所以垃圾桶的紀錄也一起歸零，
      // 否則舊的 trashHistory 會指向已經被移除的 DOM 節點。
      trashedCount = 0;
      trashHistory = [];
      convertBarToDraggable(1, cd1, "var(--red)");
      convertBarToDraggable(2, cd2, "var(--blue)");
      updateTrashTooltip(cd1);

      // 拖放改由色塊自己的 pointer 事件處理（見 beginPieceDrag），投放目標是垃圾桶而不是長條圖，
      // 所以這裡把長條圖上舊的 HTML5 drag 事件全部清掉。
      [$e("bar1-wrap"), $e("bar2-wrap")].forEach((wrap) => {
        if (!wrap) return;
        wrap.ondragover = null;
        wrap.ondragleave = null;
        wrap.ondrop = null;
        wrap.style.opacity = "1";
      });

      if (pieceDrag) {
        pieceDrag.redClone.remove();
        pieceDrag.blueClone.remove();
        pieceDrag = null;
        endPieceDrag();
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
        $e("drag-instruction")!.innerHTML = `💡 分母相同了！一次拖一份被減數的色塊丟進垃圾桶（減數會跟著一起扣掉一份），或點擊色塊讓它自己慢慢飛過去。`;
        // 通分後長條圖仍保留原本長度（丟掉的部分只是變虛線），旁邊的分數標註要跟著留著對照。
        $e("label1")!.style.opacity = "1";
        $e("label2")!.style.opacity = "1";
      } else {
        $e("drag-instruction")!.innerHTML = `💡 分母不同，還不能相減喔！請先點擊右邊的「擴分/約分」讓兩個分母相同。`;
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
      trashHistory = [];

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
        // 未通分前唯一該做的事就是擴分/約分，手指直接指向工具按鈕。
        step = 2;
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
        } else if (step === 3) {
          // 通分後的正確操作是「拖一份色塊丟進垃圾桶」，手指從最右邊那一份指向垃圾桶。
          const reds = livePieces(1);
          const source = reds[reds.length - 1];
          const dest = $e("trash-can");
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
    de.style.setProperty("--unit-min-w", "120px");
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

    // 由 dashboard 經 AI 提取題目後帶入的參數：num1/den1/num2/den2/whole1/whole2/context
    // （題目文字，分數位置為 [FRAC1] / [FRAC2]）。沒有參數時沿用輸入框的預設 1/2 - 1/3，
    // 且不顯示題目 —— 題目只在 AI 提取到題目、或用家按「隨機出題」時才出現。
    function applyIncomingParams() {
      const params = new URLSearchParams(window.location.search);

      // 分子分母的可用範圍與 getSafeValues() 一致，避免輸入框顯示的值和動畫用的值不同。
      const setInt = (id: string, key: string, min: number, max: number) => {
        const v = parseInt(params.get(key) ?? "", 10);
        if (isNaN(v)) return 0;
        const clamped = Math.min(Math.max(v, min), max);
        $i(id)!.value = String(clamped);
        return clamped;
      };

      setInt("n1", "num1", 1, 100);
      setInt("d1", "den1", 1, 100);
      setInt("n2", "num2", 1, 100);
      setInt("d2", "den2", 1, 100);
      const w1 = setInt("w1", "whole1", 0, 10);
      const w2 = setInt("w2", "whole2", 0, 10);
      // 整數部分為 0 就留空，輸入框顯示 "0" 會誤導。
      if (w1 === 0) $i("w1")!.value = "";
      if (w2 === 0) $i("w2")!.value = "";
      // 整數部分只在「顯示帶分數」開啟時才可見，否則 toggleWholeNumber() 會把它清掉。
      if (w1 > 0 || w2 > 0) $i("show-whole-cb")!.checked = true;

      const context = params.get("context");
      if (context) currentWordProblemTemplate = context;
    }

    // window.onload sequence
    applyIncomingParams();
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
      pieceDrag = null;
      endPieceDrag();
      document.getElementById("hint-finger")?.remove();
      document.querySelectorAll(".fa48-fly").forEach((el) => el.remove());
      if (window.__FA48 === api) delete window.__FA48;
      de.style.removeProperty("--max-wholes");
      de.style.removeProperty("--unit-min-w");
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
