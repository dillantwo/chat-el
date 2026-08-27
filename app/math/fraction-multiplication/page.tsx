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
.fa45-root .lang-btn.btn-restart{ padding:5px 12px; font-size:0.85rem; border-color:#e67e22; color:#e67e22; box-shadow:0 3px 0 #e67e22; }
.fa45-root .lang-btn.btn-restart:hover{ background:#e67e22; color:#fff; }
.fa45-root .lang-btn.btn-restart:active{ box-shadow:0 0 0 #e67e22; transform:translateY(3px); background:#d35400; color:#fff; }
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

/* 長條圖與數線放在同一個橫向捲動區：整數部分多（例如帶分數 9 2/8）時不再折行，
   而是保持一排並顯示水平捲軸，長條圖與數線一起捲動、刻度永遠對齊。 */
.fa45-root .bars-column{ width:70%; display:flex; flex-direction:column;
  overflow-x:auto; overflow-y:hidden; padding:4px 14px 8px 12px;
  overscroll-behavior-x:contain; scrollbar-width:thin; scrollbar-color:#bdc3c7 #eef1f3; }
.fa45-root .bars-column::-webkit-scrollbar{ height:10px; }
.fa45-root .bars-column::-webkit-scrollbar-track{ background:#eef1f3; border-radius:5px; }
.fa45-root .bars-column::-webkit-scrollbar-thumb{ background:#bdc3c7; border-radius:5px; }
.fa45-root .bars-column::-webkit-scrollbar-thumb:hover{ background:#95a5a6; }
.fa45-root .bar-wrap-container{ width:100%; display:flex; flex-wrap:nowrap; gap:15px; justify-content:flex-start; align-items:center;
  background:transparent; border:none; min-height:60px; transition:0.5s ease; }
.fa45-root .bar-unit{ position:relative; height:50px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes));
  min-width:var(--unit-min-w, 120px); flex:none; border:var(--bar-border-width) solid var(--bar-border-color); box-sizing:border-box;
  background:var(--bar-bg); border-radius:var(--bar-border-radius); overflow:hidden; }
.fa45-root .bar-fill{ height:100%; transition:width var(--anim-time) ease; position:absolute; z-index:1; top:0; left:0; opacity:var(--bar-fill-opacity); }
.fa45-root .grid-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none; overflow:hidden; }
.fa45-root .abs-thick-line{ position:absolute; top:0; width:var(--grid-thick-width); height:100%; background:var(--grid-thick-color); transform:translateX(-50%); z-index:4; }
.fa45-root .abs-thin-line{ position:absolute; top:0; width:var(--grid-thin-width); height:100%; background:var(--grid-thin-color); transform:translateX(-50%); z-index:3; }
.fa45-root .bar-wrap-container.continuous{ gap:0 !important; }
.fa45-root .bar-wrap-container.continuous .bar-unit{ width:calc(100% / var(--max-wholes)) !important; border-right:none; border-radius:0; }
/* 帶分數時整數交界處原本是靠 .bar-unit 自己的 2px 左框畫出來的，
   比單位內的 3px 分數格線細、而且整條線都落在交界右側（box-sizing:border-box）。
   這裡把內側左框拿掉，交界線改用跟分數格線同一個 .abs-thick-line 來畫
   （見 appendUnitEdges：左右兩個單位各畫一半，合起來就是置中的 3px 粗線），
   這樣有沒有帶分數，中間線條的粗細與位置都一致。 */
.fa45-root .bar-wrap-container.continuous .bar-unit:not(:first-child){ border-left:none; }
.fa45-root .bar-wrap-container.continuous .bar-unit:last-child{ border-right:var(--bar-border-width) solid var(--bar-border-color); border-top-right-radius:4px; border-bottom-right-radius:4px; }
.fa45-root .bar-wrap-container.continuous .bar-unit:first-child{ border-top-left-radius:4px; border-bottom-left-radius:4px; }
.fa45-root .nl-wrap-container{ width:100%; display:flex; flex-wrap:nowrap; justify-content:flex-start; align-items:flex-start;
  min-height:56px; margin-top:2px; border:none; position:relative; gap:15px; }
.fa45-root .nl-wrap-container.continuous{ gap:0 !important; }
.fa45-root .nl-unit{ position:relative; height:56px; width:calc((100% - (var(--max-wholes) - 1) * 15px) / var(--max-wholes)); min-width:var(--unit-min-w, 120px); flex:none; box-sizing:border-box; }
.fa45-root .nl-wrap-container.continuous .nl-unit{ width:calc(100% / var(--max-wholes)) !important; }
/* 數線刻度標籤：收緊分數左右內距，讓每個標籤佔的寬度小一點，比較不容易擠在一起 */
.fa45-root .nl-unit .inline-frac span{ padding:1px 2px; }
/* 帶分數刻度（例如 1 1/8）：去掉 .inline-frac 預設的 0 5px 外距，
   整數和分數才會靠在一起，讀起來像一個帶分數而不是兩個數字。 */
.fa45-root .nl-unit .inline-frac{ margin:0; }

/* 填答區搬到 #anim-area 裏（主長條圖下面、步驟紀錄上面），所以要自己置中：
   #anim-area 是 align-items:stretch 的 flex column，不像 .animation-zone 會幫忙居中。 */
.fa45-root #bottom-answer-zone{ width:100%; max-width:650px; align-self:center; background:#fff8e1; padding:20px; border-radius:15px;
  border:2px dashed var(--red); margin:0 auto; display:none; flex-direction:column; align-items:center; gap:10px;
  box-shadow:0 4px 10px rgba(0,0,0,0.05); transition:opacity 0.5s; z-index:50; position:relative; }
.fa45-root .feedback-msg{ font-size:1.2rem; font-weight:bold; min-height:28px; margin-top:5px; opacity:0; transition:opacity 0.3s, color 0.3s; text-align:center; }
.fa45-root .drag-block{ transition:transform 0.1s, opacity 0.2s, box-shadow 0.2s; touch-action:manipulation; }

/* 步驟紀錄
   主長條圖（#bar1-row）固定在上面，動畫都在那裏發生；每做完一步就把當時的樣子複製
   一份，依序疊在主長條圖「下面」的 #step-history 裏。主長條圖位置不會被推走，學生
   要點它、或對照上下的變化都比較穩定。 */
.fa45-root #step-history{ width:100%; display:none; flex-direction:column; gap:10px;
  background:#f7f9fa; border:1px solid #e4eaee; border-radius:14px; padding:12px 14px; }
.fa45-root .step-history-head{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;
  font-size:1rem; font-weight:bold; color:var(--dark); border-bottom:1px dashed #d7dfe4; padding-bottom:8px; }
.fa45-root .step-history-hint{ font-size:0.85rem; font-weight:normal; color:#7f8c8d; }
.fa45-root #step-history-list{ display:flex; flex-direction:column; gap:10px; }
.fa45-root .step-card{ width:100%; background:#fff; border:1px solid #e1e8ed; border-left:5px solid var(--success);
  border-radius:10px; padding:7px 12px 8px; display:flex; flex-direction:column; align-items:stretch; gap:2px; }
.fa45-root .step-card-title{ display:flex; align-items:center; gap:8px; font-size:0.9rem; color:var(--dark); flex-wrap:wrap; }
.fa45-root .step-card-badge{ flex:none; background:var(--success); color:#fff; border-radius:12px; padding:2px 9px; font-size:0.8rem; font-weight:bold; }
.fa45-root .step-card-text{ font-weight:bold; display:inline-flex; align-items:center; flex-wrap:wrap; }
.fa45-root .step-card-text .inline-frac{ font-size:0.9em; }
/* 與 #bar1-row 中央那條 70% 寬的長條圖對齊，各步驟的格線才會上下對照得起來 */
.fa45-root .step-card-bars{ width:70% !important; margin:0 auto; padding:2px 0 2px; }
.fa45-root .step-card .bar-wrap-container{ min-height:0; }
.fa45-root .step-card .bar-unit{ height:30px; }
.fa45-root .step-card .nl-unit{ height:44px; }

/* 主長條圖左邊的狀態標籤：步驟 1 顯示被乘數，之後改成「目前步驟」提示，
   讓學生一眼分得出「上面是正在做的」、「下面是已完成的紀錄」。 */
.fa45-root .live-step-badge{ display:inline-block; background:var(--blue); color:#fff; border-radius:12px;
  padding:4px 10px; font-size:0.9rem; font-weight:bold; line-height:1.3; }
.fa45-root .live-step-badge small{ display:block; font-size:0.72rem; font-weight:normal; opacity:0.9; }
.fa45-root .live-step-badge.done{ background:var(--success); }

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
      <button class="lang-btn btn-restart" onclick="window.__FA45.restart()" title="回到這一題的初始狀態，重新開始操作">↺ 重新開始</button>
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

      <div id="step-history">
        <div class="step-history-head">
          📋 步驟紀錄
          <span class="step-history-hint">上面是目前的長條圖，下面依序保留每一步做完的樣子</span>
        </div>
        <div id="step-history-list"></div>
      </div>
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
  restart: () => void;
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

    /**
     * 動畫節奏（毫秒，1.0 倍速）。全部集中在這裏，要調快慢改這一份就好。
     * 每段動畫「之前」留 read 時間讓學生看說明，「之後」留 hold 時間看結果，
     * 再把那一步存進步驟紀錄，所以整體比原本慢，但每一步都看得清楚。
     * 速度滑桿（0.5x～3x）仍然可以整體加速。
     */
    const TIMING = {
      readStep: 1100, // 顯示步驟說明後先停一下再開始動
      subdivide: 2400, // 虛線往下長、把每格再細分
      holdSubdivide: 1300, // 細分完停一下
      extract: 2400, // 提取（保留的留下、其餘淡出）
      holdExtract: 1300, // 提取完停一下
      travel: 900, // 重排時單一方塊移動的時間
      stagger: 90, // 方塊依序出發的間隔（總量會被上限壓住）
      staggerTotal: 1500, // 所有方塊出發的總時間上限
      settle: 400, // 重排結束後的收尾
      autoChain: 2200, // 直接點乘數時，先播步驟 1 再接步驟 2 的間隔
    };
    /** 依目前速度換算實際毫秒數。 */
    const ms = (v: number) => v / currentSpeed;

    /** 步驟 4 的說明，提示文字與步驟紀錄卡片共用同一句。 */
    const STEP4_TEXT = "把提取出的紅色微細格子依序移動，整齊排列在一起";

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

    /**
     * 「重新開始」要回到的狀態。載入時（套用完 dashboard 傳進來的題目參數之後）拍一次快照，
     * 之後不論學生怎麼操作、重排、填答案，甚至按了「隨機出題」，都能回到這一題最初的樣子。
     * 有帶題目參數就回到那題；沒有就回到輸入框的預設值。
     */
    let initialSnapshot: {
      w1: string;
      n1: string;
      d1: string;
      w2: string;
      n2: string;
      d2: string;
      showWhole: boolean;
      template: string | null;
    } | null = null;

    function captureInitialSnapshot() {
      initialSnapshot = {
        w1: $i("w1")!.value,
        n1: $i("n1")!.value,
        d1: $i("d1")!.value,
        w2: $i("w2")!.value,
        n2: $i("n2")!.value,
        d2: $i("d2")!.value,
        showWhole: $i("show-whole-cb")!.checked,
        template: currentWordProblemTemplate,
      };
    }

    function restart() {
      const snap = initialSnapshot;
      if (!snap) return;

      $i("w1")!.value = snap.w1;
      $i("n1")!.value = snap.n1;
      $i("d1")!.value = snap.d1;
      $i("w2")!.value = snap.w2;
      $i("n2")!.value = snap.n2;
      $i("d2")!.value = snap.d2;
      $i("show-whole-cb")!.checked = snap.showWhole;
      currentWordProblemTemplate = snap.template;

      // 重排動畫的殘影會掛在 document.body 上（比照卸載時的清理）。
      document.querySelectorAll(".fa45-ghost").forEach((el) => el.remove());

      // toggleWholeNumber 會依 checkbox 顯示/隱藏整數輸入框，最後呼叫 updateUI()，
      // 由 updateUI() 清空長條圖、重設動畫階段（isPhase1OrLater / isRearranged 等）
      // 並收掉下方填答區。
      toggleWholeNumber();
      // updateUI() 會清掉閒置提示，比照載入流程把教學手指排回來。
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = window.setTimeout(showIdleHint, 3000);
      timers.push(idleTimer);
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
      // 每個「整數格」的最小寬度。數線上每個刻度標籤（例如 2/8、1 2/8）都需要一定
      // 的水平空間，格子太窄時標籤會互相重疊看不清楚。用最細的分母（相乘後的
      // d1×d2）計算，動畫各階段的整數格寬度才不會忽大忽小；算出來比可用寬度大時，
      // .bars-column 會出現水平捲軸。
      const cd = Math.max(1, vals.d1 * vals.d2);
      const perTick = 6 + 8 * String(cd).length + (maxW > 1 ? 12 : 0);
      de.style.setProperty("--unit-min-w", `${Math.max(120, Math.ceil(perTick * cd))}px`);
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
      } else {
        wpEl.style.display = "none";
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
      clearStepHistory();
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

    /**
     * 整數單位交界處的分隔線（帶分數才會出現）。
     * .bar-unit 有 overflow:hidden，所以一條置中的線放在單一單位裡會被裁掉一半；
     * 這裡在左邊單位的 100% 與右邊單位的 0% 各放一條，各自露出一半，
     * 拼起來就是一條與單位內分數格線（.abs-thick-line）完全相同的置中粗線。
     */
    function appendUnitEdges(unit: HTMLElement, idx: number, total: number) {
      const addEdge = (left: string) => {
        const edge = document.createElement("div");
        edge.className = "abs-thick-line unit-edge";
        edge.style.left = left;
        unit.appendChild(edge);
      };
      if (idx > 0) addEdge("0");
      if (idx < total - 1) addEdge("100%");
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

    // ---------- 步驟時間軸（保留每個做完的步驟） ----------
    /** 快照是純展示用的複製品：拿掉 id（避免和實際動畫用的 unit-N / bar1-nl 撞名）與 inline 事件。 */
    function stripInteractive(el: HTMLElement) {
      el.removeAttribute("id");
      el.removeAttribute("onclick");
      el.removeAttribute("title");
      el.style.cursor = "default";
      el.querySelectorAll<HTMLElement>("[id]").forEach((c) => c.removeAttribute("id"));
      el.querySelectorAll<HTMLElement>("[onclick]").forEach((c) => c.removeAttribute("onclick"));
    }

    /** 標題列用的分數：比照 getDisplayHtml，但整數部分不放大，才不會撐爆一行小字。 */
    function getCompactDisplayHtml(w: number, n: number, d: number, color: string) {
      const frac = getFracHtml(n, d, color);
      if (w > 0) {
        return `<span style="display:inline-flex; align-items:center; gap:2px;"><b style="color:${color};">${w}</b>${frac}</span>`;
      }
      return frac;
    }

    /**
     * 把目前長條圖（含數線，如果正在顯示）的樣子凍結成一張卡片，附在主長條圖下面的
     * 步驟紀錄裏。主長條圖（#bar1-row）永遠留在上面繼續動，紀錄由上而下依步驟累積，
     * 所以加入新卡片不會推動學生正要點的那條長條圖。
     */
    function snapshotStep(num: number, text: string) {
      const history = $e("step-history");
      const list = $e("step-history-list");
      const wrap = $e("main-bar-wrap");
      if (!history || !list || !wrap) return;

      const card = document.createElement("div");
      card.className = "step-card fade-in-slow";

      const title = document.createElement("div");
      title.className = "step-card-title";
      title.innerHTML = `<span class="step-card-badge">✓ 步驟 ${num}</span><span class="step-card-text">${text}</span>`;
      card.appendChild(title);

      const column = document.createElement("div");
      column.className = "bars-column step-card-bars";

      const barClone = wrap.cloneNode(true) as HTMLElement;
      stripInteractive(barClone);
      column.appendChild(barClone);

      const nl = $e("bar1-nl");
      if (nl && nl.style.display !== "none") {
        const nlClone = nl.cloneNode(true) as HTMLElement;
        stripInteractive(nlClone);
        nlClone.style.display = "flex";
        column.appendChild(nlClone);
      }

      card.appendChild(column);
      list.appendChild(card);
      history.style.display = "flex";
    }

    function clearStepHistory() {
      const history = $e("step-history");
      const list = $e("step-history-list");
      if (list) list.innerHTML = "";
      if (history) history.style.display = "none";
    }

    /**
     * 主長條圖左邊的狀態標籤。步驟 1 由 onFrac1Click 放被乘數的分數，
     * 之後改成「目前步驟」的膠囊標籤，跟下面的步驟紀錄區分開來。
     */
    function setLiveStepTag(num: number, note: string, done = false) {
      const el = $e("label1");
      if (!el) return;
      el.style.opacity = "1";
      el.innerHTML = `<span class="live-step-badge${done ? " done" : ""}">步驟 ${num}<small>${note}</small></span>`;
    }

    function onFrac1Click() {
      if (isAnimating) return;
      isPhase1OrLater = false;
      awaitingRearrangeClick = false;
      currentTutorialStep = 1;
      // 重新從步驟 1 開始，之前累積的步驟卡片要一起清掉。
      clearStepHistory();

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
        appendUnitEdges(unit, i, maxW);
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

    function makeGhost(rect: DOMRect, travelMs: number) {
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
      ghost.style.transition = `all ${Math.round(travelMs)}ms cubic-bezier(0.25, 1, 0.5, 1)`;
      ghost.style.zIndex = "100";
      ghost.style.pointerEvents = "none";
      return ghost;
    }

    /** 重排時方塊「依序出發」的間隔：格子多時自動縮短，總出發時間不超過上限。 */
    function rearrangeStagger(count: number) {
      return ms(Math.min(TIMING.stagger, TIMING.staggerTotal / Math.max(1, count)));
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
        const travel = ms(TIMING.travel);
        const stagger = rearrangeStagger(animBlocks.length);

        animBlocks.forEach((b) => {
          const rect = b.el.getBoundingClientRect();
          preRearrangePositions.push({ left: b.el.style.left, unit: b.el.parentElement as HTMLElement });
          const ghost = makeGhost(rect, travel);
          document.body.appendChild(ghost);
          ghosts.push(ghost);
          b.el.style.visibility = "hidden";
        });

        // 一格一格依序出發（原本是全部同時飛過去，太快看不出「依序移動」）。
        ghosts.forEach((ghost, i) => {
          T(() => {
            const unitIdx = Math.floor(i / slotsPerUnit);
            const rem = i % slotsPerUnit;
            const targetUnit = $e(`unit-${unitIdx}`);
            if (!targetUnit) return;
            const tRect = targetUnit.getBoundingClientRect();
            const targetLeft = tRect.left + rem * (tRect.width / slotsPerUnit);
            ghost.style.left = `${targetLeft}px`;
            ghost.style.top = `${tRect.top}px`;
          }, 60 + i * stagger);
        });

        T(
          () => {
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
          },
          60 + Math.max(0, ghosts.length - 1) * stagger + travel + 80,
        );
      });
    }

    function rearrangeBackward() {
      return new Promise<void>((resolve) => {
        const ghosts: HTMLElement[] = [];
        const travel = ms(TIMING.travel);
        const stagger = rearrangeStagger(animBlocks.length);

        animBlocks.forEach((b) => {
          const rect = b.el.getBoundingClientRect();
          const ghost = makeGhost(rect, travel);
          document.body.appendChild(ghost);
          ghosts.push(ghost);
          b.el.style.visibility = "hidden";
        });

        // 先把實體方塊放回原位（才量得到目標座標），鬼影再依序飛回去。
        const targets = animBlocks.map((b, i) => {
          const orig = preRearrangePositions[i];
          orig.unit.appendChild(b.el);
          b.el.style.left = orig.left;
          const tRect = b.el.getBoundingClientRect();
          return { left: tRect.left, top: tRect.top };
        });

        ghosts.forEach((ghost, i) => {
          T(() => {
            ghost.style.left = `${targets[i].left}px`;
            ghost.style.top = `${targets[i].top}px`;
          }, 60 + i * stagger);
        });

        T(
          () => {
            animBlocks.forEach((b) => (b.el.style.visibility = "visible"));
            ghosts.forEach((g) => g.remove());
            isRearranged = false;
            resolve();
          },
          60 + Math.max(0, ghosts.length - 1) * stagger + travel + 80,
        );
      });
    }

    async function onFrac2Click() {
      if (isAnimating) return;
      const rowCheck = $e("bar1-row")!;
      // 還沒畫被乘數，或已經跑過一次（要重播）時，先回到步驟 1 的乾淨長條圖再開始。
      if (rowCheck.style.display === "none" || isPhase1OrLater) {
        onFrac1Click();
        T(onFrac2Click, ms(TIMING.autoChain));
        return;
      }

      isAnimating = true;
      isPhase1OrLater = true;
      currentTutorialStep = 2;
      hideFinger();

      const vals = getSafeValues();

      // 步驟 1 的長條圖等一下會被重建成細分後的版本，先存一張到下面的步驟紀錄
      //（此時數線還在，所以紀錄裏的步驟 1 會連數線一起保留）。
      snapshotStep(
        1,
        `被乘數 ${getCompactDisplayHtml(vals.w1, vals.n1, vals.d1, "var(--red)")} 的長條圖：每個整體平均分成 <b>${vals.d1}</b> 份`,
      );

      const nlCb = $i("show-nl-cb");
      if (nlCb) {
        nlCb.disabled = true;
        nlCb.checked = false;
      }
      $e("bar1-nl")!.style.display = "none";

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

        appendUnitEdges(unit, i, maxW);

        wrap.appendChild(unit);
      }

      // Step 2: subdivide by multiplier's denominator
      const step2Text = `引入乘數的分母 <b style="color:var(--blue)">${D}</b>，把被乘數的每一格平均再切分成 <b>${D}</b> 份`;
      setAnimStep(2, step2Text);
      setLiveStepTag(2, "進行中");
      // 先讓學生讀完說明再開始動。
      await delay(ms(TIMING.readStep));
      if (!alive) return;
      await animateSubdivide(dashedLines, ms(TIMING.subdivide));
      if (!alive) return;
      await delay(ms(TIMING.holdSubdivide));
      if (!alive) return;
      // 細分完成：先把這一步的樣子存進下面的步驟紀錄，主長條圖再接著做提取。
      snapshotStep(2, step2Text);

      // Step 3: extract by multiplier's numerator
      const step3Text =
        C <= D
          ? `依乘數的分子 <b style="color:var(--blue)">${C}</b>，從每 <b>${D}</b> 小格中提取 <b style="color:var(--red)">${C}</b> 格（其餘淡出）`
          : `乘數大於 1，補上不足的格子，共提取 <b style="color:var(--red)">${C}</b> 倍的份量`;
      setAnimStep(3, step3Text);
      setLiveStepTag(3, "進行中");
      await delay(ms(TIMING.readStep));
      if (!alive) return;
      await animateExtract(ms(TIMING.extract));
      if (!alive) return;
      await delay(ms(TIMING.holdExtract));
      if (!alive) return;

      animBlocks = animBlocks.filter((b) => {
        if (b.state === "discarded") {
          b.el.remove();
          return false;
        }
        return true;
      });

      // 提取完成：同樣存一張紀錄，最後的「整齊排列」還是在上面的主長條圖進行。
      snapshotStep(3, step3Text);

      // Step 4: wait for user click to rearrange
      isAnimating = false;
      awaitingRearrangeClick = true;
      currentTutorialStep = 2;
      setAnimStep(4, `👉 點擊上方的長條圖，${STEP4_TEXT}`);
      setLiveStepTag(4, "等你點擊");
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
        `<span style="color:var(--dark); font-weight:bold; vertical-align:middle;">數一數！紅色微細格子共 <b style="color:var(--red)">${resultN}</b> 格（分子）；每個整體分成 <b style="color:var(--blue)">${resultD}</b> 格（分母）。請填寫答案，也可點擊上方的長條圖切換排列。</span>`;
      setLiveStepTag(5, "完成", true);

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
        setAnimStep(4, STEP4_TEXT);
        setLiveStepTag(4, "進行中");
        rearrangeForward().then(() => {
          isRearranging = false;
          // 排好之後停一下再進到填答案，並把步驟 4 也存進紀錄（之後學生切換排列也不會影響紀錄）。
          T(() => {
            snapshotStep(4, STEP4_TEXT);
            finishAnimation();
          }, ms(TIMING.settle));
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
      restart,
    };
    window.__FA45 = api;

    de.style.setProperty("--max-wholes", "1");
    de.style.setProperty("--unit-min-w", "120px");
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

    // 讀取 dashboard 傳入的參數：whole1/num1/den1、whole2/num2/den2，以及 context
    // （題目文字，分數位置為 [FRAC1] / [FRAC2]）。沒有參數時沿用輸入框的預設 2/3 × 1/2，
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

      setInt("n1", "num1", 1, 10);
      setInt("d1", "den1", 1, 10);
      setInt("n2", "num2", 1, 10);
      setInt("d2", "den2", 1, 10);
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
    // 套用完題目參數後拍快照，「重新開始」就能回到這一題最初的狀態。
    captureInitialSnapshot();
    updateSpeed();
    toggleWholeNumber();
    updateUI();
    // updateUI() 會清掉閒置提示，這裏補回原本由 randomChallenge() 排定的教學手指。
    idleTimer = window.setTimeout(showIdleHint, 3000);
    timers.push(idleTimer);
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
      de.style.removeProperty("--unit-min-w");
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
