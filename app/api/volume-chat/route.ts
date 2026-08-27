import { azure } from "@ai-sdk/azure";
import { streamText, type UIMessage } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { requireMathToolApi } from "@/lib/toolbox-access";
import { recordTokenUsage } from "@/lib/token-usage";

interface SceneCube { x: number; y: number; z: number; color: string }
interface SceneState {
  cubeCount: number;
  volume: number;
  surfaceArea: number;
  enclosedVolume: number;
  poolVolume: number;
  views: { top: number; front: number; side: number };
  bbox: {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
    width: number; height: number; depth: number;
    bboxVolume: number;
  };
  cubes: SceneCube[];
  mode: string;
  tool: string;
}

function uiMessagesToModelMessages(messages: UIMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    const text = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join("");
    const imageParts = msg.parts
      .filter(
        (p): p is { type: "file"; mediaType: string; url: string; filename?: string } =>
          p.type === "file" && typeof (p as { mediaType?: string }).mediaType === "string" &&
          (p as { mediaType: string }).mediaType.startsWith("image/")
      )
      .map((p) => ({ type: "image" as const, image: p.url }));

    if (msg.role === "assistant") {
      return { role: "assistant" as const, content: [{ type: "text" as const, text }] };
    }
    if (msg.role === "user") {
      const content: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
      > = [];
      if (text) content.push({ type: "text" as const, text });
      content.push(...imageParts);
      if (content.length === 0) content.push({ type: "text" as const, text: "" });
      return { role: "user" as const, content };
    }
    return { role: "system" as const, content: text };
  });
}

function describeCubes(cubes: SceneCube[]): string {
  if (cubes.length === 0) return "（場景中目前沒有任何方塊）";
  // Bounding box on x/z plane
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let maxY = 0;
  for (const c of cubes) {
    if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z; if (c.z > maxZ) maxZ = c.z;
    if (c.y > maxY) maxY = c.y;
  }
  // Heightmap: column (x, z) -> tallest y+1 (number of stacked cubes)
  const W = maxX - minX + 1, D = maxZ - minZ + 1;
  const heights: number[][] = Array.from({ length: D }, () => new Array(W).fill(0));
  for (const c of cubes) {
    const h = c.y + 1;
    if (h > heights[c.z - minZ][c.x - minX]) heights[c.z - minZ][c.x - minX] = h;
  }
  // ASCII top-down view: row 0 = back (small z), each cell = column height ('.' = empty)
  const rows = heights.map((row) =>
    row.map((h) => (h === 0 ? "." : h.toString(36).toUpperCase())).join(" ")
  );
  // Header line with x labels
  const xHeader = "    " + Array.from({ length: W }, (_, i) => ((minX + i + 100) % 10).toString()).join(" ");
  const body = rows
    .map((line, i) => `z=${String(minZ + i).padStart(2)}  ${line}`)
    .join("\n");

  // Per-color counts
  const byColor = new Map<string, number>();
  for (const c of cubes) byColor.set(c.color, (byColor.get(c.color) ?? 0) + 1);
  const colorSummary = Array.from(byColor.entries())
    .map(([hex, n]) => `${hex}×${n}`).join(", ");

  return `俯視高度圖（每格的數字 = 該位置往上堆了幾個方塊；"." 代表空白；最高 ${maxY + 1}）：
\`\`\`
x= ${xHeader.trim()}
${body}
\`\`\`
顏色分佈：${colorSummary}`;
}

