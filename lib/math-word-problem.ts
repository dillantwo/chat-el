/**
 * 數學工具「題目文字」（word problem）的分數渲染工具。
 *
 * 四則運算工具（fraction-addition / subtraction / multiplication / division）
 * 只有兩組分數輸入框，所以 AI 提取參數時只把題目中的前兩個分數換成
 * [FRAC1] / [FRAC2]。題目若出現第三、第四個分數（例如「三人各吃了 1/8、4/8、
 * 2/8 個蛋糕」），AI 會原樣保留它的寫法 —— 常見是 LaTeX（\frac{2}{8}）。
 * 這些文字直接寫進 innerHTML，學生看到的就會是 "\frac{2}{8}" 原始碼。
 *
 * 這裡提供兩層處理：
 *   1. normalizeMathText()：把 LaTeX 分數／數學模式符號轉成純文字 a/b（伺服器端
 *      提取參數後就先做一次，URL 裡的 context 就不會再帶 LaTeX）。
 *   2. renderWordProblemHtml()：畫面渲染時，把殘留的純文字分數（2/8、1 2/8）
 *      也轉成跟 [FRAC1] 一樣的堆疊分數 HTML，並轉義 AI 文字避免注入標籤。
 */

export type FractionParts = { whole: number; num: number; den: number };

/** LaTeX \frac{a}{b}、\dfrac{a}{b}、\tfrac{a}{b}（分子/分母可含空白） */
const LATEX_FRAC_BRACED = /\\(?:d|t)?frac\s*\{\s*(\d{1,4})\s*\}\s*\{\s*(\d{1,4})\s*\}/g;
/** LaTeX 簡寫 \frac12 → 1/2 */
const LATEX_FRAC_SHORT = /\\(?:d|t)?frac\s*(\d)\s*(\d)/g;

/**
 * 把題目文字裡的 LaTeX 分數與數學模式符號轉成純文字。
 * 例：「詩恩吃了 $\frac{2}{8}$ 個」→「詩恩吃了 2/8 個」
 */
export function normalizeMathText(text: string): string {
  if (!text) return text;
  return text
    .replace(LATEX_FRAC_BRACED, (_m, n, d) => `${n}/${d}`)
    .replace(LATEX_FRAC_SHORT, (_m, n, d) => `${n}/${d}`)
    // \left( \right) 之類的包裝指令
    .replace(/\\left|\\right/g, "")
    // LaTeX 間距指令 \, \; \: \!
    .replace(/\\[,;:!]/g, "")
    // 行內／行間數學模式分隔符：$ $$ \( \) \[ \]
    .replace(/\$\$?/g, "")
    .replace(/\\[()[\]]/g, "")
    // 上面的替換會留下多餘空白
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * 純文字分數：2/8、1 2/8、1又2/8（也接受 ⁄ 與全角／）。
 *
 * - 前後用 lookbehind/lookahead 擋掉數字、小數點與斜線，避免把 2026/9/18、
 *   1.5/2 這類字串誤判成分數。
 * - 整數與分子之間必須有空白或「又」，否則 23/6 會被讀成 2 又 3/6。
 */
const PLAIN_FRACTION =
  /(?<![\d./\u2044\uFF0F])(?:(\d{1,3})(?:\s*又\s*|[ \t\u00a0\u3000]+))?(\d{1,3})\s*[/\u2044\uFF0F]\s*(\d{1,3})(?![\d./\u2044\uFF0F])/g;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** 找出文字裡所有純文字分數，依出現順序回傳。 */
export function parseFractionsInText(text: string): FractionParts[] {
  if (!text) return [];
  const out: FractionParts[] = [];
  for (const m of normalizeMathText(text).matchAll(PLAIN_FRACTION)) {
    const den = parseInt(m[3], 10);
    if (!den) continue;
    out.push({
      whole: m[1] ? parseInt(m[1], 10) : 0,
      num: parseInt(m[2], 10),
      den,
    });
  }
  return out;
}

/**
 * 渲染題目文字：把 [FRACn] 換成工具提供的互動分數 HTML，其餘純文字分數換成
 * 靜態堆疊分數 HTML。
 *
 * @param template AI 提取的題目文字（含 [FRAC1] / [FRAC2] 佔位符）
 * @param placeholderHtml 依序對應 [FRAC1]、[FRAC2]… 的 HTML（已是可信內容）
 * @param buildFractionHtml 產生靜態堆疊分數 HTML 的函式（各工具自己的樣式）
 */
export function renderWordProblemHtml(
  template: string,
  placeholderHtml: string[],
  buildFractionHtml: (parts: FractionParts) => string
): string {
  if (!template) return "";

  // 1. LaTeX → 純文字，再轉義，AI 文字就不可能帶進標籤
  let html = escapeHtml(normalizeMathText(template));

  // 2. 剩下的純文字分數 → 堆疊分數（第三個之後的分數就是走這條路徑）
  html = html.replace(PLAIN_FRACTION, (_m, w, n, d) => {
    const den = parseInt(d, 10);
    if (!den) return _m;
    return buildFractionHtml({
      whole: w ? parseInt(w, 10) : 0,
      num: parseInt(n, 10),
      den,
    });
  });

  // 3. 佔位符 → 工具的互動分數。沒有對應值時（AI 違規用了 [FRAC3]）整段移除，
  //    避免把佔位符原樣顯示給學生。
  html = html.replace(/\[FRAC(\d+)\]/g, (_m, idx) => placeholderHtml[Number(idx) - 1] ?? "");

  return html;
}
