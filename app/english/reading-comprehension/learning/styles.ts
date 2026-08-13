// Scoped styles for the Reading Comprehension Learning page.
// Everything is namespaced under `.rc-learning` so it never leaks into the
// rest of the app. Dark mode follows the OS preference, mirroring the original
// static page behaviour.
export const learningStyles = `
.rc-learning {
  --bg-card: #ffffff;
  --bg-article: #fafafa;
  --accent-pink: #146ef5;
  --accent-mint: #00b53d;
  --accent-yellow: #ff8c42;
  --accent-blue: #146ef5;
  --accent-purple: #7a3dff;
  --accent-orange: #ff6b00;
  --text-primary: #080808;
  --text-secondary: #5a5a5a;
  --text-muted: #9a9a9a;
  --border-light: #ededed;
  --shadow-sm: 0 1px 3px rgba(8,8,8,0.06);
  --shadow-md: 0 4px 16px rgba(8,8,8,0.08);
  --shadow-lg: 0 10px 40px rgba(8,8,8,0.12);
  --correct-bg: #ecfdf3;
  --correct-border: #16a34a;
  --wrong-bg: #fef2f2;
  --wrong-border: #ef4444;
  --hint-bg: #fff7ed;
  --hint-border: #fdba74;
  --radius: 8px;
  --radius-sm: 6px;
  position: relative;
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.rc-learning * { box-sizing: border-box; }

.rc-learning .app-shell { width: 100%; max-width: 1400px; margin: 0 auto; padding: 12px clamp(16px, 4vw, 48px) 60px; position: relative; z-index: 1; }
.rc-learning .narrow { width: 100%; max-width: 960px; margin: 0 auto; }

.rc-learning .app-header { text-align: center; padding: 22px 16px 14px; }
.rc-learning .app-header h1 {
  font-weight: 700; font-size: 26px; display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  margin-bottom: 4px;
}
.rc-learning .app-header p { color: var(--text-muted); font-size: 14px; font-weight: 600; }

.rc-learning .nav-tabs {
  display: flex; gap: 6px; margin: 0 auto 18px; overflow-x: auto; padding-bottom: 4px;
  -webkit-overflow-scrolling: touch; max-width: 960px;
}
.rc-learning .nav-tabs::-webkit-scrollbar { display: none; }
.rc-learning .nav-tab {
  flex-shrink: 0; padding: 10px 16px; border-radius: var(--radius-sm);
  font-weight: 500; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;
  border: 2px solid var(--border-light); background: var(--bg-card); color: var(--text-muted);
  cursor: pointer; transition: all 0.25s ease; white-space: nowrap;
}
.rc-learning .nav-tab:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.rc-learning .nav-tab.active { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: #fff; border-color: transparent; box-shadow: 0 3px 12px rgba(77,171,247,0.3); }

.rc-learning .section-panel { animation: rcFadeIn 0.4s ease; }

.rc-learning .split-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.rc-learning .split-left {
  position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow-y: auto; padding-right: 4px;
  scrollbar-width: thin; scrollbar-color: var(--border-light) transparent;
}
.rc-learning .split-left::-webkit-scrollbar { width: 5px; }
.rc-learning .split-left::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 10px; }
.rc-learning .split-right { min-width: 0; }

.rc-learning .card {
  background: var(--bg-card); border-radius: var(--radius); padding: 22px 18px;
  margin-bottom: 14px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light);
}
.rc-learning .card-title { font-weight: 600; font-size: 17px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
.rc-learning .card-title .icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }

.rc-learning .webpage-sim { background: var(--bg-article); border-radius: var(--radius-sm); border: 2px solid var(--border-light); overflow: hidden; margin: 10px 0; transition: border-color 0.4s ease, box-shadow 0.4s ease; }
.rc-learning .webpage-topbar { background: linear-gradient(90deg, #f0f0f0, #e8e8e8); padding: 7px 12px; display: flex; align-items: center; gap: 7px; border-bottom: 1px solid var(--border-light); }
.rc-learning .browser-dot { width: 9px; height: 9px; border-radius: 50%; }
.rc-learning .browser-dot.r { background: #ff6058; }
.rc-learning .browser-dot.y { background: #ffbd2e; }
.rc-learning .browser-dot.g { background: #27ca40; }
.rc-learning .url-bar { flex: 1; background: var(--bg-card); border-radius: 6px; padding: 3px 10px; font-size: 11px; color: var(--text-muted); }
.rc-learning .webpage-body { padding: 16px 14px; }

.rc-learning .ad-header { text-align: center; margin-bottom: 14px; }
.rc-learning .ad-header h2 { font-weight: 700; font-size: 19px; background: linear-gradient(90deg, #E8477C, #FF8C42, #FFD166, #3CC9A3, #4DABF7, #9B72CF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 3px; }
.rc-learning .ad-subtitle { color: var(--text-secondary); font-size: 13px; font-style: italic; }
.rc-learning .ad-title { font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 3px; }
.rc-learning .gift-banner { background: linear-gradient(135deg, var(--accent-mint), var(--accent-blue)); color: #fff; border-radius: var(--radius-sm); padding: 12px 14px; text-align: center; margin: 14px 0 0; font-size: 12px; font-weight: 600; line-height: 1.5; }
.rc-learning .highlight-clue { transition: all 0.4s ease; border-radius: 4px; padding: 1px 4px; }

.rc-learning .ice-cream-deco { text-align: center; font-size: 30px; margin: 6px 0 12px; animation: rcBounce 2s infinite; }

.rc-learning .price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
.rc-learning .price-card { text-align: center; padding: 10px 6px; border-radius: var(--radius-sm); border: 2px solid var(--border-light); background: var(--bg-card); }
.rc-learning .price-card .label { font-weight: 500; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.rc-learning .price-card .price { font-weight: 700; font-size: 17px; color: var(--accent-pink); }

.rc-learning .special-banner { background: linear-gradient(135deg, var(--accent-yellow), var(--accent-orange)); color: #fff; border-radius: var(--radius-sm); padding: 14px; text-align: center; margin: 14px 0; position: relative; overflow: hidden; }
.rc-learning .special-banner::before { content: '\\2B50'; position: absolute; top: 5px; left: 8px; font-size: 16px; animation: rcTwinkle 1.5s infinite; }
.rc-learning .special-banner::after { content: '\\2B50'; position: absolute; top: 5px; right: 8px; font-size: 16px; animation: rcTwinkle 1.5s infinite 0.5s; }
.rc-learning .special-banner h3 { font-weight: 700; font-size: 14px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 1px; }
.rc-learning .special-banner p { font-size: 12px; font-weight: 600; line-height: 1.5; }

.rc-learning .comment-item { padding: 12px 0; border-bottom: 1px solid var(--border-light); }
.rc-learning .comment-item:last-child { border-bottom: none; }
.rc-learning .comment-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.rc-learning .comment-user { font-weight: 600; font-size: 13px; color: var(--accent-purple); }
.rc-learning .comment-date { font-size: 10px; color: var(--text-muted); }
.rc-learning .comment-text { font-size: 13px; line-height: 1.6; color: var(--text-secondary); }

.rc-learning .vocab-word { text-decoration: underline; text-decoration-style: dotted; text-decoration-color: var(--accent-purple); cursor: help; position: relative; font-weight: 700; color: var(--accent-purple); }
.rc-learning .vocab-word:hover .vocab-tip, .rc-learning .vocab-word:focus .vocab-tip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.rc-learning .vocab-tip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(6px); background: var(--bg-card); border: 2px solid var(--accent-purple); border-radius: 10px; padding: 8px 12px; font-size: 11px; font-weight: 400; color: var(--text-primary); white-space: normal; width: max-content; max-width: 200px; box-shadow: var(--shadow-md); opacity: 0; visibility: hidden; transition: all 0.25s ease; z-index: 10; text-decoration: none; pointer-events: none; }
.rc-learning .vocab-tip::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -5px; border: 5px solid transparent; border-top-color: var(--accent-purple); }

.rc-learning .pre-reading-list { list-style: none; padding: 0; margin: 0; }
.rc-learning .pre-reading-list li { padding: 9px 12px; margin-bottom: 7px; border-radius: var(--radius-sm); background: var(--hint-bg); border-left: 4px solid var(--accent-yellow); font-size: 13px; line-height: 1.5; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 7px; }
.rc-learning .pre-reading-list li svg { color: var(--accent-orange); flex-shrink: 0; margin-top: 2px; }

.rc-learning .skill-tag { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; margin: 3px; border-radius: 20px; font-size: 12px; font-weight: 600; background: var(--bg-article); border: 1px solid var(--border-light); color: var(--text-secondary); }

.rc-learning .question-card { background: var(--bg-card); border-radius: var(--radius); padding: 20px 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm); border: 2px solid var(--border-light); transition: border-color 0.4s ease; }
.rc-learning .q-progress { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-bottom: 12px; }
.rc-learning .q-progress-label { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
.rc-learning .q-progress-track { display: inline-flex; gap: 6px; }
.rc-learning .q-progress-dot { width: 22px; height: 6px; border-radius: 99px; background: var(--border-light); transition: background 0.3s ease; }
.rc-learning .q-progress-dot.active { background: var(--accent-blue); }
.rc-learning .q-progress-dot.done { background: var(--accent-mint); }
.rc-learning .q-nav-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
.rc-learning .q-nav-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 99px; font-weight: 600; font-size: 14px; cursor: pointer; border: 2px solid var(--border-light); transition: all 0.2s ease; }
.rc-learning .q-nav-btn.back { background: var(--bg-card); color: var(--text-secondary); }
.rc-learning .q-nav-btn.back:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.rc-learning .q-nav-btn.next { background: linear-gradient(135deg,var(--accent-blue),var(--accent-purple)); color: #fff; border-color: transparent; box-shadow: 0 3px 12px rgba(20,110,245,0.3); }
.rc-learning .q-nav-btn.next:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(20,110,245,0.4); }
.rc-learning .question-card.answered-correct { border-color: var(--correct-border); }
.rc-learning .question-card.answered-wrong { border-color: var(--wrong-border); }
.rc-learning .q-number { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-blue); margin-bottom: 6px; }
.rc-learning .q-text { font-size: 15px; font-weight: 700; line-height: 1.6; margin-bottom: 14px; color: var(--text-primary); }

.rc-learning .options-list { list-style: none; padding: 0; margin: 0; }
.rc-learning .option-btn { width: 100%; text-align: left; padding: 11px 14px; margin-bottom: 7px; border-radius: var(--radius-sm); border: 2px solid var(--border-light); background: var(--bg-card); font-size: 14px; font-weight: 600; color: var(--text-primary); cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; gap: 10px; }
.rc-learning .option-btn:hover:not(.disabled) { border-color: var(--accent-blue); background: rgba(77,171,247,0.06); }
.rc-learning .opt-letter { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: var(--border-light); color: var(--text-secondary); flex-shrink: 0; transition: all 0.25s ease; }
.rc-learning .option-btn:hover:not(.disabled) .opt-letter { background: var(--accent-blue); color: #fff; }
.rc-learning .option-btn.correct { border-color: var(--correct-border); background: var(--correct-bg); }
.rc-learning .option-btn.correct .opt-letter { background: var(--correct-border); color: #fff; }
.rc-learning .option-btn.wrong { border-color: var(--wrong-border); background: var(--wrong-bg); }
.rc-learning .option-btn.wrong .opt-letter { background: var(--wrong-border); color: #fff; }
.rc-learning .option-btn.disabled { pointer-events: none; opacity: 0.7; }
.rc-learning .option-btn.disabled.correct { opacity: 1; }

.rc-learning .hint-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.rc-learning .hint-btn { padding: 7px 14px; border-radius: 20px; border: 2px solid var(--hint-border); background: var(--hint-bg); font-weight: 500; font-size: 13px; color: var(--accent-orange); cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; gap: 6px; }
.rc-learning .hint-btn:hover { background: var(--accent-orange); color: #fff; border-color: var(--accent-orange); }
.rc-learning .hint-btn.strategy-btn { border-color: var(--accent-purple); color: var(--accent-purple); background: rgba(155,114,207,0.08); }
.rc-learning .hint-btn.strategy-btn:hover { background: var(--accent-purple); color: #fff; border-color: var(--accent-purple); }
.rc-learning .hint-box, .rc-learning .explain-box { margin-top: 10px; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 13px; line-height: 1.7; animation: rcFadeSlideUp 0.3s ease; }
.rc-learning .hint-box { background: var(--hint-bg); border: 1px solid var(--hint-border); color: var(--text-secondary); }
.rc-learning .explain-box { border: 1px solid var(--border-light); background: var(--bg-article); color: var(--text-secondary); }
.rc-learning .reading-strategy { margin-top: 8px; padding: 9px 12px; border-radius: var(--radius-sm); background: rgba(155,114,207,0.08); border-left: 3px solid var(--accent-purple); font-size: 12px; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 5px; }
.rc-learning .reading-strategy svg { color: var(--accent-purple); flex-shrink: 0; margin-top: 2px; }

.rc-learning .summary-skills { list-style: none; padding: 0; margin: 0; }
.rc-learning .summary-skills li { padding: 11px 12px; margin-bottom: 7px; border-radius: var(--radius-sm); background: var(--bg-article); border: 1px solid var(--border-light); font-size: 13px; line-height: 1.5; display: flex; align-items: flex-start; gap: 10px; color: var(--text-secondary); }
.rc-learning .skill-icon { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }

.rc-learning .celebration-card { text-align: center; padding: 28px 18px; }
.rc-learning .celebration-card .trophy { font-size: 52px; margin-bottom: 14px; }
.rc-learning .celebration-card h2 { font-size: 24px; margin-bottom: 6px; background: linear-gradient(135deg, var(--accent-yellow), var(--accent-orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.rc-learning .celebration-card p { color: var(--text-secondary); font-size: 14px; }
.rc-learning .final-score { font-size: 40px; font-weight: 700; margin: 14px 0; color: var(--accent-mint); }

.rc-learning .restart-btn { padding: 12px 30px; border-radius: 30px; border: none; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: #fff; font-weight: 600; font-size: 15px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(77,171,247,0.3); margin-top: 14px; display: inline-flex; align-items: center; gap: 6px; }
.rc-learning .restart-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(77,171,247,0.4); }

.rc-learning .pane-label { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; color: var(--accent-blue); margin-bottom: 10px; background: rgba(77,171,247,0.08); padding: 5px 14px; border-radius: 20px; }
.rc-learning .pane-label.questions { color: var(--accent-purple); background: rgba(155,114,207,0.08); }

.rc-learning .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: rcFadeIn 0.25s ease; }
.rc-learning .modal-box { background: var(--bg-card); border-radius: var(--radius); padding: 26px 22px; max-width: 340px; width: 100%; text-align: center; box-shadow: var(--shadow-lg); animation: rcPopIn 0.3s ease; }
.rc-learning .modal-box .modal-emoji { font-size: 42px; margin-bottom: 10px; }
.rc-learning .modal-box .modal-title { font-weight: 700; font-size: 18px; margin-bottom: 6px; }
.rc-learning .modal-box .modal-msg { font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px; }
.rc-learning .modal-ok { padding: 10px 26px; border-radius: 20px; border: none; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s ease; color: #fff; }
.rc-learning .modal-ok.green { background: var(--accent-mint); }
.rc-learning .modal-ok.pink { background: var(--accent-pink); }
.rc-learning .modal-ok:hover { transform: scale(1.05); }

.rc-learning .highlight-clue.glow { background: #FFD54F !important; color: #1A1625 !important; box-shadow: 0 0 0 3px #FFD54F, 0 0 16px 4px rgba(255,213,79,0.45) !important; border-radius: 4px; animation: rcHighlightPop 0.5s ease, rcHighlightPulse 1.8s ease-in-out 0.5s infinite; position: relative; z-index: 2; }
.rc-learning .special-banner .highlight-clue.glow { background: rgba(255,255,255,0.55) !important; color: #1A1625 !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.55), 0 0 16px 4px rgba(255,255,255,0.35) !important; }
.rc-learning .webpage-sim.clue-active { border-color: var(--accent-orange) !important; box-shadow: 0 0 20px rgba(255,140,66,0.2); }

@keyframes rcFadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes rcFadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes rcPopIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
@keyframes rcBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
@keyframes rcTwinkle { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
@keyframes rcHighlightPop { 0% { transform:scale(1); } 40% { transform:scale(1.08); } 100% { transform:scale(1); } }
@keyframes rcHighlightPulse { 0%,100% { box-shadow:0 0 0 3px #FFD54F,0 0 16px 4px rgba(255,213,79,0.45); } 50% { box-shadow:0 0 0 5px #FFD54F,0 0 22px 8px rgba(255,213,79,0.3); } }
@keyframes rcBadgeBounce { 0% { opacity:0; transform:translateX(-50%) translateY(6px); } 100% { opacity:1; transform:translateX(-50%) translateY(0); } }

@media (max-width: 820px) {
  .rc-learning .split-layout { grid-template-columns: 1fr; }
  .rc-learning .split-left { position: static; max-height: none; overflow-y: visible; padding-right: 0; }
}
@media (max-width: 420px) {
  .rc-learning .app-header h1 { font-size: 22px; }
  .rc-learning .price-grid { grid-template-columns: 1fr; gap: 6px; }
  .rc-learning .card { padding: 16px 12px; }
  .rc-learning .question-card { padding: 16px 12px; }
  .rc-learning .ad-header h2 { font-size: 16px; }
}
`;
