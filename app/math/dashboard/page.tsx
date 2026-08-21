"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  Square,
  Bot,
  User,
  Pencil,
  ArrowLeft,
  ChevronLeft,
  PanelRight,
  Loader2,
  Sparkles,
  MessageSquare,
  Mic,
  MicOff,
  ImagePlus,
  Save,
  X,
  MousePointerClick,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChatAvatar } from "@/components/ChatAvatar";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToolbox, type ToolFromDB } from "@/contexts/ToolboxContext";
import { basePath } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { useVoiceInput } from "@/lib/use-voice-input";
import { DefaultChatTransport } from "ai";
import { VolumeChatPanel } from "@/components/VolumeChatPanel";
import { ClockChatPanel } from "@/components/ClockChatPanel";
import { createMathChatId, restoreUiMessages, serializeUiMessages, type MathChatHistoryItem, upsertMathChatHistory } from "@/lib/math-chat-history";

/** Strip $\text{...}$ wrappers so Chinese text renders as plain wrappable text. */
function stripTextModeLatex(text: string): string {
  // Replace $\text{content}$ with just content (handles one level of nested braces)
  return text.replace(/\$\\text\{((?:[^{}]|\{[^{}]*\})*)\}\$/g, "$1");
}

/**
 * Hosts that have been compromised and must never load inside the tool iframe.
 * polyfill.io was taken over in 2024 and now serves a 401 Basic-Auth challenge
 * (the browser "Sign in" popup) or malicious code, so any reference is removed.
 * This also scrubs tools that were generated/saved before the server-side guard
 * was added.
 */
const BLOCKED_IFRAME_HOSTS = ["polyfill.io", "polyfill.com", "bootcss.com", "bootcdn.net", "staticfile.org"];

function sanitizeAiToolHtml(html: string | null): string | undefined {
  if (!html) return undefined;
  const hostPattern = BLOCKED_IFRAME_HOSTS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const blocked = new RegExp(`(?:https?:)?//(?:[\\w.-]*\\.)?(?:${hostPattern})`, "i");
  return html
    .replace(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>[\s\S]*?<\/script>/gi, (m, _q, src) =>
      blocked.test(src) ? "" : m
    )
    .replace(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*\/?>/gi, (m, _q, src) => (blocked.test(src) ? "" : m))
    .replace(/<link\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[^>]*\/?>/gi, (m, _q, href) => (blocked.test(href) ? "" : m));
}

/** Only the tail of the stream is rendered — a big tool can be tens of thousands of characters. */
const GEN_CODE_TAIL_CHARS = 8000;

/**
 * Live feed of the HTML the model is writing. This is display-only text: it is
 * never mounted as HTML, and the iframe still waits for the sanitised document
 * the server sends when generation finishes.
 */
function GeneratingCodeFeed({ code, className }: { code: string; className?: string }) {
  const boxRef = useRef<HTMLPreElement>(null);

  // Follow the newest output.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [code]);

  const tail = code.length > GEN_CODE_TAIL_CHARS ? code.slice(-GEN_CODE_TAIL_CHARS) : code;

  return (
    <pre
      ref={boxRef}
      aria-live="polite"
      aria-label="AI 正在生成的 HTML 程式碼"
      className={`overflow-auto whitespace-pre-wrap break-all rounded-[6px] border border-[#e4e4e4] bg-[#fafafa] p-3 text-left font-mono text-[11px] leading-[1.55] text-[#3a3a3a] ${className ?? ""}`}
    >
      {tail || "…"}
    </pre>
  );
}

/**
 * Small "element inspector" injected into the preview iframe. The iframe is
 * sandboxed without allow-same-origin, so the parent cannot read its DOM — this
 * script runs *inside* the iframe and talks to the parent purely via
 * postMessage. When the parent enables select mode, hovering highlights
 * elements and a click posts back a *structural path* to the chosen element
 * (child indices from <html>, plus tag names for validation) and a human label.
 *
 * It deliberately does NOT serialize the live document. The live DOM is the
 * *hydrated* tree: a tool that builds 8 balloons in JS has those 8 balloons in
 * the DOM **and** still has the script that creates them. Feeding that snapshot
 * back to the model as "current HTML" made it return static-8 + generator-script,
 * which then ran again on reload and produced 16. The parent instead re-applies
 * the selection onto the pristine model output (see markTargetInPristineHtml).
 */
const INSPECTOR_SCRIPT = `<script data-mathai-inspector>
(function(){
  if (window.__mathaiInspector) return;
  window.__mathaiInspector = true;
  var enabled = false, hovered = null;
  var style = document.createElement('style');
  style.setAttribute('data-mathai-inspector','');
  style.textContent = '.__mathai_hover{outline:2px solid #146ef5 !important;outline-offset:-2px !important;cursor:pointer !important;background:rgba(20,110,245,0.08) !important;}';
  (document.head || document.documentElement).appendChild(style);

  function clearHover(){ if(hovered){ try{ hovered.classList.remove('__mathai_hover'); }catch(e){} hovered=null; } }
  function describe(el){
    var tag = el.tagName ? el.tagName.toLowerCase() : 'node';
    var id = el.id ? ('#'+el.id) : '';
    var cls = (typeof el.className==='string' && el.className.trim()) ? ('.'+el.className.trim().split(/\\s+/).slice(0,2).join('.')) : '';
    var txt = (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,24);
    return '<'+tag+'>'+id+cls+(txt?(' "'+txt+'"'):'');
  }
  /* Structural route to the element, expressed as child indices relative to
     <html>. The parent replays it against the pristine HTML string. The
     inspector's own nodes are always appended last (style -> end of <head>,
     scripts -> end of <body>), so they never shift these indices. */
  function pathOf(el){
    var path = [], node = el;
    while (node && node.parentElement) {
      var parent = node.parentElement;
      path.unshift({
        i: Array.prototype.indexOf.call(parent.children, node),
        tag: node.tagName ? node.tagName.toLowerCase() : ''
      });
      node = parent;
    }
    return path;
  }
  function setEnabled(v){
    enabled = v;
    try{ document.body.style.cursor = v ? 'crosshair' : ''; }catch(e){}
    if(!v) clearHover();
    parent.postMessage({ source:'math-ai-inspector-tool', type:'mode', enabled: v }, '*');
  }
  document.addEventListener('mouseover', function(e){ if(!enabled) return; clearHover(); hovered=e.target; if(hovered && hovered.classList) hovered.classList.add('__mathai_hover'); }, true);
  document.addEventListener('mouseout', function(e){ if(!enabled) return; if(e.target===hovered) clearHover(); }, true);
  document.addEventListener('click', function(e){
    if(!enabled) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target;
    if(!el || el===document.documentElement || el===document.body) return;
    var label = describe(el);
    var path = pathOf(el);
    clearHover();
    setEnabled(false);
    parent.postMessage({ source:'math-ai-inspector-tool', type:'selected', path: path, label: label }, '*');
  }, true);
  window.addEventListener('message', function(e){
    var d = e.data;
    if(!d || d.source!=='math-ai-inspector') return;
    if(d.type==='enable') setEnabled(true);
    else if(d.type==='disable') setEnabled(false);
  });
})();
</script>`;

/**
 * Fullscreen compatibility shim injected into the preview iframe.
 *
 * Generated tools call the standard `element.requestFullscreen()` /
 * `document.exitFullscreen()` and listen for `fullscreenchange`. The preview
 * iframe is sandboxed *without* `allow-same-origin`, and iPad/iOS Safari does
 * not reliably grant the native Fullscreen API to an element inside such an
 * iframe — so the unprefixed call is either `undefined` or silently rejected,
 * and the fullscreen button does nothing on iPad.
 *
 * Instead of relying on the native API, this shim makes
 * `element.requestFullscreen()` / `document.exitFullscreen()` post a message to
 * the parent page, which expands the *iframe element itself* to fill the
 * browser viewport (pseudo-fullscreen). This is deterministic across iPad, iOS
 * and desktop. It also keeps `document.fullscreenElement` and the
 * `fullscreenchange` event working so the tool's own button label stays in
 * sync (covers both old saved tools and new ones).
 */
const FULLSCREEN_SHIM = `<script data-mathai-fsshim>
(function(){
  if (window.__mathaiFsShim) return;
  window.__mathaiFsShim = true;
  var isFs = false;
  function fire(){
    try { document.dispatchEvent(new Event('fullscreenchange')); } catch(e){}
    try { document.dispatchEvent(new Event('webkitfullscreenchange')); } catch(e){}
  }
  function post(type){
    try { parent.postMessage({ source:'math-ai-fullscreen', type:type }, '*'); } catch(e){}
  }
  function enter(){ if(!isFs){ isFs = true; post('enter'); fire(); } return Promise.resolve(); }
  function exit(){ if(isFs){ isFs = false; post('exit'); fire(); } return Promise.resolve(); }
  try {
    var ep = Element.prototype;
    ep.requestFullscreen = function(){ return enter(); };
    ep.webkitRequestFullscreen = ep.requestFullscreen;
    ep.webkitRequestFullScreen = ep.requestFullscreen;
    ep.mozRequestFullScreen = ep.requestFullscreen;
    ep.msRequestFullscreen = ep.requestFullscreen;
    document.exitFullscreen = function(){ return exit(); };
    document.webkitExitFullscreen = document.exitFullscreen;
    document.webkitCancelFullScreen = document.exitFullscreen;
    document.mozCancelFullScreen = document.exitFullscreen;
    document.msExitFullscreen = document.exitFullscreen;
    function defEl(name){
      try {
        Object.defineProperty(document, name, {
          configurable: true,
          get: function(){ return isFs ? document.documentElement : null; }
        });
      } catch(e){}
    }
    defEl('fullscreenElement');
    defEl('webkitFullscreenElement');
    defEl('webkitCurrentFullScreenElement');
    defEl('mozFullScreenElement');
    defEl('msFullscreenElement');
    try { Object.defineProperty(document, 'fullscreenEnabled', { configurable:true, get:function(){ return true; } }); } catch(e){}
    try { Object.defineProperty(document, 'webkitFullscreenEnabled', { configurable:true, get:function(){ return true; } }); } catch(e){}
    // The parent tells us when fullscreen ends from its side (Esc key, etc.).
    window.addEventListener('message', function(e){
      var d = e.data; if(!d || d.source!=='math-ai-fullscreen-parent') return;
      if(d.type==='exited'){ if(isFs){ isFs = false; fire(); } }
    });
  } catch(e){}
})();
</script>`;

