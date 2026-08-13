import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { TokenUsage } from "@/models/TokenUsage";
import { calculateUsageCost } from "@/lib/token-cost";
import { SUBJECT_LABELS, ROLE_LABELS } from "@/lib/subjects";
import { resolveTopicKey, topicLabel } from "@/lib/usage-topics";
import {
  buildUsageMatch,
  buildUsageReport,
  loadUserDirectory,
  parseUsageFilters,
  type UsageRow,
} from "@/lib/token-usage-query";

/** Hard cap so an unbounded date range can't exhaust memory. */
const MAX_RECORDS = 50_000;

type ExportType = "records" | "school" | "subject" | "topic" | "user";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // Prepend a BOM so Excel opens the Chinese headers as UTF-8.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

const money = (n: number) => n.toFixed(6);

function summaryRows(rows: UsageRow[]): unknown[][] {
  return rows.map((r) => [
    r.label,
    r.sublabel ?? "",
    r.requests,
    r.userCount,
    r.inputTokens,
    r.cachedInputTokens,
    r.completionTokens,
    r.ragTokens,
    r.totalTokens,
    money(r.cost),
    `${(r.costShare * 100).toFixed(2)}%`,
    r.lastUsedAt ?? "",
  ]);
}

const SUMMARY_HEADER = [
  "名稱",
  "分類",
  "請求數",
  "使用人數",
  "輸入 tokens",
  "其中快取 tokens",
  "輸出 tokens",
  "RAG tokens",
  "總 tokens",
  "估算成本 (USD)",
  "成本佔比",
  "最後使用時間",
];

/**
 * GET /api/admin/token-usage/export?type=records|school|subject|topic|user
 *
 * CSV export of the current report. Accepts the same filters as
 * /api/admin/token-usage.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const filters = parseUsageFilters(searchParams);
    const type = (searchParams.get("type") ?? "records") as ExportType;

    const directory = await loadUserDirectory();

    let csv: string;
    let name: string;

    if (type === "records") {
      const docs = await TokenUsage.find(buildUsageMatch(filters, directory))
        .sort({ createdAt: -1 })
        .limit(MAX_RECORDS)
        .lean();

      csv = toCsv(
        [
          "時間",
          "學校",
          "姓名",
          "用戶名",
          "角色",
          "科目",
          "主題",
          "模型",
          "端點",
          "輸入 tokens",
          "其中快取 tokens",
          "輸出 tokens",
          "RAG tokens",
          "總 tokens",
          "估算成本 (USD)",
        ],
        docs.map((d) => {
          const cost = calculateUsageCost({
            modelName: d.modelName,
            promptTokens: d.promptTokens,
            cachedInputTokens: d.cachedInputTokens,
            completionTokens: d.completionTokens,
          });
          const live = directory.get(d.userId);
          const role = live?.role ?? d.role ?? "student";
          const topicKey = resolveTopicKey({
            topic: d.topic,
            endpoint: d.endpoint,
            subject: d.subject,
          });
          return [
            d.createdAt?.toISOString() ?? "",
            live?.schoolName ?? d.schoolName ?? "",
            live?.displayName ?? d.displayName ?? "",
            live?.username ?? d.username,
            ROLE_LABELS[role] ?? role,
            SUBJECT_LABELS[d.subject] ?? d.subject,
            topicLabel(topicKey),
            d.modelName,
            d.endpoint,
            cost.nonCachedInputTokens + cost.cachedInputTokens,
            cost.cachedInputTokens,
            cost.outputTokens,
            d.ragTokens ?? 0,
            d.totalTokens ?? 0,
            money(cost.totalCost),
          ];
        }),
      );
      name = "token-usage-records";
    } else {
      const report = await buildUsageReport(filters, directory, { userLimit: 100_000 });

      if (type === "user") {
        csv = toCsv(
          [
            "姓名",
            "用戶名",
            "角色",
            "學校",
            "科目",
            "主題數",
            "請求數",
            "輸入 tokens",
            "其中快取 tokens",
            "輸出 tokens",
            "RAG tokens",
            "總 tokens",
            "估算成本 (USD)",
            "成本佔比",
            "最後使用時間",
          ],
          report.byUser.map((u) => [
            u.displayName,
            u.username,
            u.roleLabel,
            u.schoolName ?? "",
            u.subjects.join(" / "),
            u.topicCount,
            u.requests,
            u.inputTokens,
            u.cachedInputTokens,
            u.completionTokens,
            u.ragTokens,
            u.totalTokens,
            money(u.cost),
            `${(u.costShare * 100).toFixed(2)}%`,
            u.lastUsedAt ?? "",
          ]),
        );
        name = "token-usage-by-student";
      } else {
        const rows =
          type === "school"
            ? report.bySchool
            : type === "subject"
              ? report.bySubject
              : report.byTopic;
        csv = toCsv(SUMMARY_HEADER, summaryRows(rows));
        name = `token-usage-by-${type}`;
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin/token-usage/export:GET]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
