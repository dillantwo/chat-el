import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { requireSubjectApi } from "@/lib/subject-access";

const schema = z.object({
  annotations: z.array(
    z.object({
      word: z.string().describe("虛詞原文（單字）"),
      position: z.number().describe("該虛詞在原文中的索引編號（方括號內的數字）"),
      partOfSpeech: z.string().describe("詞性，例如：介詞、連詞、助詞、語氣詞"),
      meaning: z.string().describe("在該句子語境下的具體意思"),
    })
  ),
});

export async function POST(req: Request) {
  const denied = await requireSubjectApi("chinese");
  if (denied) return denied;

  const { text } = (await req.json()) as { text: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "請輸入文言文內容" }, { status: 400 });
  }

  // Number each character so the LLM can reference positions accurately
  const chars = Array.from(text.trim());
  const numberedText = chars.map((ch, i) => `${ch}[${i}]`).join("");

  const result = await generateObject({
    model: azure(process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o"),
    schema,
    prompt: `你是一位文言文虛詞專家。以下文言文中每個字後面的方括號數字是該字的索引編號。請逐一找出每個虛詞的每次出現，並為每次出現單獨標注。

虛詞包括但不限於：之、乎、者、也、矣、焉、哉、耶、與、歟、邪、為、所、以、其、則、而、且、雖、然、於、乃、即、遂、因、故、若、如、猶、況、蓋、夫、惟、既、莫、非、未、不、無、勿、毋、豈、何、安、孰、誰、奚、胡、曷、盍等。

重要規則：
1. 每個虛詞的每次出現都必須單獨一條 annotation，即使是相同的字
2. position 使用方括號內的數字
3. 每條 annotation 的 meaning 必須根據該字所在句子的上下文來解釋，不可以用相同的通用解釋
4. 例如「所」在「我所欲」中表示「……的（東西）」，但在「故患有所不辟」中表示「……的（情況）」，含義不同
5. 請仔細分析每個虛詞在其所在句子中的具體用法和意思

帶編號原文：
${numberedText}`,
  });

  // Validate positions and group by (word + meaning) for the frontend
  const maxIdx = chars.length - 1;
  const grouped = new Map<string, { word: string; positions: number[]; partOfSpeech: string; meaning: string }>();

  for (const ann of result.object.annotations) {
    const pos = ann.position;
    if (pos < 0 || pos > maxIdx || chars[pos] !== ann.word) continue;

    const key = `${ann.word}|||${ann.partOfSpeech}|||${ann.meaning}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.positions.includes(pos)) existing.positions.push(pos);
    } else {
      grouped.set(key, {
        word: ann.word,
        positions: [pos],
        partOfSpeech: ann.partOfSpeech,
        meaning: ann.meaning,
      });
    }
  }

  return Response.json({ annotations: Array.from(grouped.values()) });
}