/**
 * Bar-chart sizing repair, injected into the preview iframe.
 *
 * Both a percentage height (`height: 60%`) and flex distribution (`flex-grow`)
 * need the containing block's height to be *definite*. Generated tools keep
 * sizing the plot area with `min-height` alone, which leaves `height: auto` —
 * so the percentage is treated as `auto` and flex has nothing to distribute.
 * Every bar collapses to its content height (zero, they are empty divs) and the
 * tool renders as a tall empty box with hairline bars sitting on the axis.
 *
 * Prompt instructions alone did not stop this reliably, so the repair is done
 * deterministically here:
 *   - A container given a `min-height` but no explicit height, whose children
 *     depend on a definite height, gets one: the larger of its min-height and
 *     its current content height, so its rendered size does not change.
 *   - A wrapper that collapsed to zero inside a parent that does have height
 *     (a bar column that never got to stretch) is stretched to fit it.
 *   - Each bar's *authored* percentage is then resolved against the measured
 *     parent and written back in pixels.
 *
 * On a chart that already rendered correctly every step recomputes the value it
 * already had, so this is a no-op rather than a second opinion on the layout.
 * What it cannot repair is a tool that decided the bar value is literally 0 —
 * that one is on the generation prompt (see rule 14 in the generate-html route).
 */
const CHART_SIZING_FIX = `<script data-mathai-chartfix>
(function(){
  if (window.__mathaiChartFix) return;
  window.__mathaiChartFix = true;

  var bars = [];        // elements whose authored height is a percentage
  var fixed = [];       // containers we gave an explicit height to
  var busy = false;

  function remember(el, pct){
    if (!isFinite(pct) || pct <= 0) return;
    if (typeof el.__mathaiPctH !== 'number') bars.push(el);
    el.__mathaiPctH = pct;
  }

  /* Note: now that browsers support CSS nesting, a plain CSSStyleRule also
     exposes an (empty) cssRules list — so a style rule must be handled *and*
     descended into, never treated as either/or. */
  function walkRules(rules, fn){
    for (var i = 0; i < rules.length; i++){
      var r = rules[i];
      if (r.style && r.selectorText) fn(r);
      if (r.cssRules && r.cssRules.length) walkRules(r.cssRules, fn);
    }
  }
  function eachStyleRule(fn){
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++){
      var rules = null;
      try { rules = sheets[i].cssRules; } catch(e){ continue; }
      if (rules) walkRules(rules, fn);
    }
  }

  /* Record which elements the author gave a height to, and which of those
     heights are percentages. Stylesheet rules first, inline styles second, so
     inline wins as the cascade dictates. Our own writes are tagged so they are
     never mistaken for an authored height on a later pass. */
  function scan(){
    eachStyleRule(function(rule){
      var h = rule.style.height;
      if (!h || h === 'auto') return; // 'auto' is exactly the indefinite case we repair
      var list;
      try { list = document.querySelectorAll(rule.selectorText); } catch(e){ return; }
      for (var i = 0; i < list.length; i++){
        list[i].__mathaiAuthoredH = true;
        if (h.indexOf('%') !== -1) remember(list[i], parseFloat(h));
      }
    });
    var inline = document.querySelectorAll('[style]');
    for (var j = 0; j < inline.length; j++){
      var el = inline[j], ih = el.style.height;
      if (!ih || ih === 'auto') continue;
      if (el.__mathaiOurs) continue; // a height this script wrote
      el.__mathaiAuthoredH = true;
      if (ih.indexOf('%') !== -1) remember(el, parseFloat(ih));
    }
  }

  /* True when at least one child can only size itself against a definite height. */
  function dependsOnDefiniteHeight(el){
    var kids = el.children;
    for (var i = 0; i < kids.length; i++){
      if (typeof kids[i].__mathaiPctH === 'number') return true;
      if ((parseFloat(getComputedStyle(kids[i]).flexGrow) || 0) > 0) return true;
    }
    return false;
  }

  function needsDefiniteHeight(el){
    if (el.__mathaiAuthoredH) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none') return false;
    var min = parseFloat(cs.minHeight);
    if (!(min > 0)) return false; // 'auto' / 0: the author never asked for a size
    return dependsOnDefiniteHeight(el);
  }

  function docOrder(a, b){
    var rel = a.compareDocumentPosition(b);
    if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function apply(){
    if (busy) return;
    busy = true;

    /* Phase 1 — undo our own writes. The pixel heights we set feed back into a
       container's auto height, so measuring without resetting would let sizes
       creep on every pass. Resetting makes each run start from the same state
       and therefore produce the same result. */
    var i, el;
    for (i = 0; i < bars.length; i++){
      if (bars[i].isConnected) bars[i].style.height = bars[i].__mathaiPctH + '%';
    }
    for (i = 0; i < fixed.length; i++) fixed[i].style.height = '';
    fixed.length = 0;
    void document.documentElement.offsetHeight; // reflow before measuring

    /* Phase 2 — give collapsing containers a definite height, outermost first
       so a repaired parent has settled before its descendants are measured.
       max(min-height, content) keeps the rendered size exactly as it was. */
    var all = document.querySelectorAll('*');
    for (i = 0; i < all.length; i++){
      el = all[i];
      if (!needsDefiniteHeight(el)) continue;
      var want = Math.max(parseFloat(getComputedStyle(el).minHeight) || 0, el.scrollHeight);
      if (!(want > 0)) continue;
      el.__mathaiOurs = true;
      el.style.height = want + 'px';
      fixed.push(el);
    }
    void document.documentElement.offsetHeight;

    /* Phases 3 and 4 run twice: repairing an outer wrapper can hand an inner one
       the height it was missing, and vice versa. Two passes settle the nesting
       depths these tools actually produce. */
    for (var pass = 0; pass < 2; pass++){
      stretchCollapsedWrappers();
      void document.documentElement.offsetHeight;
      resolvePercentages();
      void document.documentElement.offsetHeight;
    }

    busy = false;
  }

  function contentHeight(el){
    var cs = getComputedStyle(el);
    if (cs.display === 'none') return 0;
    return el.clientHeight
      - (parseFloat(cs.paddingTop) || 0)
      - (parseFloat(cs.paddingBottom) || 0);
  }

  /*
   * Phase 3 — a bar column that collapsed to nothing inside a parent that does
   * have height. Happens when the column is a flex item that does not stretch
   * (parent uses align-items:flex-end) while its own children rely on flex-grow.
   * The signature is deliberately narrow: no authored height, effectively zero
   * tall, sizeable parent, and children that need a definite height.
   */
  function stretchCollapsedWrappers(){
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++){
      var el = all[i];
      if (el.__mathaiAuthoredH || el.children.length === 0) continue;
      if (el.clientHeight >= 8) continue;
      var parent = el.parentElement;
      if (!parent) continue;
      var basis = contentHeight(parent);
      if (!(basis >= 40)) continue;
      if (!dependsOnDefiniteHeight(el)) continue;
      el.__mathaiOurs = true;
      el.style.height = basis + 'px';
      if (fixed.indexOf(el) === -1) fixed.push(el);
    }
  }

  /* Phase 4 — resolve each bar's percentage against its measured parent. */
  function resolvePercentages(){
    bars.sort(docOrder);
    for (var i = 0; i < bars.length; i++){
      var el = bars[i];
      if (!el.isConnected || !el.parentElement) continue;
      var basis = contentHeight(el.parentElement);
      if (!(basis > 0)) continue; // parent still has no height: nothing to resolve against
      var px = basis * el.__mathaiPctH / 100;
      if (px > 0){
        el.__mathaiOurs = true;
        el.style.height = px + 'px';
      }
    }
  }

  function run(){ scan(); apply(); }

  function settle(){
    run();
    requestAnimationFrame(function(){
      run();
      requestAnimationFrame(function(){
        run();
        /* Tools that derive bar heights from a measured container often measure
           before layout and fonts have settled and bake in tiny pixel values.
           One late resize event gives those render functions a chance to
           recompute against the real size. */
        try { window.dispatchEvent(new Event('resize')); } catch(e){}
        setTimeout(run, 250);
      });
    });
  }

  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle);
  document.addEventListener('DOMContentLoaded', run);

  var pending = 0;
  function schedule(){
    if (pending) return;
    pending = setTimeout(function(){ pending = 0; run(); }, 120);
  }
  window.addEventListener('resize', schedule);
  /* Only childList is observed: our repair writes the style attribute, so
     watching attributes would retrigger this observer from our own changes. */
  try {
    new MutationObserver(function(){ if (!busy) schedule(); })
      .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  } catch(e){}
})();
</script>`;

/** One hop of the structural route the iframe inspector posts back. */
interface InspectorPathStep {
  i: number;
  tag: string;
}

/**
 * Replay the teacher's click onto the *pristine* tool HTML and tag the matching
 * element with `data-ai-target`.
 *
 * The clicked node may not exist in the pristine source at all — interactive
 * tools commonly build their content in JavaScript. In that case the walk stops
 * at the deepest ancestor that does exist (usually the container the script
 * fills) and `exact` comes back false, so the caller can tell the model to edit
 * the *generating code* rather than bake the rendered nodes in as static markup.
 *
 * Returns null when the selection cannot be narrowed to a real element, which
 * means the caller should fall back to a normal (non-targeted) edit.
 */
function markTargetInPristineHtml(
  pristineHtml: string,
  path: InspectorPathStep[]
): { markedHtml: string; exact: boolean } | null {
  if (typeof DOMParser === "undefined" || path.length === 0) return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(pristineHtml, "text/html");
  } catch {
    return null;
  }

  const root = doc.documentElement;
  if (!root) return null;

  let node: Element = root;
  let exact = true;
  for (const step of path) {
    const child = node.children[step.i];
    // A missing child, or a tag mismatch, means the live tree diverged from the
    // source here (script-inserted nodes). Stop and mark what we have.
    if (!child || (step.tag && child.tagName.toLowerCase() !== step.tag)) {
      exact = false;
      break;
    }
    node = child;
  }

  // <html>/<head>/<body> are the whole document — marking them is not targeted.
  if (node === root || node === doc.body || node === doc.head) return null;

  doc.querySelectorAll("[data-ai-target]").forEach((n) => n.removeAttribute("data-ai-target"));
  node.setAttribute("data-ai-target", "1");

  return { markedHtml: `<!doctype html>\n${root.outerHTML}`, exact };
}

