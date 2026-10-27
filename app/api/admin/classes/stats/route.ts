import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/classes/stats?school=<id> — distinct teacher/student head-counts.
//
// Counted per user rather than summed from the per-class columns: a teacher
// usually teaches several classes and a student can sit in more than one, so
// adding up the table would count the same person several times.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const school = req.nextUrl.searchParams.get("school");
  if (school && !mongoose.isValidObjectId(school)) {
    return NextResponse.json({ error: "學校 ID 無效" }, { status: 400 });
  }

  await connectDB();

  const match: Record<string, unknown> = { role: { $in: ["teacher", "student"] } };
  if (school) match.school = new mongoose.Types.ObjectId(school);

  const grouped = await User.aggregate<{ _id: string; count: number }>([
    { $match: match },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);

  const byRole = new Map(grouped.map((g) => [g._id, g.count]));
  return NextResponse.json({
    teachers: byRole.get("teacher") ?? 0,
    students: byRole.get("student") ?? 0,
  });
}
