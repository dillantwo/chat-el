/**
 * 「AI 推薦工具」的解題步驟。
 *
 * AI 先理解整道題目，把解題過程拆成幾個步驟，每一步對應一個工具，並帶上
 * 這一步自己要用的數字。例如「紅豆佔全部的 1/4，綠豆佔全部的 3/8，黃豆佔
 * 全部的幾分之幾？」會拆成：
 *   1. 異分母加法：1/4 + 3/8（紅豆和綠豆共佔）
 *   2. 整數與分數互換：全部 = 1 = 8/8
 *   3. 異分母減法：8/8 − 5/8
 *
 * 點擊步驟時直接用這裏的數字開啟工具，不必再讓 AI 從整道題目重新讀參數
 * （重新讀只會拿到題目裏最先出現的兩個數，多步題目就會讀錯）。
 *
 * 這個檔案同時給 API（清理 AI 輸出）和前端（組工具網址）使用，不可依賴伺服器端套件。
 */

import { buildTemplateFromQuestion, normalizeMathText } from "@/lib/math-word-problem";

export type StepNumber = { whole: number; num: number; den: number };

export type ConvertMode = "whole" | "fraction" | "mixed";

/** 相等分數工具：擴分或約分 */
export type EquivalentMode = "expand" | "simplify";

export interface MathToolStep {
  toolKey: string;
  /** 這一步要做什麼，例如「紅豆和綠豆共佔全部的幾分之幾？」 */
  title: string;
  /** 四則運算：第一個數；整數與分數互換：要轉換的數；相等分數：要擴分或約分的分數 */
  operand1: StepNumber | null;
  /** 四則運算：第二個數 */
  operand2: StepNumber | null;
  /** 整數與分數互換：數值原本的顯示型態 */
  convertMode: ConvertMode | null;
  /** 相等分數：擴分或約分（舊版快取的步驟沒有這個欄位） */
  equivalentMode?: EquivalentMode | null;
  /** 四則運算工具顯示的題目文字，兩個數的位置用 [FRAC1] / [FRAC2] */
  context: string | null;
}

/** 讀取 num1/den1/num2/den2/whole1/whole2/context 的「兩數運算」工具頁 */
export const OPERATION_TOOL_ROUTES: Record<string, string> = {
  "fraction-addition": "/math/fraction-addition",
  "fraction-subtraction": "/math/fraction-subtraction",
  "fraction-multiplication": "/math/fraction-multiplication",
  "fraction-division": "/math/fraction-division",
};

export const CONVERTING_TOOL_KEY = "fraction-converting";
export const EQUIVALENT_TOOL_KEY = "fraction-expanding-simplifying";

/** 這些工具可以只靠步驟裏的數字開啟。 */
export function stepToolTakesNumbers(toolKey: string): boolean {
  return (
    toolKey in OPERATION_TOOL_ROUTES || toolKey === CONVERTING_TOOL_KEY || toolKey === EQUIVALENT_TOOL_KEY
  );
}

const MAX_STEPS = 6;

function toInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** 範圍與工具頁的輸入框一致：整數部分 0–10、分子 0–100、分母 1–100。 */
function sanitizeNumber(raw: unknown): StepNumber | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const whole = toInt(r.whole) ?? 0;
  const num = toInt(r.num) ?? 0;
  const den = toInt(r.den);
  if (den === null || den < 1 || den > 100) return null;
  if (whole < 0 || whole > 10 || num < 0 || num > 100) return null;
  if (whole === 0 && num === 0) return null;
  // AI 偶爾把整數寫成 N/1
  if (whole === 0 && den === 1) return { whole: num, num: 0, den: 1 };
  return { whole, num, den };
}

function sanitizeContext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = normalizeMathText(raw)
    // 工具只有兩個數，多出來的佔位符沒有值可以填
    .replace(/\[FRAC[3-9]\]/g, "")
    .trim()
    .slice(0, 300);
  if (!text.includes("[FRAC1]") || !text.includes("[FRAC2]")) return null;
  return text;
}

/**
 * 清理 AI 回傳的步驟：
 * - toolKey 必須是可用工具，避免推薦不存在或沒有權限的工具
 * - 數字超出工具範圍、分母為 0 的就當作沒有數字（點擊時改用舊的參數提取）
 * - 除法的除數不可為 0
 */
