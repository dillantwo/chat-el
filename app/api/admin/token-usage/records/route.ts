import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { TokenUsage } from "@/models/TokenUsage";
import { calculateUsageCost } from "@/lib/token-cost";
import { SUBJECT_LABELS, ROLE_LABELS } from "@/lib/subjects";
import { resolveTopicKey, topicLabel } from "@/lib/usage-topics";
import {
  buildUsageMatch,
  loadUserDirectory,
  parseUsageFilters,
} from "@/lib/token-usage-query";

const MAX_PAGE_SIZE = 200;

/**
 * GET /api/admin/token-usage/records
 *
 * The raw request log behind the report — one row per LLM call. Accepts the
 * same filters as /api/admin/token-usage, plus `page` and `pageSize`.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const filters = parseUsageFilters(searchParams);

    const pageRaw = Number(searchParams.get("page"));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1;
    const sizeRaw = Number(searchParams.get("pageSize"));
    const pageSize = Number.isFinite(sizeRaw) && sizeRaw > 0
      ? Math.min(Math.trunc(sizeRaw), MAX_PAGE_SIZE)
      : 50;

    const directory = await loadUserDirectory();
    const match = buildUsageMatch(filters, directory);

    const [total, docs] = await Promise.all([
      TokenUsage.countDocuments(match),
      TokenUsage.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const records = docs.map((d) => {
      const cost = calculateUsageCost({
        modelName: d.modelName,
        promptTokens: d.promptTokens,
        cachedInputTokens: d.cachedInputTokens,
        completionTokens: d.completionTokens,
      });
      const live = directory.get(d.userId);
      const topicKey = resolveTopicKey({
        topic: d.topic,
        endpoint: d.endpoint,
        subject: d.subject,
      });
      const role = live?.role ?? d.role ?? "student";

      return {
        id: String(d._id),
        createdAt: d.createdAt,
        userId: d.userId,
        username: live?.username ?? d.username,
        displayName: live?.displayName ?? d.displayName ?? d.username,
        role,
        roleLabel: ROLE_LABELS[role] ?? role,
        schoolId: live?.schoolId ?? d.schoolId ?? null,
        schoolName: live?.schoolName ?? d.schoolName ?? null,
        subject: d.subject,
        subjectLabel: SUBJECT_LABELS[d.subject] ?? d.subject,
        topic: topicKey,
        topicLabel: topicLabel(topicKey),
        modelName: d.modelName,
        endpoint: d.endpoint,
        nonCachedInputTokens: cost.nonCachedInputTokens,
        cachedInputTokens: cost.cachedInputTokens,
        inputTokens: cost.nonCachedInputTokens + cost.cachedInputTokens,
        completionTokens: cost.outputTokens,
        totalTokens: d.totalTokens ?? 0,
        ragTokens: d.ragTokens ?? 0,
        cost: cost.totalCost,
      };
    });

    return NextResponse.json({
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      records,
    });
  } catch (err) {
    console.error("[admin/token-usage/records:GET]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
