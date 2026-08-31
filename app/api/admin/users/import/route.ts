import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { commitUserImport, planUserImport } from "@/lib/user-import";
import type { AuthProvider, UserRole } from "@/models/User";

export const runtime = "nodejs";

/**
 * POST /api/admin/users/import — bulk-create accounts from a roster.
 *
 * Body:
 *   text            the pasted roster, tab- or comma-delimited, header row required
 *   schoolId        the school every row belongs to
 *   academicYear    the year used to resolve class names, e.g. "2025-2026"
 *   defaultRole     "student" | "teacher", applied where a row states none
 *   accountType     "local" (password) | "edconnect" (EdCity), for the whole file
 *   defaultPassword password accounts only, used for rows with no password cell
 *   dryRun          true to validate only (default), false to write
 *
 * School, academic year and account type are request-level rather than per-row on
 * purpose: a class is only unique within (school, academicYear), so a bare "6A"
 * in a spreadsheet is ambiguous, and one import is one school's roster for one
 * year in every real case. It also means the school-boundary rule is enforced
 * once here instead of per row.
 *
 * dryRun defaults to true so that a caller that forgets the flag previews rather
 * than writes.
 *
 * The response is the plan, which never contains a password: plaintext lives in
 * a separate map that goes straight from `planUserImport` to `commitUserImport`.
 * That also means the preview and the commit each parse the passwords once, in
 * the same request that uses them, so nothing has to be held between calls.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const text = typeof body.text === "string" ? body.text : "";
    const schoolId = (body.schoolId ?? "").toString().trim();
    const academicYear = (body.academicYear ?? "").toString().trim();
    const defaultRole: UserRole = body.defaultRole === "teacher" ? "teacher" : "student";
    // Defaults to "edconnect": that is what this endpoint did before password
    // imports existed, so an older caller keeps its behaviour rather than
    // silently switching to accounts that need a password it never sent.
    const accountType: AuthProvider = body.accountType === "local" ? "local" : "edconnect";
    const defaultPassword =
      typeof body.defaultPassword === "string" ? body.defaultPassword : "";
    const dryRun = body.dryRun !== false;

    if (!schoolId) {
      return NextResponse.json({ error: "請選擇學校" }, { status: 400 });
    }

    await connectDB();

    const planned = await planUserImport({
      text,
      schoolId,
      academicYear,
      defaultRole,
      accountType,
      defaultPassword,
    });
    if (!planned.ok) {
      return NextResponse.json({ error: planned.error }, { status: 400 });
    }

    if (dryRun) {
      return NextResponse.json(planned.plan);
    }

    // Nothing to do is not an error, but say so explicitly rather than
    // reporting a successful import of zero accounts.
    if (planned.plan.summary.create === 0) {
      return NextResponse.json(
        { error: "沒有可新增的資料，請先修正錯誤的資料列" },
        { status: 400 }
      );
    }

    const committed = await commitUserImport(planned.plan, planned.passwords);
    return NextResponse.json(committed);
  } catch (err) {
    console.error("[admin/users/import:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