export function sanitizeSteps(
  raw: unknown,
  allowedKeys: ReadonlySet<string>,
  /** 原本的題目文字；有的話，四則運算工具的題目直接用它，不用 AI 改寫的版本 */
  question = ""
): MathToolStep[] {
  if (!Array.isArray(raw)) return [];

  const steps: MathToolStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const toolKey = typeof r.toolKey === "string" ? r.toolKey.trim() : "";
    if (!allowedKeys.has(toolKey)) continue;

    const title = typeof r.title === "string" ? normalizeMathText(r.title).slice(0, 120) : "";
    let operand1: StepNumber | null = null;
    let operand2: StepNumber | null = null;
    let convertMode: ConvertMode | null = null;
    let equivalentMode: EquivalentMode | null = null;
    let context: string | null = null;

    if (toolKey in OPERATION_TOOL_ROUTES) {
      operand1 = sanitizeNumber(r.operand1);
      operand2 = sanitizeNumber(r.operand2);
      if (!operand1 || !operand2) {
        operand1 = null;
        operand2 = null;
      } else {
        context = sanitizeContext(r.context);
      }
    } else if (toolKey === CONVERTING_TOOL_KEY) {
      operand1 = sanitizeNumber(r.operand1);
      if (operand1) {
        const mode = r.convertMode;
        convertMode =
          mode === "whole" || mode === "fraction" || mode === "mixed"
            ? mode
            : operand1.num === 0
              ? "whole"
              : operand1.whole > 0
                ? "mixed"
                : "fraction";
        // 整數模式只顯示整數部分，帶分數的分子會被藏起來，所以不能用在帶分數上
        if (convertMode === "whole" && operand1.num > 0) {
          convertMode = operand1.whole > 0 ? "mixed" : "fraction";
        }
      }
    } else if (toolKey === EQUIVALENT_TOOL_KEY) {
      // 相等分數工具只接受分子不大於分母的分數（工具會把較大的分子壓成分母），
      // 帶分數、假分數就當作沒有數字。
      const v = sanitizeNumber(r.operand1);
      if (v && v.whole === 0 && v.num >= 1 && v.num <= v.den) {
        operand1 = v;
        equivalentMode = r.equivalentMode === "simplify" ? "simplify" : "expand";
      }
    }

    steps.push({ toolKey, title, operand1, operand2, convertMode, equivalentMode, context });
    if (steps.length >= MAX_STEPS) break;
  }
  return useOriginalQuestion(uniqueToolSteps(dropMixedConversionSteps(steps)), question);
}

/**
 * 四則運算工具上方的題目：兩個運算數都能在原題裏找到時，直接用原題，只把這兩個數
 * 換成 [FRAC1] / [FRAC2]，其他文字（例如第三個人吃的 2/8）一字不改。
 * 運算數是前面算出來的結果（原題裏沒有）時，才用 AI 寫的 context。
 * 要在 dropMixedConversionSteps 之後做，運算數才是原題的寫法（1 1/2 而不是 3/2）。
 */
function useOriginalQuestion(steps: MathToolStep[], question: string): MathToolStep[] {
  if (!question) return steps;
  return steps.map((s) => {
    if (!(s.toolKey in OPERATION_TOOL_ROUTES) || !s.operand1 || !s.operand2) return s;
    const template = buildTemplateFromQuestion(s.operand1, s.operand2, question);
    return template ? { ...s, context: template.slice(0, 300) } : s;
  });
}

/**
 * 側欄只列出需要用到的工具，每個工具一次（擴分、約分都是「相等分數」，
 * 4/6 和 5/10 也是同一個工具）。保留每個工具第一次出現的那一項，
 * 開啟工具時就用它的數字。舊版快取的步驟也要經過這裏。
 */
export function uniqueToolSteps(steps: MathToolStep[]): MathToolStep[] {
  const seen = new Set<string>();
  return steps.filter((s) => {
    if (seen.has(s.toolKey)) return false;
    seen.add(s.toolKey);
    return true;
  });
}

/** a、b 的數值是否相等（1 1/2 和 3/2 相等） */
function sameValue(a: StepNumber, b: StepNumber): boolean {
  return (a.whole * a.den + a.num) * b.den === (b.whole * b.den + b.num) * a.den;
}