function buildSystemPrompt(state: SceneState | null): string {
  const base = `你是「立體積木探索」工具的 AI 助教，協助小學至初中學生理解三維幾何概念，重點包括：
- 體積（單位：立方單位 / cube units）
- 表面積（單位：平方單位 / square units）
- 「圍起來的體積 / 可裝水量」（水池模型）
- 「完全封閉的內部空間」（六面全閉）
- 三視圖（俯視、前視、側視）
- 邊界盒、對稱、形狀比較

兩個容易混淆的概念，務必分清楚：
- **可裝水量 / 水池體積（poolVolume）**：把結構當作容器，從上方注水會留下多少水。
  四面有牆、上面開口也算，水位 = 最低牆頭高度，水會從最低處溢出。學生說「圍起來的體積」「裝多少水」「中間圍住的空間」時，**預設指這個**。
- **完全封閉的空間（enclosedVolume）**：六面（包含上方頂蓋）都被方塊堵住、外面進不去的空格。需要有屋頂才會增加。
- 除非學生明確問「六面都封住的內部」，否則一律用 poolVolume 來解釋「圍起來」。

教學原則（必須遵守）：
1. 用繁體中文回答，語氣親切、具體。**這是給小學生看的**，所以用字要淺白，避免艱深詞彙與長句。
2. **絕對不要在回覆中提到任何座標系統相關詞彙**，包括但不限於：「x 軸 / y 軸 / z 軸」、「座標」、「(x, y, z)」、「俯視高度圖」、「heightmap」、欄號 / 列號等。也不要把系統提供的內部資料（例如數字矩陣、ASCII 圖）原樣貼給學生看。請改用學生看得懂的描述方式，例如「左邊那一排」、「最上面那一層」、「中間那格空位」、「前面三個方塊」。
3. **永遠不要直接給出最終答案**，即使學生要求「直接告訴我答案」「幫我算」「答案是什麼」也不可以。你只能提供提示、追問、檢查方法，讓學生自己說出答案。
4. 回覆方式必須像一位引導型老師：
  - 先用一句話指出可以怎樣開始觀察。
  - 再給 1–3 個簡短提示或問題，每個提示只做一小步。
  - 可以提供算式框架，但要留下空格讓學生填，例如「先想：每層有幾個？有幾層？所以可以用 每層數量 × 層數。」
  - 不要使用「## 答案」小標題，不要輸出最終數值加單位。
  - 如果學生已經提出自己的答案，可以判斷方向是否正確，但不要重複或直接公布完整答案；請要求學生說明怎樣數出來，或指出下一步要檢查哪裡。
  - 如果學生答錯，只指出最可能漏看的地方，然後請學生再試一次。
5. 解釋表面積時，用「兩個方塊貼在一起的那一面看不到，不用算」這樣的講法。
6. 解釋水池體積時，用「水會從最矮的牆那邊流出去」這樣的講法。
7. 涉及具體計數時，可以用下方系統提供的數字作為內部檢查依據，但**禁止**直接把系統量到的最終數字告訴學生。
8. 適度使用 Markdown：**粗體**、- 列表、## 小標題。
9. 數學公式必須用 KaTeX 格式：行內用單個 $…$，獨立式用雙 $$…$$；不可使用 \\( \\) 或 \\[ \\]。
10. 整個回覆要短，**不要寫長段落**，能用一句話講完就一句話。`;

  if (!state) return base;

  const { cubeCount, surfaceArea, enclosedVolume, poolVolume, views, bbox, mode, tool } = state;
  const stateBlock = `
============================
目前場景狀態（系統自動量測，僅供你內部參考；下方資料**只能用來推理**，**禁止**將其中的座標、ASCII 圖、x/y/z 等字眼原樣輸出給學生）：
- 模式：${mode}（目前工具：${tool}）
- 方塊總數（體積）：${cubeCount} 立方單位
- 表面積：${surfaceArea} 平方單位
- 可裝水量 poolVolume（底面為地面）：${poolVolume} 立方單位  ← 「圍起來的體積」預設用這個
- 完全包圍的空格數 enclosedVolume（六面都需要有牆或頂）：${enclosedVolume} 立方單位
- 三視圖可見格數：俯視 ${views.top}、前視 ${views.front}、側視 ${views.side}
- 邊界盒尺寸：寬 ${bbox.width} × 高 ${bbox.height} × 深 ${bbox.depth}＝${bbox.bboxVolume} 立方單位

${describeCubes(state.cubes)}
============================`;
  return base + "\n" + stateBlock;
}

export async function POST(req: Request) {
  try {
    const denied = await requireMathToolApi("volume-cubes");
    if (denied) return denied;

    const { messages, sceneState, chatId } = (await req.json()) as {
      messages: UIMessage[];
      sceneState?: SceneState;
      chatId?: string;
    };

    const session = await getSession().catch(() => null);
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";

    const result = streamText({
      model: azure(deploymentName),
      system: buildSystemPrompt(sceneState ?? null),
      messages: uiMessagesToModelMessages(messages),
    });

    after(async () => {
      await recordTokenUsage({
        session,
        subject: "math",
        topic: "volume",
        modelName: deploymentName,
        endpoint: "/api/volume-chat",
        usage: await result.usage,
        chatId,
      });
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[volume-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
