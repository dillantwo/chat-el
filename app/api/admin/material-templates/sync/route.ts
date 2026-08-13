import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { MaterialTemplate } from "@/models/MaterialTemplate";
import { SchoolMaterialLayout } from "@/models/SchoolMaterialLayout";
import { School } from "@/models/School";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

export const runtime = "nodejs";

// POST /api/admin/material-templates/sync — copy the subject's template layout
// into every school's layout for that subject (replacing their groups).
// Body: { subject }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const subject = (body.subject ?? "").toString().trim();

    if (!ALL_SUBJECTS.includes(subject as Subject)) {
      return NextResponse.json({ error: "科目無效" }, { status: 400 });
    }

    await connectDB();

    const template = await MaterialTemplate.findOne({ subject }).lean();
    const groups = template?.groups ?? [];

    const schools = await School.find().select({ _id: 1 }).lean();
    if (schools.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    await Promise.all(
      schools.map((s) =>
        SchoolMaterialLayout.findOneAndUpdate(
          { school: s._id, subject },
          // Deep-clone group objects so each school gets its own copy.
          { $set: { groups: groups.map((g) => ({ name: g.name, materials: [...g.materials] })) } },
          { upsert: true, new: true }
        )
      )
    );

    return NextResponse.json({ synced: schools.length });
  } catch (err) {
    console.error("[admin/material-templates/sync:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
