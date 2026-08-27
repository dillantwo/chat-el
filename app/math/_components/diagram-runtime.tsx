"use client";

import { useEffect, useRef } from "react";

/**
 * Runtime pieces shared by the AI 圖解 workspace (app/math/diagram).
 *
 * These are all *preview-time* concerns: what gets injected into the sandboxed
 * iframe, how a click inside it is mapped back onto the pristine model output,
 * and the live code feed shown while the model writes. None of it is ever
 * saved — the stored HTML stays exactly as the model wrote it.
 */

/**
 * Hosts that have been compromised and must never load inside the tool iframe.
 * polyfill.io was taken over in 2024 and now serves a 401 Basic-Auth challenge
 * (the browser "Sign in" popup) or malicious code, so any reference is removed.
 * This also scrubs tools that were generated/saved before the server-side guard
 * was added.
 */
const BLOCKED_IFRAME_HOSTS = ["polyfill.io", "polyfill.com", "bootcss.com", "bootcdn.net", "staticfile.org"];

export function sanitizeAiToolHtml(html: string | null): string | undefined {
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
export function GeneratingCodeFeed({ code, className }: { code: string; className?: string }) {
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
export interface InspectorPathStep {
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
export function markTargetInPristineHtml(
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
export function injectInspector(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const scripts = `${FULLSCREEN_SHIM}${CHART_SIZING_FIX}${INSPECTOR_SCRIPT}`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${scripts}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${scripts}</html>`);
  return html + scripts;
}