/**
 * Add the preview-only shims to a tool document. These are injected at render
 * time and never saved, so the stored HTML stays exactly as the model wrote it
 * and a later targeted edit never sees them in `currentHtml`.
 */
function injectInspector(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const scripts = `${FULLSCREEN_SHIM}${CHART_SIZING_FIX}${INSPECTOR_SCRIPT}`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${scripts}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${scripts}</html>`);
  return html + scripts;
}

interface ToolboxConfigFromDB {
  type: string;
  label: string;
  description: string;
  tools: ToolFromDB[];
  isActive: boolean;
}

// Desired display order for the fraction tool groups (dashboard + sidebar).
// The toolbox data is DB-driven and its stored order can vary, so we normalise
// the order here rather than depending on insertion order.
const FRACTION_TOOL_ORDER: Record<string, string[]> = {
  "fraction-concept": [
    "fraction-converting",
    "fraction-integer",
    "fraction-expanding-simplifying",
    "fraction-comparison",
  ],
  "fraction-operations": [
    "fraction-addition",
    "fraction-subtraction",
    "fraction-multiplication",
    "fraction-division",
  ],
};

function orderToolboxConfigs(configs: ToolboxConfigFromDB[]): ToolboxConfigFromDB[] {
  // 1) Sort tools within known fraction groups (unknown keys keep their order, at the end).
  const result = configs.map((c) => {
    const order = FRACTION_TOOL_ORDER[c.type];
    if (!order) return c;
    const rank = (key: string) => {
      const i = order.indexOf(key);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const tools = [...c.tools].sort((a, b) => rank(a.key) - rank(b.key));
    return { ...c, tools };
  });

  // 2) Ensure 分數概念 (fraction-concept) appears before 四則運算 (fraction-operations),
  //    without disturbing the position of any other group.
  const conceptIdx = result.findIndex((c) => c.type === "fraction-concept");
  const opsIdx = result.findIndex((c) => c.type === "fraction-operations");
  if (conceptIdx > -1 && opsIdx > -1 && conceptIdx > opsIdx) {
    const [concept] = result.splice(conceptIdx, 1);
    result.splice(opsIdx, 0, concept);
  }

  return result;
}

type DashboardEntryMode = "question" | "ai-tool";

interface SavedMessagePart {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

interface SavedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: SavedMessagePart[];
}

export default function MathDashboardPage() {
  return (
    <Suspense>
      <MathDashboardContent />
    </Suspense>
  );
}

function MathDashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // Only teachers may edit/save a tool. Students open shared tools read-only,
  // so the "select to modify" and "save" controls are hidden for them. The
  // backend also enforces this (saving/sharing returns 403 for students).
  const isTeacher = user?.role === "teacher";
  const urlType = searchParams.get("type") || "other";
  const toolbox = useToolbox();

  const [dashboardData, setDashboardData] = useState<{ type: string; question: string; imageData?: string } | null>(null);
  const [entryMode, setEntryMode] = useState<DashboardEntryMode>("question");
  const entryModeRef = useRef<DashboardEntryMode>("question");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dashboard-data");
      if (raw) {
        setDashboardData(JSON.parse(raw));
        setHasUserQuestion(true);
      }
    } catch {}
  }, []);

  const type = dashboardData?.type || urlType;
  const question = dashboardData?.question || "";
  const questionImage = dashboardData?.imageData || null;

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `${basePath}/api/chat`,
      prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
        body: {
          ...body,
          id,
          messages,
          trigger,
          messageId,
          mode: entryModeRef.current,
          hasQuestion: hasUserQuestionRef.current,
        },
      }),
    }),
    onError: (error) => {
      console.error("[chat] Error:", error);
    },
  });

  const [input, setInput] = useState("");
  const [chatVisible, setChatVisible] = useState(true);
  const [toolboxConfig, setToolboxConfig] = useState<ToolboxConfigFromDB | null>(null);
  const [allToolboxConfigs, setAllToolboxConfigs] = useState<ToolboxConfigFromDB[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiToolHtml, setAiToolHtml] = useState<string | null>(null);
  const [aiToolTitle, setAiToolTitle] = useState<string | null>(null);
  const [aiToolKey, setAiToolKey] = useState<string | null>(null);
  const [hasSavedAiTool, setHasSavedAiTool] = useState(false);
  const [isSavingAiTool, setIsSavingAiTool] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const [isGeneratingAiTool, setIsGeneratingAiTool] = useState(false);
  /** Raw HTML streamed back while the model writes it — shown as a live code feed. */
  const [genCode, setGenCode] = useState("");
  /** The tool name as soon as the model emits it, before the HTML is finished. */
  const [genTitle, setGenTitle] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    /** Pristine tool HTML with the target tagged, or null if it could not be pinned down. */
    markedHtml: string | null;
    label: string;
    /** True when the clicked node is created by the tool's JavaScript, not by its markup. */
    dynamic: boolean;
  } | null>(null);
  const aiToolIframeRef = useRef<HTMLIFrameElement>(null);
  const [isToolFullscreen, setIsToolFullscreen] = useState(false);
  const [isExtractingParams, setIsExtractingParams] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitial = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatFiles, setChatFiles] = useState<File[]>([]);

  // Question-input (placeholder area) state — used when no question is set yet
  const [questionInput, setQuestionInput] = useState("");
  const [questionFiles, setQuestionFiles] = useState<FileList | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [questionPreviewSrc, setQuestionPreviewSrc] = useState<string | null>(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [hasUserQuestion, setHasUserQuestion] = useState(false);
  const hasUserQuestionRef = useRef(false);
  const [currentChatId, setCurrentChatId] = useState(() => createMathChatId());
  const [toolPreviewRefreshKey, setToolPreviewRefreshKey] = useState(0);
  const suppressHistoryAnalysisRef = useRef(false);
  // Loading a saved chat must not re-save it (which would bump updatedAt and
  // reorder the history list). Cleared once a genuine new exchange starts.
  const skipSaveRef = useRef(false);
  const restoredToolUrlRef = useRef<string | null>(null);
  const [toolChatSessionIds, setToolChatSessionIds] = useState<Record<"volume-cubes" | "clock-24hrs" | "clock-time-difference", string>>({
    "volume-cubes": createMathChatId(),
    "clock-24hrs": createMathChatId(),
    "clock-time-difference": createMathChatId(),
  });
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const questionFileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = (!!input.trim() || chatFiles.length > 0) && !isLoading && !isGeneratingAiTool;

  const selectedTool = toolbox?.selectedTool ?? null;
  const hideChatForTool = selectedTool === "journey-graph";
  const tools = toolboxConfig?.tools ?? [];
  const typeLabel = toolboxConfig?.label ?? type;

  // Both mics are declared up here because the reset/load handlers below have to
  // stop dictation before they clear the boxes.
  const {
    isListening,
    error: voiceError,
    stop: stopListening,
    toggle: toggleVoice,
    rebase: rebaseDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    // Chinese doesn't separate words with spaces.
    separator: "",
    getBaseText: () => input,
    onTranscript: setInput,
  });

  // Typing while the mic is live: hand the edit to the recogniser as the new
  // baseline, otherwise the next result would revert it.
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (isListening) rebaseDictation(value);
    },
    [isListening, rebaseDictation]
  );

  // The question box doubles as the "加入題目" and the "AI生成圖解" prompt,
  // switching only its placeholder on `entryMode`.
  const {
    isListening: isQuestionListening,
    error: questionVoiceError,
    stop: stopQuestionListening,
    toggle: toggleQuestionVoice,
    rebase: rebaseQuestionDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    separator: "",
    getBaseText: () => questionInput,
    onTranscript: setQuestionInput,
  });

  const handleQuestionInputChange = useCallback(
    (value: string) => {
      setQuestionInput(value);
      if (isQuestionListening) rebaseQuestionDictation(value);
    },
    [isQuestionListening, rebaseQuestionDictation]
  );

  function isPreviewUrlForSelectedTool(url: string | null, toolKey: string | null) {
    if (!url || !toolKey) return false;

    const expectedPathByTool: Record<string, string> = {
      "clock-24hrs": "/math/clock-24hrs",
      "clock-time-difference": "/math/clock-time-difference",
      "volume-cubes": "/math/volume",
      "journey-graph": "/math/journey",
      "fraction-addition": "/math/fraction-addition",
      "fraction-subtraction": "/math/fraction-subtraction",
      "fraction-multiplication": "/math/fraction-multiplication",
      "fraction-division": "/math/fraction-division",
      "fraction-comparison": "/math/fraction-comparison",
      "fraction-expanding-simplifying": "/math/fraction-es",
      "fraction-integer": "/math/fraction-integer",
      "fraction-converting": "/math/fraction-converting",
    };

    const expectedPath = expectedPathByTool[toolKey] ?? "/math/preview.html";
    return url.includes(expectedPath);
  }

  const handleNewChat = useCallback(() => {
    if (
      selectedTool === "volume-cubes" ||
      selectedTool === "clock-24hrs" ||
      selectedTool === "clock-time-difference"
    ) {
      setToolChatSessionIds((prev) => ({
        ...prev,
        [selectedTool]: createMathChatId(),
      }));
      setChatVisible(true);
      return;
    }

    const currentStatus = statusRef.current;
    if (currentStatus === "streaming" || currentStatus === "submitted") {
      stopRef.current?.();
    }

    setCurrentChatId(createMathChatId());
    setMessagesRef.current?.([]);
    // The input is about to be cleared, so a live mic would write the old text
    // back on its next result.
    stopListening();
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setChatVisible(true);
  }, [selectedTool, stopListening]);

  useEffect(() => {
    entryModeRef.current = entryMode;
  }, [entryMode]);

  useEffect(() => {
    hasUserQuestionRef.current = hasUserQuestion;
  }, [hasUserQuestion]);

  // Fetch toolbox config from DB
  useEffect(() => {
    fetch(`${basePath}/api/toolbox`)
      .then((res) => res.json())
      .then((rawConfigs: ToolboxConfigFromDB[]) => {
        const configs = orderToolboxConfigs(rawConfigs);
        setAllToolboxConfigs(configs);
        const matched = configs.find((c) => c.type === type);
        if (matched) {
          setToolboxConfig(matched);
        } else {
          // No specific match (e.g. user hasn't entered a question yet) — fall back
          // to the first math toolbox so the sidebar still shows all tool groups.
          const firstMath = configs.find(
            (c) =>
              c.type !== "english" &&
              c.type !== "chinese" &&
              c.type !== "classical-chinese"
          );
          if (firstMath) setToolboxConfig(firstMath);
        }
      })
      .catch(() => {});
  }, [type]);

  // Fetch AI-recommended tools
  const [recommendedToolKeys, setRecommendedToolKeys] = useState<string[]>([]);
  const [isAnalyzingTools, setIsAnalyzingTools] = useState(false);
  useEffect(() => {
    if (suppressHistoryAnalysisRef.current) {
      setRecommendedToolKeys([]);
      setIsAnalyzingTools(false);
      return;
    }

    // Recommend across every visible math tool (all groups), not just the
    // matched group. After the fraction group was split into 四則運算 / 分數概念,
    // scoping recommendations to a single 4-tool subgroup often returned nothing
    // and left the sidebar stuck on "正在分析題目...".
    const mathConfigs = allToolboxConfigs.filter(
      (c) => c.type !== "english" && c.type !== "chinese" && c.type !== "classical-chinese"
    );
    const candidateTools = mathConfigs.flatMap((c) => c.tools);

    if (!question || candidateTools.length === 0) {
      setRecommendedToolKeys([]);
      setIsAnalyzingTools(false);
      return;
    }

    let cancelled = false;
    setIsAnalyzingTools(true);
    fetch(`${basePath}/api/recommend-tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        tools: candidateTools.map((t) => ({ key: t.key, label: t.label, sub: t.sub })),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRecommendedToolKeys(data.recommendedKeys ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecommendedToolKeys([]);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzingTools(false);
      });

    return () => {
      cancelled = true;
    };
  }, [question, toolboxConfig, allToolboxConfigs]);

  // Register tools into sidebar context
  const register = toolbox?.register;
  useEffect(() => {
    if (register && toolboxConfig) {
      const mathConfigs = allToolboxConfigs.filter(
        (c) => c.type !== "english" && c.type !== "chinese" && c.type !== "classical-chinese"
      );
      register({
        tools: toolboxConfig.tools,
        allToolGroups: mathConfigs.map((c) => ({ label: c.label, tools: c.tools })),
        typeLabel: toolboxConfig.label,
        question,
        questionImage,
        recommendedToolKeys,
        isAnalyzingTools,
      });
    }
  }, [register, toolboxConfig, allToolboxConfigs, question, questionImage, recommendedToolKeys, isAnalyzingTools]);

  // React to tool selection from sidebar
  useEffect(() => {
    if (!selectedTool) {
      setIsExtractingParams(false);
      setPreviewUrl(null);
      return;
    }

    if (restoredToolUrlRef.current) {
      const restoredToolUrl = restoredToolUrlRef.current;
      restoredToolUrlRef.current = null;
      suppressHistoryAnalysisRef.current = false;
      setIsExtractingParams(false);
      setPreviewUrl(restoredToolUrl);
      return;
    }

    // 直接連結到 Next.js route 的工具（同樣不需要 AI 提取參數）
    const staticRouteMap: Record<string, string> = {
      "clock-24hrs": "/math/clock-24hrs",
      "clock-time-difference": "/math/clock-time-difference",
      "volume-cubes": "/math/volume",
      "journey-graph": "/math/journey",
    };
    const staticRoute = staticRouteMap[selectedTool];
    if (staticRoute) {
      setIsExtractingParams(false);
      setPreviewUrl(`${basePath}${staticRoute}`);
      return;
    }

    // 「兩數運算」版面的工具頁（加/減/乘/除）都會讀取 URL 參數
    // （num1/den1/num2/den2/whole1/whole2/context），需要先經 AI 提取參數再帶參數開啟。
    // 新增同版面的工具時，請一併在該頁加上 applyIncomingParams() 再列到這裏。
    const fractionOpRouteMap: Record<string, string> = {
      "fraction-addition": "fraction-addition",
      "fraction-subtraction": "fraction-subtraction",
      "fraction-multiplication": "fraction-multiplication",
      "fraction-division": "fraction-division",
    };
    const fractionOpRoute = fractionOpRouteMap[selectedTool];

    // 直接帶參數的獨立工具頁（非「兩數運算」的版面）的 HTML 版本。
    // 分數概念工具皆已改寫為 Next.js route（見下方 standaloneRouteMap），故此表留空；
    // 保留變數與後備邏輯以相容其他潛在的 HTML 版工具。
    const standaloneHtmlMap: Record<string, string> = {};
    const standaloneHtml = standaloneHtmlMap[selectedTool];

    // 已改寫為 Next.js route 的獨立工具頁（TypeScript 重寫版）
    const standaloneRouteMap: Record<string, string> = {
      "fraction-expanding-simplifying": "fraction-es",
      "fraction-comparison": "fraction-comparison",
      "fraction-integer": "fraction-integer",
      "fraction-converting": "fraction-converting",
    };
    const standaloneRoute = standaloneRouteMap[selectedTool];

    const buildFallbackUrl = () =>
      standaloneRoute
        ? `${basePath}/math/${standaloneRoute}`
        : standaloneHtml
          ? `${basePath}/math/${standaloneHtml}`
          : fractionOpRoute
            ? `${basePath}/math/${fractionOpRoute}`
            : `${basePath}/math/preview.html`;

    if (suppressHistoryAnalysisRef.current) {
      setIsExtractingParams(false);
      setPreviewUrl(buildFallbackUrl());
      return;
    }

    if (!question) {
      setIsExtractingParams(false);
      setPreviewUrl(buildFallbackUrl());
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    setPreviewUrl(null);
    setIsExtractingParams(true);

    (async () => {
      try {
        const res = await fetch(`${basePath}/api/extract-params`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            toolKey: selectedTool,
            // 只有在沒有文字題目時才傳圖片，避免 payload 過大
            ...(!question && questionImage ? { imageData: questionImage } : {}),
          }),
        });
        if (!res.ok) throw new Error("Extract failed");
        if (cancelled) return;
        const params = await res.json();

        if (selectedTool === "fraction-expanding-simplifying") {
          const qs = new URLSearchParams({
            numerator: String(params.numerator ?? 2),
            denominator: String(params.denominator ?? 8),
            mode: params.mode ?? "expand",
          });
          // 傳遞目標分數（null/-1 表示空格，不傳該參數讓 fraction-es 顯示 □）
          if (params.targetNumerator != null && params.targetNumerator !== -1) {
            qs.set("targetNum", String(params.targetNumerator));
          }
          if (params.targetDenominator != null && params.targetDenominator !== -1) {
            qs.set("targetDen", String(params.targetDenominator));
          }
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-es?${qs.toString()}`);
        } else if (selectedTool === "fraction-comparison") {
          const qs = new URLSearchParams();
          const count = params.count === 3 ? 3 : 2;
          qs.set("count", String(count));

          const fractions: Array<{ whole?: number | null; num?: number | null; den?: number | null; format?: string | null }> =
            Array.isArray(params.fractions) ? params.fractions : [];

          for (let i = 0; i < count; i++) {
            const f = fractions[i] ?? {};
            const idx = i + 1;
            // 分子默認 1（0 顯示醜），分母為 0 用 1 避免除零
            qs.set(`num${idx}`, String(f.num && f.num !== 0 ? f.num : 1));
            qs.set(`den${idx}`, String(f.den && f.den !== 0 ? f.den : 1));
            if (f.whole != null) qs.set(`whole${idx}`, String(f.whole));
            if (f.format) qs.set(`format${idx}`, String(f.format));
          }
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-comparison?${qs.toString()}`);
        } else if (selectedTool === "fraction-integer") {
          const qs = new URLSearchParams();
          // num 預設 12（可整齊排成長方形，示範效果佳），限制 1–999
          const n = Number(params.num);
          qs.set("num", String(Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 999) : 12));
          // extractor 回傳 explore/all，工具用 mode=1/2
          if (params.mode === "all") qs.set("mode", "2");
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-integer?${qs.toString()}`);
        } else if (selectedTool === "fraction-converting") {
          const qs = new URLSearchParams();
          if (params.whole != null) qs.set("whole", String(params.whole));
          if (params.num != null) qs.set("num", String(params.num));
          // 分母預設 1，避免除零
          qs.set("den", String(params.den && params.den !== 0 ? params.den : 1));
          if (params.mode) qs.set("mode", String(params.mode));
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-converting?${qs.toString()}`);
        } else if (fractionOpRoute) {
          const qs = new URLSearchParams();
          // 分子默認 1（AI 回傳 0 通常代表純整數題目，0/1 顯示醜，改用 1）
          qs.set("num1", String(params.num1 && params.num1 !== 0 ? params.num1 : 1));
          // 分母為 0 通常代表題目缺少對應分數，使用默認 1 避免除零
          qs.set("den1", String(params.den1 && params.den1 !== 0 ? params.den1 : 1));
          qs.set("num2", String(params.num2 && params.num2 !== 0 ? params.num2 : 1));
          qs.set("den2", String(params.den2 && params.den2 !== 0 ? params.den2 : 1));
          if (params.whole1 != null) qs.set("whole1", String(params.whole1));
          if (params.whole2 != null) qs.set("whole2", String(params.whole2));
          if (params.questionTemplate) qs.set("context", params.questionTemplate);
          if (!cancelled) setPreviewUrl(`${basePath}/math/${fractionOpRoute}?${qs.toString()}`);
        } else {
          const qs = new URLSearchParams({
            whole1: String(params.whole1 ?? 0),
            num1: String(params.num1 ?? 1),
            den1: String(params.den1 ?? 1),
            whole2: String(params.whole2 ?? 0),
            num2: String(params.num2 ?? 1),
            den2: String(params.den2 ?? 1),
            operation: params.operation ?? selectedTool.split("-")[1] ?? "div",
            context: params.contextText ?? "",
            unit: params.unit ?? "",
          });
          if (!cancelled) setPreviewUrl(`${basePath}/math/preview.html?${qs.toString()}`);
        }
      } catch {
        if (!cancelled) setPreviewUrl(buildFallbackUrl());
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setIsExtractingParams(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selectedTool, question, questionImage, toolPreviewRefreshKey]);

  // Auto-send the initial question to get AI response
  useEffect(() => {
    if ((question || questionImage) && !hasSentInitial.current) {
      hasSentInitial.current = true;
      const files = questionImage
        ? [{ type: "file" as const, mediaType: "image/png", url: questionImage }]
        : undefined;
      sendMessage({ text: question || "（見圖片）", ...(files ? { files } : {}) });
    }
  }, [question, questionImage, sendMessage]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    // Scroll the container itself (never the page) so the layout doesn't shift.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (hideChatForTool) stopListening();
  }, [hideChatForTool, stopListening]);

  // Listen for sidebar entry actions.
  // Use refs so the deps array stays stable across renders (useChat's
  // setMessages/stop/status references can change between renders).
  const setMessagesRef = useRef(setMessages);
  const stopRef = useRef(stop);
  const statusRef = useRef(status);
  const toolboxRef = useRef(toolbox);
  useEffect(() => { setMessagesRef.current = setMessages; }, [setMessages]);
  useEffect(() => { stopRef.current = stop; }, [stop]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { toolboxRef.current = toolbox; }, [toolbox]);

  // Allow saving again once a genuine new exchange starts (a new send sets the
  // status to submitted/streaming; loading a chat never does).
  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      skipSaveRef.current = false;
    }
  }, [status]);

  // Broadcast the active math chat id so the sidebar can highlight the open item.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("math-chat:active", { detail: { id: currentChatId } })
    );
  }, [currentChatId]);

  function serializeMessages(): SavedChatMessage[] {
    return serializeUiMessages(messages);
  }

  function restoreMessages(savedMessages: SavedChatMessage[]) {
    setMessages(restoreUiMessages(savedMessages));
  }

  useEffect(() => {
    function resetDashboard(mode: DashboardEntryMode) {
      suppressHistoryAnalysisRef.current = false;
      // Both boxes are about to be cleared, so any dictation in flight has to
      // stop: otherwise the next speech result would restore the old text along
      // with the new words.
      stopListening();
      stopQuestionListening();
      try { sessionStorage.removeItem("dashboard-data"); } catch {}
      setDashboardData(null);
      setHasUserQuestion(false);
      setCurrentChatId(createMathChatId());
      setEntryMode(mode);
      setAiToolHtml(null);
      setAiToolTitle(null);
      setAiToolKey(null);
      setHasSavedAiTool(false);
      setIsSavingAiTool(false);
      setIsGeneratingAiTool(false);
      setSelectMode(false);
      setPendingSelection(null);
      setPreviewUrl(null);
      hasSentInitial.current = false;
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
      setIsEditingQuestion(true);
      if (toolboxRef.current?.selectedTool === "volume-cubes" || toolboxRef.current?.selectedTool === "clock-24hrs" || toolboxRef.current?.selectedTool === "clock-time-difference") {
        const specialTool = toolboxRef.current.selectedTool;
        setToolChatSessionIds((prev) => ({ ...prev, [specialTool]: createMathChatId() }));
      } else {
        toolboxRef.current?.setSelectedTool(null);
      }
      // Reset the AI chat — start a fresh session
      const s = statusRef.current;
      if (s === "streaming" || s === "submitted") stopRef.current?.();
      setMessagesRef.current?.([]);
      setInput("");
      setChatFiles([]);
    }
    function handleNewQuestion() {
      resetDashboard("question");
    }
    function handleNewAiTool() {
      resetDashboard("ai-tool");
    }
    function handleLoadMathChat(event: Event) {
      const customEvent = event as CustomEvent<{ item: MathChatHistoryItem }>;
      const detail = customEvent.detail?.item;
      if (!detail) return;

      const s = statusRef.current;
      if (s === "streaming" || s === "submitted") stopRef.current?.();

      // Don't let this load trigger a re-save (which would reorder the list).
      skipSaveRef.current = true;

      setChatVisible(true);
      setIsExtractingParams(false);
      // Same as resetDashboard: clearing the boxes must not leave a mic running
      // against the text we just wiped.
      stopListening();
      stopQuestionListening();
      setInput("");
      setChatFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";

      if (detail.kind === "general") {
        const nextType = detail.type ?? "fraction-operations";
        const nextQuestion = detail.question ?? detail.title;
        const shouldRestoreQuestion = Boolean(detail.hasUserQuestion && detail.question);
        restoredToolUrlRef.current = shouldRestoreQuestion ? detail.toolUrl ?? null : null;
        suppressHistoryAnalysisRef.current = !shouldRestoreQuestion || Boolean(detail.toolUrl);
        if (shouldRestoreQuestion) {
          try {
            sessionStorage.setItem("dashboard-data", JSON.stringify({ type: nextType, question: nextQuestion }));
          } catch {}
        } else {
          try { sessionStorage.removeItem("dashboard-data"); } catch {}
        }

        setCurrentChatId(detail.id);
        setDashboardData(shouldRestoreQuestion ? { type: nextType, question: nextQuestion } : null);
        setHasUserQuestion(shouldRestoreQuestion);
        setEntryMode(detail.entryMode === "ai-tool" ? "ai-tool" : "question");
        setAiToolHtml(null);
        setAiToolTitle(null);
        setAiToolKey(null);
        setPreviewUrl(null);
        setToolPreviewRefreshKey((key) => key + 1);
        hasSentInitial.current = true;
        setIsEditingQuestion(false);
        toolboxRef.current?.setSelectedTool(detail.selectedTool ?? null);
        restoreMessages(detail.messages ?? []);
        return;
      }

      const shouldRestoreQuestion = Boolean(detail.hasUserQuestion && detail.question);
      restoredToolUrlRef.current = shouldRestoreQuestion ? detail.toolUrl ?? null : null;
      suppressHistoryAnalysisRef.current = !shouldRestoreQuestion || Boolean(detail.toolUrl);
      if (shouldRestoreQuestion) {
        try {
          sessionStorage.setItem("dashboard-data", JSON.stringify({ type: detail.type ?? "fraction-operations", question: detail.question }));
        } catch {}
      } else {
        try { sessionStorage.removeItem("dashboard-data"); } catch {}
      }
      setDashboardData(shouldRestoreQuestion ? { type: detail.type ?? "fraction-operations", question: detail.question! } : null);
      setHasUserQuestion(shouldRestoreQuestion);
      setEntryMode("ai-tool");
      setAiToolHtml(null);
      setAiToolTitle(null);
      setAiToolKey(null);
      setPreviewUrl(null);
      setToolPreviewRefreshKey((key) => key + 1);
      hasSentInitial.current = true;
      setIsEditingQuestion(false);
      setMessagesRef.current?.([]);
      toolboxRef.current?.setSelectedTool(detail.kind);
      setToolChatSessionIds((prev) => ({ ...prev, [detail.kind]: detail.id }));
      // Tool chats don't change currentChatId, so highlight this item directly.
      window.dispatchEvent(
        new CustomEvent("math-chat:active", { detail: { id: detail.id } })
      );
    }
    function handleLoadAiTool(event: Event) {
      const customEvent = event as CustomEvent<{
        toolKey: string;
        title: string;
        html: string;
        chatMessages?: SavedChatMessage[];
        chatMode?: DashboardEntryMode;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      // Both boxes get cleared below, so drop any dictation in flight.
      stopListening();
      stopQuestionListening();
      try { sessionStorage.removeItem("dashboard-data"); } catch {}
      setDashboardData(null);
      setHasUserQuestion(false);
      setEntryMode(detail.chatMode === "question" ? "question" : "ai-tool");
      setAiToolHtml(detail.html);
      setAiToolTitle(detail.title);
      setAiToolKey(detail.toolKey);
      setHasSavedAiTool(true);
      setIsSavingAiTool(false);
      setIsGeneratingAiTool(false);
      setSelectMode(false);
      setPendingSelection(null);
      setPreviewUrl(null);
      hasSentInitial.current = false;
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
      setIsEditingQuestion(false);
      toolboxRef.current?.setSelectedTool(null);
      const s = statusRef.current;
      if (s === "streaming" || s === "submitted") stopRef.current?.();
      restoreMessages(detail.chatMessages ?? []);
      setInput("");
      setChatFiles([]);
      setChatVisible(true);
    }
    function handleNewChatEvent() {
      handleNewChat();
    }
    window.addEventListener("dashboard:new-chat", handleNewChatEvent);
    window.addEventListener("dashboard:new-question", handleNewQuestion);
    window.addEventListener("dashboard:new-ai-tool", handleNewAiTool);
    window.addEventListener("dashboard:load-math-chat", handleLoadMathChat);
    window.addEventListener("dashboard:load-ai-tool", handleLoadAiTool);
    return () => {
      window.removeEventListener("dashboard:new-chat", handleNewChatEvent);
      window.removeEventListener("dashboard:new-question", handleNewQuestion);
      window.removeEventListener("dashboard:new-ai-tool", handleNewAiTool);
      window.removeEventListener("dashboard:load-math-chat", handleLoadMathChat);
      window.removeEventListener("dashboard:load-ai-tool", handleLoadAiTool);
    };
  }, [handleNewChat, stopListening, stopQuestionListening]);

  useEffect(() => {
    if (selectedTool === "volume-cubes" || selectedTool === "clock-24hrs" || selectedTool === "clock-time-difference") {
      return;
    }

    if (skipSaveRef.current) {
      return;
    }

    if (!question && messages.length === 0) {
      return;
    }

    const firstUserText = messages
      .filter((message) => message.role === "user")
      .flatMap((message) => message.parts)
      .find((part) => part.type === "text" && part.text.trim().length > 0);

    if (status === "streaming" || status === "submitted") {
      return;
    }

    const canSaveToolUrl = isPreviewUrlForSelectedTool(previewUrl, selectedTool);

    if (hasUserQuestion && selectedTool && !canSaveToolUrl) {
      return;
    }

    void upsertMathChatHistory({
      id: currentChatId,
      kind: "general",
      title: question || (firstUserText?.type === "text" ? firstUserText.text.slice(0, 40) : "數學對話"),
      hasUserQuestion,
      question: hasUserQuestion ? question : undefined,
      type: hasUserQuestion ? type : undefined,
      selectedTool,
      toolUrl: hasUserQuestion && canSaveToolUrl ? previewUrl ?? undefined : undefined,
      entryMode,
      messages: serializeUiMessages(messages),
      updatedAt: new Date().toISOString(),
    });
  }, [currentChatId, entryMode, hasUserQuestion, messages, previewUrl, question, selectedTool, status, type]);

  // Receive selection events from the sandboxed preview iframe. Origin is
  // opaque ("null") for sandboxed srcDoc, so we authenticate by contentWindow
  // identity instead of comparing event.origin.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== aiToolIframeRef.current?.contentWindow) return;
      const d = e.data as {
        source?: string;
        type?: string;
        path?: InspectorPathStep[];
        label?: string;
        enabled?: boolean;
      };
      // Fullscreen requests are routed through the parent because iPad/iOS
      // Safari won't grant the native Fullscreen API to a sandboxed iframe.
      // We expand the iframe element itself to fill the viewport instead.
      if (d?.source === "math-ai-fullscreen") {
        if (d.type === "enter") setIsToolFullscreen(true);
        else if (d.type === "exit") setIsToolFullscreen(false);
        return;
      }
      if (d?.source !== "math-ai-inspector-tool") return;
      if (d.type === "selected" && Array.isArray(d.path)) {
        // Mark the selection on the pristine source, not on the iframe's
        // hydrated DOM — see markTargetInPristineHtml. Use the sanitised copy
        // because that is exactly the document the iframe parsed, so the child
        // indices line up.
        const base = sanitizeAiToolHtml(aiToolHtml);
        const marked = base ? markTargetInPristineHtml(base, d.path) : null;
        // When the target cannot be pinned down we still keep the label: the
        // edit degrades to a whole-tool edit that mentions what was clicked,
        // rather than silently dropping the teacher's click.
        setPendingSelection({
          markedHtml: marked?.markedHtml ?? null,
          label: d.label || "選取的元素",
          dynamic: marked ? !marked.exact : true,
        });
        setSelectMode(false);
      } else if (d.type === "mode") {
        setSelectMode(!!d.enabled);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // aiToolHtml is read when resolving a selection, so the listener has to be
    // re-bound whenever the tool changes.
  }, [aiToolHtml]);

  // Allow leaving pseudo-fullscreen with the Escape key, and keep the iframe's
  // own fullscreen button label in sync by notifying it that we exited.
  const exitToolFullscreen = useCallback(() => {
    setIsToolFullscreen(false);
    aiToolIframeRef.current?.contentWindow?.postMessage(
      { source: "math-ai-fullscreen-parent", type: "exited" },
      "*"
    );
  }, []);

  useEffect(() => {
    if (!isToolFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") exitToolFullscreen();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isToolFullscreen, exitToolFullscreen]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev;
      aiToolIframeRef.current?.contentWindow?.postMessage(
        { source: "math-ai-inspector", type: next ? "enable" : "disable" },
        "*"
      );
      return next;
    });
  }, []);

  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function regenerateAiTool(options: {
    prompt: string;
    imageData?: string;
    currentHtml?: string | null;
    currentTitle?: string | null;
    targetedEdit?: boolean;
    targetLabel?: string;
    targetIsDynamic?: boolean;
  }) {
    setIsGeneratingAiTool(true);
    setGenCode("");
    setGenTitle(null);

    try {
      const res = await fetch(`${basePath}/api/generate-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: options.prompt,
          imageData: options.imageData,
          currentHtml: options.currentHtml,
          currentTitle: options.currentTitle,
          targetedEdit: options.targetedEdit,
          targetLabel: options.targetLabel,
          targetIsDynamic: options.targetIsDynamic,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({}));
        console.error("[generate-html] failed:", {
          status: res.status,
          azureStatus: detail?.statusCode,
          error: detail?.error,
          responseBody: detail?.responseBody,
        });
        throw new Error(detail?.error || "Generate HTML failed");
      }

      /**
       * NDJSON progress stream (see the route). The deltas are only for the live
       * code feed — the iframe is swapped in from the "done" event, which is the
       * only HTML the server has sanitised.
       */
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let code = "";
      let lastFlush = 0;
      let finalHtml: string | null = null;
      let finalTitle: string | null = null;
      let streamError: string | null = null;

      const flushCode = () => setGenCode(code);

      const handleEvent = (line: string) => {
        if (!line.trim()) return;
        let evt: { type?: string; text?: string; title?: string; html?: string; error?: string };
        try {
          evt = JSON.parse(line);
        } catch {
          return; // partial or malformed line: ignore
        }

        if (evt.type === "delta" && typeof evt.text === "string") {
          code += evt.text;
          // Throttle re-renders: the model emits many small deltas.
          const now = Date.now();
          if (now - lastFlush > 80) {
            lastFlush = now;
            flushCode();
          }
        } else if (evt.type === "title" && typeof evt.title === "string") {
          setGenTitle(evt.title);
        } else if (evt.type === "done") {
          finalHtml = typeof evt.html === "string" ? evt.html : null;
          finalTitle = typeof evt.title === "string" ? evt.title : null;
        } else if (evt.type === "error") {
          streamError = evt.error ?? "Generate HTML failed";
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          handleEvent(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
      }
      handleEvent(buffer);
      flushCode();

      if (streamError) throw new Error(streamError);
      if (!finalHtml) throw new Error("Generate HTML returned no document");

      setAiToolHtml(finalHtml);
      setAiToolTitle(finalTitle);
      setHasSavedAiTool(false);
      // A fresh tool replaces any pending element selection.
      setPendingSelection(null);
      setSelectMode(false);
    } catch (err) {
      console.error("[generate-html] regenerate error:", err);
      // Keep the current preview if regeneration fails.
    } finally {
      setIsGeneratingAiTool(false);
    }
  }

  function openSaveDialog() {
    if (!aiToolHtml || isSavingAiTool || isGeneratingAiTool) return;
    setSaveNameDraft(aiToolTitle ?? "");
    setSaveDialogOpen(true);
  }

  async function saveAiTool(name: string) {
    const finalName = name.trim();
    if (!aiToolHtml || !finalName || isSavingAiTool) return;

    setIsSavingAiTool(true);
    try {
      const res = await fetch(`${basePath}/api/html-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolKey: aiToolKey,
          title: finalName,
          html: aiToolHtml,
          chatMessages: serializeMessages(),
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      const json = await res.json();
      setAiToolKey(json.toolKey ?? null);
      setAiToolTitle(finalName);
      setHasSavedAiTool(true);
      setSaveDialogOpen(false);
      window.dispatchEvent(new CustomEvent("dashboard:ai-tool-saved"));
    } catch {
      alert("保存失敗，請稍後再試。");
    } finally {
      setIsSavingAiTool(false);
    }
  }

  async function doSend() {
    if (!canSend) return;
    if (isListening) stopListening();
    const fileParts = await Promise.all(
      chatFiles.map(async (file) => ({
        type: "file" as const,
        mediaType: file.type,
        filename: file.name,
        url: await fileToDataURL(file),
      }))
    );
    const prompt = input.trim() || "（見圖片）";

    sendMessage({ text: prompt, ...(fileParts.length > 0 ? { files: fileParts } : {}) });

    // In AI-tool mode, once a tool exists, every follow-up message also refines
    // it. Passing the current HTML/title makes the backend modify the existing
    // tool (its prompt branches on currentHtml) instead of building a new one.
    // If the teacher has an element selected, send the marked HTML so the edit
    // is confined to that element.
    if (entryMode === "ai-tool" && aiToolHtml) {
      const imageData = fileParts.find((p) => p.mediaType?.startsWith("image/"))?.url;
      void regenerateAiTool({
        prompt,
        imageData,
        currentHtml: pendingSelection?.markedHtml ?? aiToolHtml,
        currentTitle: aiToolTitle,
        targetedEdit: !!pendingSelection?.markedHtml,
        targetLabel: pendingSelection?.label,
        targetIsDynamic: pendingSelection?.dynamic,
      });
    }

    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
      setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked)]);
    }
  }

  function removeChatFile(index: number) {
    setChatFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, imageFiles)]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSend();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  // ===== Question-input handlers (placeholder area) =====
  const canSubmitQuestion = !!(questionInput.trim() || questionFiles) && !isClassifying;

  function questionFileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  function handleQuestionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      // Rebuilt through DataTransfer because state holds a FileList, the same
      // trick removeQuestionFile() uses.
      const accepted = filterUploadsWithinLimit([], Array.from(e.target.files));
      if (accepted.length === 0) {
        setQuestionFiles(null);
        e.target.value = "";
        return;
      }
      const dt = new DataTransfer();
      accepted.forEach((f) => dt.items.add(f));
      setQuestionFiles(dt.files);
    }
  }

  function removeQuestionFile(index: number) {
    if (!questionFiles) return;
    const dt = new DataTransfer();
    Array.from(questionFiles).forEach((f, i) => {
      if (i !== index) dt.items.add(f);
    });
    if (dt.files.length === 0) {
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
    } else {
      setQuestionFiles(dt.files);
    }
  }

  function handleQuestionPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const dt = new DataTransfer();
    if (questionFiles) Array.from(questionFiles).forEach((f) => dt.items.add(f));
    imageFiles.forEach((f) => dt.items.add(f));
    setQuestionFiles(dt.files);
  }

  async function submitQuestion() {
    if (!canSubmitQuestion) return;
    suppressHistoryAnalysisRef.current = false;
    stopQuestionListening();

    if (entryMode === "ai-tool") {
      setIsClassifying(true);

      try {
        const prompt = questionInput.trim() || "（見圖片）";
        const files = questionFiles
          ? await Promise.all(
              Array.from(questionFiles).map(async (file) => ({
                type: "file" as const,
                mediaType: file.type,
                filename: file.name,
                url: await questionFileToBase64(file),
              }))
            )
          : [];
        const imageData = files[0]?.url;

        try { sessionStorage.removeItem("dashboard-data"); } catch {}
        setDashboardData(null);
        setHasUserQuestion(false);
        setAiToolHtml(null);
        setAiToolTitle(null);
        toolbox?.setSelectedTool(null);
        setMessages([]);
        hasSentInitial.current = true;
        setIsEditingQuestion(false);

        sendMessage({ text: prompt, ...(files.length > 0 ? { files } : {}) });
        await regenerateAiTool({ prompt, imageData });
        setQuestionInput("");
        setQuestionFiles(null);
        if (questionFileInputRef.current) questionFileInputRef.current.value = "";
      } catch {
        setAiToolHtml(null);
        setAiToolTitle(null);
      } finally {
        setIsClassifying(false);
      }
      return;
    }

    setIsClassifying(true);

    try {
      let imageData: string | undefined;
      if (questionFiles && questionFiles.length > 0) {
        imageData = await questionFileToBase64(questionFiles[0]);
      }

      const res = await fetch(`${basePath}/api/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionInput.trim(),
          imageData,
        }),
      });

      let nextType = "fraction-operations";
      let nextQuestion = questionInput.trim() || "（見圖片）";
      if (res.ok) {
        const json = await res.json();
        nextType = json.type ?? nextType;
        nextQuestion = json.question || nextQuestion;
      }

      sessionStorage.setItem(
        "dashboard-data",
        JSON.stringify({ type: nextType, question: nextQuestion, imageData })
      );

      // Allow the chat auto-send effect to fire with the new question
      hasSentInitial.current = false;
      setHasUserQuestion(true);
      setDashboardData({ type: nextType, question: nextQuestion, imageData });
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
      setIsEditingQuestion(false);
    } catch {
      const fallbackQuestion = questionInput.trim() || "（見圖片）";
      sessionStorage.setItem(
        "dashboard-data",
        JSON.stringify({ type: "fraction-operations", question: fallbackQuestion })
      );
      hasSentInitial.current = false;
      setHasUserQuestion(true);
      setDashboardData({ type: "fraction-operations", question: fallbackQuestion });
      setQuestionInput("");
      setQuestionFiles(null);
      setIsEditingQuestion(false);
    } finally {
      setIsClassifying(false);
    }
  }

  function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuestion();
  }

  function handleQuestionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-white text-[#080808]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,_#ffffff_0%,_#f7fbff_45%,_#ffffff_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.14),_transparent_48%)]" />

      {/* Left panel: HTML Preview or placeholder */}
      <div className="relative flex min-w-0 flex-1 flex-col border-r border-[#d8d8d8]">
        {/* Page top bar (sibling of chat panel header so they sit at the same top edge) */}
        <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white/95 px-4">
          <div className="flex items-center gap-1">
            <SidebarTrigger />
            <Link
              href="/math"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
              數學科
            </Link>
          </div>
          {!chatVisible && !hideChatForTool && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setChatVisible(true)}
              className="rounded-[4px] border border-[#d8d8d8] bg-white/90 shadow-sm backdrop-blur"
              title="顯示 AI 助手"
            >
              <PanelRight className="size-4" />
            </Button>
          )}
        </div>
        {selectedTool ? (
          <>

            {/* Original question bar */}
            {question && (
              <div className="border-b border-[#d8d8d8] bg-[#f7fbff]/80 px-4 py-3">
                <div className="prose prose-base mx-auto max-w-3xl text-center text-base font-medium leading-relaxed text-[#080808] prose-neutral [&_p]:my-0 [&_.katex]:text-lg">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, { strict: false }]]}
                  >
                    {question}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* HTML Preview */}
            <div className="flex-1 overflow-auto bg-transparent p-4">
              <div
                className="mx-auto h-full w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px] transition-all"
              >
                {isExtractingParams || !previewUrl ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[#5a5a5a]">
                    <Loader2 className="size-8 animate-spin text-[#146ef5]" />
                    <span className="text-sm font-medium">正在根據題目生成練習...</span>
                  </div>
                ) : (
                  <iframe
                    src={previewUrl}
                    className="h-full w-full rounded-[8px]"
                    title="HTML Preview"
                  />
                )}
              </div>
            </div>
          </>
        ) : (isGeneratingAiTool || !!aiToolHtml) ? (
          <div className="flex-1 overflow-auto bg-transparent p-4">
            <div className="mx-auto flex h-full w-full flex-col rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px] transition-all">
              <div className="flex items-start justify-between gap-3 border-b border-[#d8d8d8] px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">AI generated diagram</p>
                  <p className="text-sm font-semibold text-[#080808]">{aiToolTitle ?? genTitle ?? "正在生成圖解"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                {isTeacher && (
                  <>
                <Button
                  type="button"
                  size="sm"
                  variant={selectMode ? "default" : "outline"}
                  onClick={toggleSelectMode}
                  disabled={!aiToolHtml || isGeneratingAiTool}
                  title="選取圖解中的某個部分，再用下方對話框描述要怎麼修改"
                  className={selectMode
                    ? "rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                    : "rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"}
                >
                  <MousePointerClick className="size-4" />
                  {selectMode ? "點選元素中…" : "選取修改"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={hasSavedAiTool ? "outline" : "default"}
                  onClick={openSaveDialog}
                  disabled={!aiToolHtml || isSavingAiTool || isGeneratingAiTool}
                  className={hasSavedAiTool
                    ? "rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"
                    : "rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"}
                >
                  {isSavingAiTool ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {hasSavedAiTool ? "已保存" : "保存"}
                </Button>
                  </>
                )}
                </div>
              </div>
              {!aiToolHtml ? (
                /* Initial generation — there is nothing to keep on screen yet, so
                   show the code as the model writes it. */
                <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center gap-2 text-[#5a5a5a]">
                    <Loader2 className="size-4 animate-spin text-[#146ef5]" />
                    <span className="text-sm font-medium">AI 正在根據你的要求生成 HTML 工具...</span>
                    {genCode.length > 0 && (
                      <span className="ml-auto text-xs tabular-nums text-[#ababab]">
                        已生成 {genCode.length.toLocaleString()} 字元
                      </span>
                    )}
                  </div>
                  <GeneratingCodeFeed code={genCode} className="min-h-0 flex-1" />
                </div>
              ) : (
                /* When modifying an existing tool, keep the current HTML rendered
                   until the new version arrives — only swap it out once
                   regeneration completes, so the preview never goes blank. */
                <div className="relative min-h-0 flex-1">
                  <iframe
                    ref={aiToolIframeRef}
                    srcDoc={injectInspector(sanitizeAiToolHtml(aiToolHtml))}
                    sandbox="allow-scripts"
                    allow="fullscreen"
                    allowFullScreen
                    className={isToolFullscreen
                      ? "fixed inset-0 z-[2147483647] h-screen w-screen border-0 bg-white"
                      : "h-full min-h-0 w-full rounded-b-[8px]"}
                    title={aiToolTitle ?? "AI 生成圖解"}
                  />
                  {isGeneratingAiTool && (
                    <>
                      {/* Pulsing blue ring around the whole preview */}
                      <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-b-[8px] ring-4 ring-inset ring-[#146ef5]/70" />
                      {/* Dimmed backdrop + clear status card */}
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-b-[8px] bg-white/55 p-4 backdrop-blur-[2px]">
                        <div className="pointer-events-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-[12px] border border-[#146ef5]/30 bg-white px-7 py-5 text-center shadow-[0_8px_30px_rgba(20,110,245,0.18)]">
                          <Loader2 className="size-9 animate-spin text-[#146ef5]" />
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-[#080808]">AI 正在修改圖解中…</p>
                            <p className="text-xs text-[#5a5a5a]">完成後會自動替換，原本的圖解會先保留</p>
                          </div>
                          <GeneratingCodeFeed code={genCode} className="max-h-40 w-full" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Placeholder when no tool selected */
          <div className="flex-1 overflow-y-auto p-6">
            {/* Question display */}
            {(question || questionImage) && (
              <div className="mb-6 rounded-[8px] border border-[#d8d8d8] bg-white p-5 shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                      Problem detected
                    </p>
                    <Badge variant="outline" className="rounded-[4px] border-[#d8d8d8] bg-[#146ef5]/10 text-xs font-semibold uppercase tracking-[0.8px] text-[#146ef5]">
                      {typeLabel}
                    </Badge>
                    {questionImage && (
                      <img
                        src={questionImage}
                        alt="題目圖片"
                        className="mt-3 max-h-32 rounded-[8px] border border-[#d8d8d8] object-contain"
                      />
                    )}
                    <div className="prose prose-lg mt-3 max-w-none text-lg font-medium leading-relaxed prose-neutral [&_.katex]:text-2xl">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { strict: false }]]}
                      >
                        {question}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingQuestion(true);
                      setQuestionInput(question);
                      setTimeout(() => questionTextareaRef.current?.focus(), 0);
                    }}
                    title="修改題目"
                    className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-transparent text-[#ababab] transition-colors hover:border-[#d8d8d8] hover:bg-[#f7f7f7] hover:text-[#080808]"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-[#146ef5]/20 bg-[#146ef5]/5 px-3 py-2 text-sm text-[#146ef5]">
                  <ArrowLeft className="size-4 shrink-0" />
                  <span>請從左側工具箱選擇合適的工具開始練習</span>
                </div>
              </div>
            )}

            <div className={`flex flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d8d8d8] bg-white/70 py-10 px-4 text-center ${(question || questionImage) && !isEditingQuestion ? "hidden" : ""}`}>
              {!(question || questionImage) && (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#146ef5]/10 text-[#146ef5]">
                    <Sparkles className="size-7" />
                  </div>
                  <p className="text-lg font-semibold text-[#080808]">
                    {entryMode === "ai-tool"
                      ? "輸入要求讓 AI 為你生成圖解"
                      : "輸入題目讓 AI 為您解答，或直接從左側工具箱選擇工具開始練習"}
                  </p>
                  <p className="mt-1.5 mb-7 text-sm text-[#5a5a5a]">
                    {entryMode === "ai-tool"
                      ? "描述你想要的圖解內容、呈現方式或學習目標"
                      : "部分工具可直接使用，無需輸入題目"}
                  </p>
                </>
              )}
              {(question || questionImage) && isEditingQuestion && (
                <div className="mb-4 flex items-center justify-between w-full max-w-3xl">
                  <p className="text-sm text-[#5a5a5a]">
                    {entryMode === "ai-tool" ? "輸入新要求可重新生成圖解" : "輸入新題目可重新分類"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      stopQuestionListening();
                      setIsEditingQuestion(false);
                      setQuestionInput("");
                      setQuestionFiles(null);
                    }}
                    className="text-xs text-[#5a5a5a] underline-offset-2 hover:text-[#080808] hover:underline"
                  >
                    取消
                  </button>
                </div>
              )}

              {/* Question input form */}
              <form onSubmit={handleQuestionSubmit} className="w-full max-w-3xl">
                <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[0px_30px_18px_rgba(0,0,0,0.04),0px_13px_13px_rgba(0,0,0,0.08),0px_3px_7px_rgba(0,0,0,0.09)] transition-all focus-within:border-[#146ef5] focus-within:shadow-[0px_30px_18px_rgba(20,110,245,0.09),0px_13px_13px_rgba(20,110,245,0.14),0px_3px_7px_rgba(20,110,245,0.2)]">
                  {questionFiles && questionFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 pt-3">
                      {Array.from(questionFiles).map((file, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="size-16 cursor-zoom-in rounded-[4px] border border-[#d8d8d8] object-cover"
                            onClick={() => setQuestionPreviewSrc(URL.createObjectURL(file))}
                          />
                          <button
                            type="button"
                            onClick={() => removeQuestionFile(i)}
                            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-[#080808] text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea
                    ref={questionTextareaRef}
                    placeholder={entryMode === "ai-tool"
                      ? "輸入要求讓 AI 為你生成圖解，例如：用棒形圖呈現 135 張椅子平均分成 9 排（可直接粘貼圖片）"
                      : "輸入數學題目，例如：3/4 + 1/2 = ?（可直接粘貼圖片）"}
                    value={questionInput}
                    onChange={(e) => handleQuestionInputChange(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    onPaste={handleQuestionPaste}
                    disabled={isClassifying}
                    className="min-h-[140px] resize-none border-0 bg-transparent px-6 pt-5 pb-16 text-xl font-medium leading-[1.6] tracking-[-0.01em] text-left text-[#080808] shadow-none placeholder:text-[#ababab] focus-visible:ring-0"
                  />

                  <input
                    ref={questionFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleQuestionFileChange}
                    className="hidden"
                  />

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => questionFileInputRef.current?.click()}
                        disabled={isClassifying}
                        className="rounded-[4px] border border-[#d8d8d8] bg-white text-[#080808] transition-all hover:translate-x-[2px] hover:border-[#898989] hover:bg-white hover:text-[#080808]"
                      >
                        <ImagePlus className="size-4 text-[#5a5a5a]" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggleQuestionVoice}
                        disabled={isClassifying}
                        className={`rounded-[4px] border bg-white transition-all hover:translate-x-[2px] hover:bg-white ${
                          isQuestionListening
                            ? 'border-red-400 text-red-500 hover:border-red-500 hover:text-red-600'
                            : 'border-[#d8d8d8] text-[#080808] hover:border-[#898989] hover:text-[#080808]'
                        }`}
                        title={isQuestionListening ? '停止語音輸入' : '語音輸入'}
                        aria-label={isQuestionListening ? '停止語音輸入' : '語音輸入'}
                      >
                        {isQuestionListening ? (
                          <MicOff className="size-4" />
                        ) : (
                          <Mic className="size-4 text-[#5a5a5a]" />
                        )}
                      </Button>
                      {isQuestionListening && (
                        <span aria-live="polite" className="text-[12px] font-medium text-red-500 animate-pulse">
                          聆聽中…
                        </span>
                      )}
                      {!isQuestionListening && questionVoiceError && (
                        <span role="alert" className="text-[12px] font-medium text-red-500">
                          {questionVoiceError.message}
                        </span>
                      )}
                    </div>

                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-[4px] border border-transparent bg-[#146ef5] text-white shadow-[0_8px_20px_rgba(20,110,245,0.34)] transition-all hover:translate-x-[6px] hover:bg-[#0055d4] hover:shadow-[0_10px_24px_rgba(20,110,245,0.44)]"
                      disabled={!canSubmitQuestion}
                    >
                      {isClassifying ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowUp className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Question preview lightbox */}
            {questionPreviewSrc && (
              <div
                className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70"
                onClick={() => setQuestionPreviewSrc(null)}
              >
                <button
                  className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white text-[#080808] transition-colors hover:bg-white/85"
                  onClick={() => setQuestionPreviewSrc(null)}
                >
                  <X className="size-5" />
                </button>
                <img
                  src={questionPreviewSrc}
                  alt="Preview"
                  className="max-h-[90vh] max-w-[90vw] rounded-[8px] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel: AI Chat (narrower) */}
      {chatVisible && !hideChatForTool && (selectedTool === "volume-cubes" ? (
        <VolumeChatPanel key={toolChatSessionIds["volume-cubes"]} sessionId={toolChatSessionIds["volume-cubes"]} hasUserQuestion={hasUserQuestion} question={question || undefined} type={type} toolUrl={previewUrl ?? undefined} onNewChat={handleNewChat} onHide={() => setChatVisible(false)} />
      ) : selectedTool === "clock-24hrs" || selectedTool === "clock-time-difference" ? (
        <ClockChatPanel key={`${selectedTool}-${toolChatSessionIds[selectedTool]}`} selectedTool={selectedTool} sessionId={toolChatSessionIds[selectedTool]} hasUserQuestion={hasUserQuestion} question={question || undefined} type={type} toolUrl={previewUrl ?? undefined} onNewChat={handleNewChat} onHide={() => setChatVisible(false)} />
      ) : (
        <div className="relative flex w-[360px] shrink-0 flex-col min-h-0 bg-white/95">
        <div className="border-b border-[#d8d8d8] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#146ef5] text-white">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">Math assistant</p>
                <p className="text-sm font-semibold text-[#080808]">AI Chatbot</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleNewChat}
                className="rounded-[4px] border border-transparent bg-[#146ef5] px-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(20,110,245,0.28)] transition-all hover:bg-[#0055d4] hover:shadow-[0_8px_20px_rgba(0,85,212,0.34)]"
                title="新建聊天"
              >
                New Chat
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setChatVisible(false)}
                className="rounded-[4px]"
                title="隱藏 AI 助手"
              >
                <PanelRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 min-h-0 bg-[linear-gradient(180deg,_rgba(20,110,245,0.03)_0%,_rgba(255,255,255,1)_35%)]">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-2 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <ChatAvatar
                  role="assistant"
                  className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
                />
              )}
              <div
                className={`min-w-0 max-w-[85%] rounded-[8px] px-3 py-2 text-sm leading-relaxed shadow-[2px_2px_0px_#080808] ${
                  message.role === "user"
                    ? "bg-[#146ef5] text-white"
                    : "border border-[#d8d8d8] bg-white text-[#080808]"
                }`}
              >
                {message.parts.some((p) => p.type === "file") && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5 not-prose">
                    {message.parts
                      .filter((p): p is { type: "file"; mediaType: string; url: string; filename?: string } => p.type === "file" && p.mediaType.startsWith("image/"))
                      .map((filePart, i) => (
                        <img
                          key={i}
                          src={filePart.url}
                          alt={filePart.filename ?? "uploaded image"}
                          className="max-w-[200px] max-h-[200px] rounded-[4px] border border-white/30 object-contain"
                        />
                      ))}
                  </div>
                )}
                {message.parts
                  .filter((part): part is { type: "text"; text: string } => part.type === "text")
                  .map((part, i) => (
                    message.role === "assistant" ? (
                      <div
                        key={i}
                        className="prose prose-sm max-w-none break-words prose-p:my-2 prose-li:my-1 prose-headings:my-2 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-words"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {part.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="prose prose-sm w-full max-w-none break-words overflow-hidden prose-invert prose-p:my-1 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex]:text-white [&_.katex-display]:overflow-y-hidden"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {stripTextModeLatex(part.text)}
                        </ReactMarkdown>
                      </div>
                    )
                  ))}
              </div>
              {message.role === "user" && (
                <ChatAvatar
                  role="user"
                  className="h-8 w-8 rounded-[4px] border border-[#d8d8d8] bg-white"
                />
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex items-start gap-2 justify-start">
              <ChatAvatar
                role="assistant"
                className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
              />
              <div className="rounded-[8px] border border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#5a5a5a]">
                <span className="animate-pulse">思考中...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        <div className="border-t border-[#d8d8d8] px-3 py-3 bg-white">
          <form onSubmit={handleSubmit}>
            {pendingSelection && (
              <div className="mb-2 flex items-center gap-2 rounded-[6px] border border-[#146ef5]/30 bg-[#146ef5]/5 px-2.5 py-1.5 text-xs text-[#146ef5]">
                <MousePointerClick className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium" title={pendingSelection.label}>
                  將修改：{pendingSelection.label}
                  {pendingSelection.dynamic && (
                    <span className="ml-1 font-normal text-[#146ef5]/70">（由程式生成，會改生成邏輯）</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingSelection(null)}
                  className="flex size-4 shrink-0 items-center justify-center rounded-full text-[#146ef5] hover:bg-[#146ef5]/15"
                  title="取消選取"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
              {/* Image preview thumbnails */}
              {chatFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                  {chatFiles.map((file, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="size-12 rounded-[4px] border border-[#d8d8d8] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeChatFile(i)}
                        className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#080808] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Textarea
                ref={textareaRef}
                placeholder={pendingSelection
                  ? "描述要怎麼修改選取的部分...（可直接粘貼圖片）"
                  : entryMode === "ai-tool" ? "針對這個圖解繼續提問...（可直接粘貼圖片）" : "繼續提問...（可直接粘貼圖片）"}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="min-h-[58px] max-h-[160px] resize-none overflow-y-auto border-0 bg-transparent px-3 pt-3 pb-10 text-sm shadow-none focus-visible:ring-0"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleChatFileChange}
                className="hidden"
              />

              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-[4px] border border-[#d8d8d8] bg-white text-[#080808] transition-all hover:border-[#898989] hover:bg-white"
                    title="上傳圖片"
                  >
                    <ImagePlus className="size-3.5 text-[#5a5a5a]" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={toggleVoice}
                    className={`rounded-[4px] border bg-white transition-all hover:bg-white ${
                      isListening
                        ? 'border-red-400 text-red-500 hover:border-red-500 hover:text-red-600'
                        : 'border-[#d8d8d8] text-[#080808] hover:border-[#898989] hover:text-[#080808]'
                    }`}
                    title={isListening ? '停止語音輸入' : '語音輸入'}
                    aria-label={isListening ? '停止語音輸入' : '語音輸入'}
                  >
                    {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5 text-[#5a5a5a]" />}
                  </Button>
                  {isListening && (
                    <span aria-live="polite" className="text-[11px] font-medium text-red-500 animate-pulse">聆聽中…</span>
                  )}
                  {!isListening && voiceError && (
                    <span role="alert" className="text-[11px] font-medium text-red-500">{voiceError.message}</span>
                  )}
                </div>
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="rounded-[4px]"
                    onClick={stop}
                  >
                    <Square className="size-3" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon-sm"
                    className="rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                    disabled={!canSend}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
      ))}

      {/* Save dialog — asks the teacher to name the tool before saving */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>保存圖解</DialogTitle>
            <DialogDescription>請為這個 AI 生成的圖解命名，方便日後在「圖解生成記錄」中尋找。</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={saveNameDraft}
            onChange={(e) => setSaveNameDraft(e.target.value)}
            placeholder="請輸入圖解名稱"
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === "Enter" && saveNameDraft.trim() && !isSavingAiTool) {
                e.preventDefault();
                saveAiTool(saveNameDraft);
              }
            }}
          />
          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={isSavingAiTool}
              className="rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => saveAiTool(saveNameDraft)}
              disabled={!saveNameDraft.trim() || isSavingAiTool}
              className="rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
            >
              {isSavingAiTool ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