/**
 * 四則運算工具本身就能輸入帶分數，所以「先把 1 1/2 化成 3/2，再算 3/2 − 3/8」
 * 這種步驟是多餘的。AI 不一定照提示詞做，這裏再把它併掉：
 * - 有四則運算步驟時，拿掉帶分數 ↔ 假分數的互換步驟
 * - 之後的四則運算若用到互換後的數，改回題目原本的寫法（1 1/2）
 * 只有互換、沒有四則運算的概念題（「把 1 1/2 化成假分數」）不受影響；
 * 整數化成分數（1 = 8/8）的步驟也保留。
 */
function dropMixedConversionSteps(steps: MathToolStep[]): MathToolStep[] {
  if (!steps.some((s) => s.toolKey in OPERATION_TOOL_ROUTES)) return steps;

  const out: MathToolStep[] = [];
  const originals: StepNumber[] = [];
  for (const step of steps) {
    if (step.toolKey === CONVERTING_TOOL_KEY && step.operand1 && step.operand1.num > 0) {
      originals.push(step.operand1);
      continue;
    }
    if (step.toolKey in OPERATION_TOOL_ROUTES && originals.length > 0) {
      const restore = (n: StepNumber | null) =>
        n ? originals.find((o) => sameValue(o, n)) ?? n : n;
      out.push({ ...step, operand1: restore(step.operand1), operand2: restore(step.operand2) });
      continue;
    }
    out.push(step);
  }
  return out;
}

/**
 * 用步驟裏的數字組出工具網址（不含 basePath）。
 * 沒有足夠數字時回傳 null，讓呼叫端改用舊的參數提取流程。
 */
export function buildStepToolPath(step: MathToolStep): string | null {
  const opRoute = OPERATION_TOOL_ROUTES[step.toolKey];
  if (opRoute) {
    const a = step.operand1;
    const b = step.operand2;
    if (!a || !b) return null;
    const qs = new URLSearchParams({
      whole1: String(a.whole),
      num1: String(a.num),
      den1: String(a.den),
      whole2: String(b.whole),
      num2: String(b.num),
      den2: String(b.den),
    });
    if (step.context) qs.set("context", step.context);
    return `${opRoute}?${qs.toString()}`;
  }

  if (step.toolKey === CONVERTING_TOOL_KEY) {
    const v = step.operand1;
    if (!v) return null;
    const qs = new URLSearchParams({
      whole: String(v.whole),
      num: String(v.num),
      den: String(v.den),
      mode: step.convertMode ?? "fraction",
    });
    return `/math/fraction-converting?${qs.toString()}`;
  }

  if (step.toolKey === EQUIVALENT_TOOL_KEY) {
    const v = step.operand1;
    if (!v) return null;
    const qs = new URLSearchParams({
      numerator: String(v.num),
      denominator: String(v.den),
      mode: step.equivalentMode ?? "expand",
    });
    return `/math/fraction-es?${qs.toString()}`;
  }

  return null;
}

/** 側欄和題目欄顯示用：1/4、2 1/4、2 */
export function formatStepNumber(n: StepNumber): string {
  if (n.num === 0) return String(n.whole);
  return n.whole > 0 ? `${n.whole} ${n.num}/${n.den}` : `${n.num}/${n.den}`;
}

const OPERATION_SYMBOLS: Record<string, string> = {
  "fraction-addition": "+",
  "fraction-subtraction": "−",
  "fraction-multiplication": "×",
  "fraction-division": "÷",
};

/** 例如「1/4 + 3/8」、「1 → 分數」；沒有數字時回傳空字串。 */
export function describeStepNumbers(step: MathToolStep): string {
  const symbol = OPERATION_SYMBOLS[step.toolKey];
  if (symbol && step.operand1 && step.operand2) {
    return `${formatStepNumber(step.operand1)} ${symbol} ${formatStepNumber(step.operand2)}`;
  }
  if (step.toolKey === CONVERTING_TOOL_KEY && step.operand1) {
    const v = step.operand1;
    if (v.num === 0) return `${v.whole} = ?/${v.den}`;
    return formatStepNumber(v);
  }
  if (step.toolKey === EQUIVALENT_TOOL_KEY && step.operand1) {
    return `${formatStepNumber(step.operand1)} ${step.equivalentMode === "simplify" ? "約分" : "擴分"}`;
  }
  return "";
}
