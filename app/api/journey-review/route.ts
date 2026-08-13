import { azure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import { z } from "zod";
import { requireMathToolApi } from "@/lib/toolbox-access";

const reviewSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("整體百分比分數"),
  summary: z.string().describe("繁體中文整體回饋，2 至 4 句"),
  segments: z.array(
    z.object({
      segmentId: z.string(),
      isCorrect: z.boolean(),
      score: z.number().min(0).max(100),
      feedback: z.string().describe("給學生的繁體中文回饋，指出做得好或需改善之處"),
      correctDescription: z.string().describe("該段正確描述，繁體中文"),
      extractedJourney: z.object({
        motion: z.enum(["away", "toward", "stationary", "unknown"]).describe("學生描述中的移動方向：遠離原點、接近原點、停留或未知"),
        startTimeSeconds: z.number().nullable().describe("學生明確寫出的起始時間；沒有就 null"),
        endTimeSeconds: z.number().nullable().describe("學生明確寫出的結束時間；沒有就 null"),
        durationSeconds: z.number().nullable().describe("學生明確寫出的經過時間；沒有就 null"),
        startDistanceMeters: z.number().nullable().describe("學生明確寫出的起始距離；沒有就 null"),
        endDistanceMeters: z.number().nullable().describe("學生明確寫出的最後距離或到達距離；沒有就 null"),
        travelledDistanceMeters: z.number().nullable().describe("學生明確寫出的這段行走/移動距離；沒有就 null。若學生寫速度和時間，可計算路程"),
        speedMetersPerSecond: z.number().nullable().describe("學生明確寫出的速度；沒有就 null"),
        confidence: z.number().min(0).max(1).describe("提取參數的信心，0 至 1"),
      }),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const denied = await requireMathToolApi("journey-graph");
    if (denied) return denied;

    const body = (await req.json()) as {
      levelTitle?: string;
      chartTitle?: string;
      segments?: Array<{
        id: string;
        label: string;
        studentAnswer: string;
        expectedDescription: string;
        mustInclude: string[];
        originalStart?: { x: number; y: number };
        originalEnd?: { x: number; y: number };
      }>;
    };

    const segments = body.segments ?? [];
    if (segments.length === 0) {
      return Response.json({ overallScore: 0, summary: "沒有可檢查的答案。", segments: [] });
    }

    const result = await generateObject({
      model: azure(process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o"),
      schema: reviewSchema,
      system: `你是一位小學數學老師，正在批改學生對「距離-時間行程圖」全部段落的描述。

判斷規則：
- 逐段評核，不要求逐字相同，只要數學意思正確即可。
- 每段需描述時間、距離變化方向、是否停留，以及速度/距離變化是否合理。
- 如果學生能說出核心運動狀態但缺少數值，可給 70-85。
- 如果學生數值錯、方向錯、或把停留說成移動，需扣分並清楚提示。
- 如果學生空白或離題，該段給 0-30。
- 整體分數是各段理解程度的平均，不需要過度嚴苛。
- 同時從學生答案提取畫圖用的結構化參數 extractedJourney。
- extractedJourney 只根據學生答案提取，不要用標準描述或原圖數值代替學生沒有寫出的數值。
- 如果學生寫「用了/走了/靜止了 3 秒」，durationSeconds=3。
- 如果學生寫「0 至 3 秒」或「由 0 秒到 3 秒」，startTimeSeconds=0，endTimeSeconds=3，durationSeconds=3。
- 如果學生寫「到/達/距離是 40 公尺」，endDistanceMeters=40。
- 如果學生寫「走了/移動了 40 公尺」，travelledDistanceMeters=40。
- 如果學生寫「每秒 6 公尺走了 5 秒」，speedMetersPerSecond=6，durationSeconds=5，travelledDistanceMeters=30。
- 如果學生寫停留/靜止/不動，motion="stationary"。
- 如果學生寫遠離/出發/增加，motion="away"；寫返回/回去/接近/減少，motion="toward"。
- 沒有明確數值就填 null；不要猜。
- 所有回饋必須使用繁體中文，語氣鼓勵，適合小學生。`,
      prompt: `關卡：${body.levelTitle ?? "行程圖"}
圖表：${body.chartTitle ?? "距離-時間圖"}

請批改以下全部段落，務必回傳每個 segmentId 的結果：
${segments
  .map(
    (segment, index) => `
${index + 1}. segmentId=${segment.id}
段落=${segment.label}
學生答案=${segment.studentAnswer || "（空白）"}
原圖起點=${segment.originalStart ? `(${segment.originalStart.x}, ${segment.originalStart.y})` : "未知"}
原圖終點=${segment.originalEnd ? `(${segment.originalEnd.x}, ${segment.originalEnd.y})` : "未知"}
標準描述=${segment.expectedDescription}
必須包含重點=${segment.mustInclude.join("、")}`
  )
  .join("\n")}`,
    });

    const seen = new Set(result.object.segments.map((segment) => segment.segmentId));
    const filledSegments = [
      ...result.object.segments,
      ...segments
        .filter((segment) => !seen.has(segment.id))
        .map((segment) => ({
          segmentId: segment.id,
          isCorrect: false,
          score: 0,
          feedback: "這一段暫時未能取得 AI 回饋，請再檢查描述是否完整。",
          correctDescription: segment.expectedDescription,
          extractedJourney: emptyExtractedJourney(),
        })),
    ];

    return Response.json({ ...result.object, segments: filledSegments });
  } catch (error) {
    console.error("[journey-review] Error:", error);
    return Response.json(
      { overallScore: 0, summary: "暫時未能連接 AI 檢查，請稍後再試。", segments: [] },
      { status: 500 }
    );
  }
}

function emptyExtractedJourney() {
  return {
    motion: "unknown" as const,
    startTimeSeconds: null,
    endTimeSeconds: null,
    durationSeconds: null,
    startDistanceMeters: null,
    endDistanceMeters: null,
    travelledDistanceMeters: null,
    speedMetersPerSecond: null,
    confidence: 0,
  };
}