import { createAzure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { recordTokenUsage } from "@/lib/token-usage";

/**
 * Dedicated Azure provider for the math AI tool generator.
 * Uses gpt-5.3-codex with API version 2026-02-24, independent from the shared
 * AZURE_OPENAI_DEPLOYMENT used by the other subjects. Falls back to the shared
 * config when the HTML-specific env vars are not set.
 */
const htmlGenProvider = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiKey: process.env.AZURE_API_KEY,
  // Azure codex models use the Responses API, which @ai-sdk/azure v3 serves via
  // the new /openai/v1 endpoint. That endpoint only accepts api-version=preview
  // (dated versions like 2025-04-01-preview are rejected / 404 on this path).
  apiVersion: process.env.AZURE_OPENAI_HTML_API_VERSION ?? "preview",
});

const HTML_GEN_DEPLOYMENT =
  process.env.AZURE_OPENAI_HTML_DEPLOYMENT ??
  process.env.AZURE_OPENAI_DEPLOYMENT ??
  "gpt-5.3-codex";

function stripCodeFences(html: string): string {
  return html
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/**
 * Whitelist of trusted external hosts that generated tools are allowed to load
 * scripts / styles / fonts from. Using a whitelist (rather than a blocklist of
 * known-bad hosts) keeps the generated HTML small — the model can pull in well
 * known libraries (KaTeX, Chart.js, MathJax, …) from a pinned CDN instead of
 * re-implementing everything inline — while still guaranteeing that compromised
 * hosts such as polyfill.io can never sneak in.
 *
 * A reference is allowed when its host exactly matches an entry below or is a
 * subdomain of one. Relative paths, data: / blob: URLs and in-page anchors are
 * always allowed (they are not external).
 */
const ALLOWED_EXTERNAL_HOSTS = [
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

/** Extract the lowercased host from an absolute or protocol-relative URL. */
function getExternalHost(url: string): string | null {
  const match = url.trim().match(/^(?:https?:)?\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Returns true when the reference is safe to keep: either it is not an external
 * URL at all (relative / data: / blob: / anchor) or its host is on the
 * whitelist (exact match or subdomain).
 */
function isAllowedExternalUrl(url: string): boolean {
  const host = getExternalHost(url);
  if (!host) return true; // not an external absolute URL
  return ALLOWED_EXTERNAL_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

/**
 * Strip any <script src="..."> / <link href="..."> that points at a host which
 * is not on the whitelist. The system prompt already tells the model which CDNs
 * are permitted, but we defensively enforce it server-side so a stray external
 * reference (e.g. the compromised polyfill.io) can never reach the iframe.
 */
function removeDisallowedExternalAssets(html: string): string {
  return (
    html
      // Drop full <script ...></script> blocks whose src is not whitelisted.
      .replace(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>[\s\S]*?<\/script>/gi, (match, _q, src) =>
        isAllowedExternalUrl(src) ? match : ""
      )
      // Drop self-closing / void <script src=...> tags too.
      .replace(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*\/?>/gi, (match, _q, src) =>
        isAllowedExternalUrl(src) ? match : ""
      )
      // Drop <link ... href="..."> (stylesheets, preconnect, preload, …) that
      // point at a non-whitelisted host.
      .replace(/<link\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[^>]*\/?>/gi, (match, _q, href) =>
        isAllowedExternalUrl(href) ? match : ""
      )
  );
}

function ensureHtmlDocument(html: string): string {
  const cleaned = removeDisallowedExternalAssets(stripCodeFences(html));
  if (/<!doctype html>/i.test(cleaned) || /<html[\s>]/i.test(cleaned)) {
    return cleaned;
  }

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Generated Tool</title>
  </head>
  <body>
    ${cleaned}
  </body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const denied = await requireTopicApi("math", "ai-problem-solving");
    if (denied) return denied;

    const { prompt, imageData, currentHtml, currentTitle, targetedEdit } = (await req.json()) as {
      prompt?: string;
      imageData?: string;
      currentHtml?: string;
      currentTitle?: string;
      targetedEdit?: boolean;
    };

    /**
     * Build the user instruction. When `targetedEdit` is set, the supplied
     * currentHtml contains exactly one element tagged with a `data-ai-target`
     * attribute (added client-side when the teacher clicks an element). We ask
     * the model to confine its changes to that element so unrelated parts of a
     * large tool stay byte-for-byte stable.
     */
    const makeUserText = (p: string) => {
      if (!currentHtml) {
        return `請根據以下要求生成一個可直接執行的互動數學 HTML 工具：${p}`;
      }
      if (targetedEdit) {
        return `請只修改下面 HTML 中被標記了 data-ai-target 屬性的那一個元素（以及為了滿足要求而必須連帶調整的最小範圍），其餘所有內容務必保持原樣、不要重做。修改要求：${p}。完成後請在輸出中移除 data-ai-target 這個臨時標記屬性。`;
      }
      return `請根據以下修改要求更新這個互動數學 HTML 工具：${p}`;
    };

    if (!prompt && !imageData) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = await getSession().catch(() => null);

    const messages: Array<{
      role: "user";
      content:
        | string
        | Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }>;
    }> = [];

    if (imageData) {
      const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
      const mimeType = match ? match[1] : "image/png";
      const base64 = match ? match[2] : imageData;

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: makeUserText(prompt || "（見圖片）"),
          },
          {
            type: "image",
            image: base64,
            mimeType,
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: makeUserText(prompt ?? ""),
      });
    }

    if (currentHtml) {
      messages.unshift({
        role: "user",
        content: `這是目前工具的資訊：\n標題：${currentTitle || "未命名工具"}\n\n請保留可用的互動部分，只按最新要求修改。\n\n目前 HTML：\n${currentHtml}`,
      });
    }

    const result = await generateObject({
      model: htmlGenProvider(HTML_GEN_DEPLOYMENT),
      system: `你是一位資深前端互動教具工程師，專門為老師製作可直接在瀏覽器中運行的單檔 HTML 學習工具。

請根據老師的要求，生成或更新一個完整、可直接放進 iframe 的 HTML 文件。

硬性要求：
1. 回傳完整 HTML，必須是單一 HTML 文件。
2. 你自己撰寫的 CSS 和 JavaScript 都要內嵌在 HTML 內。如需第三方函式庫（例如 KaTeX、Chart.js、MathJax、D3 等），只能透過以下白名單 CDN 引入，並且必須鎖定明確版本號（不要用 latest）：
   - cdn.jsdelivr.net
   - unpkg.com
   - cdnjs.cloudflare.com
   - 字體可用 fonts.googleapis.com 與 fonts.gstatic.com
   除上述白名單網域外，嚴禁任何其他外部 <script src> 或 <link href>；特別嚴禁 polyfill.io、cdn.polyfill.io（這些網域已被入侵，會導致瀏覽器跳出登入視窗）。能用內嵌就內嵌，只有體積較大的常用函式庫才從白名單 CDN 引入，以保持輸出精簡。
3. 介面要清晰、現代、適合桌面與平板。
4. 工具需要真的可互動，不能只是一頁靜態說明。
5. 內容以繁體中文呈現。
6. 若題意不足，補上最合理的預設值，但仍要讓工具可運作。
7. 不要輸出 Markdown code fences。
8. 如果提供了目前 HTML，代表這次是修改既有工具，不要無故重做成完全不同的工具；優先保留原本可用的互動結構，再按要求調整。
8b. 若 HTML 中有某個元素帶有 data-ai-target 屬性，代表老師只想修改「那一個元素」相關的部分，請把改動集中在它身上，其餘內容保持原樣；並且務必在最終輸出中移除 data-ai-target 這個臨時屬性。

版面與自適應要求（這個工具會被嵌入 iframe，請務必遵守）：
9. html、body 設為 height:100%、margin:0，並用 box-sizing:border-box；最外層容器用 min-height:100vh，讓內容能填滿 iframe，全螢幕時也能正常撐開、置中。
10. 嚴禁版面重疊：不要用會互相覆蓋的 position:absolute 來排版主要內容。請優先使用 flexbox 或 grid，元素之間用 gap / margin 預留足夠空間。標籤（例如棒形圖上的名稱與數值）必須各自佔有獨立空間，不可疊在一起或被裁切。
11. 內容要能自適應不同尺寸：使用相對單位（%、rem、clamp()、min()、max()）與 flex-wrap，避免固定寬高造成在小視窗溢出或在全螢幕時出現大片空白。文字過長時要能換行，容器要 overflow 安全。
12. 全螢幕支援：在介面右上角放一個「全螢幕 / 離開全螢幕」按鈕，使用 Fullscreen API（document.documentElement.requestFullscreen() 與 document.exitFullscreen()），並監聽 fullscreenchange 更新按鈕文字；若瀏覽器不支援則隱藏該按鈕。全螢幕時版面仍要置中且不重疊。
13. 互動元素（按鈕、輸入框、滑桿）要有足夠的點擊區與間距，不可彼此重疊或貼邊。

請同時提供：
- title：工具名稱
- html：完整 HTML 字串`,
      schema: z.object({
        title: z.string().min(1),
        html: z.string().min(1),
      }),
      messages,
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "math",
        topic: "tool-generator",
        modelName: HTML_GEN_DEPLOYMENT,
        endpoint: "/api/generate-html",
        usage: result.usage,
      });
    });

    return Response.json({
      title: result.object.title.trim(),
      html: ensureHtmlDocument(result.object.html),
    });
  } catch (error) {
    // Surface as much Azure detail as possible to diagnose 500s (wrong
    // deployment name, unsupported api-version, auth, etc.).
    const err = error as {
      message?: string;
      name?: string;
      statusCode?: number;
      url?: string;
      responseBody?: string;
      data?: unknown;
    };
    console.error("[generate-html] Error:", {
      name: err?.name,
      message: err?.message,
      statusCode: err?.statusCode,
      url: err?.url,
      responseBody: err?.responseBody,
      deployment: HTML_GEN_DEPLOYMENT,
    });
    return new Response(
      JSON.stringify({
        error: err?.message ?? "Unknown error",
        statusCode: err?.statusCode,
        responseBody: err?.responseBody,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}