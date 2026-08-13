import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { School } from "@/models/School";
import {
  buildUsageReport,
  loadUserDirectory,
  parseUsageFilters,
} from "@/lib/token-usage-query";

/**
 * GET /api/admin/token-usage
 *
 * Token usage report, broken down by school, subject, topic, model and user.
 *
 * Query params (all optional):
 *   from, to   ISO date / datetime. Defaults to the last 30 days.
 *   school     School id, or "none" for users without a school.
 *   subject    math | chinese | english | science | humanities
 *   topic      topic key (see lib/usage-topics.ts)
 *   user       a single user id to drill into
 *   role       admin | teacher | student
 *   q          search on username / display name
 *   userLimit  max rows in the per-student breakdown (default 200, max 1000)
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const filters = parseUsageFilters(searchParams);

    const userLimitRaw = Number(searchParams.get("userLimit"));
    const userLimit = Number.isFinite(userLimitRaw) && userLimitRaw > 0
      ? Math.min(Math.trunc(userLimitRaw), 1000)
      : 200;

    const [directory, schools] = await Promise.all([
      loadUserDirectory(),
      School.find().select("name code").sort({ name: 1 }).lean(),
    ]);

    const report = await buildUsageReport(filters, directory, { userLimit });

    return NextResponse.json({
      ...report,
      schools: schools.map((s) => ({ id: String(s._id), name: s.name, code: s.code })),
    });
  } catch (err) {
    console.error("[admin/token-usage:GET]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
