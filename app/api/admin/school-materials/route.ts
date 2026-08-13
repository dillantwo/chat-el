import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { SchoolMaterialLayout, type IMaterialGroup } from "@/models/SchoolMaterialLayout";
import { LearningMaterial } from "@/models/LearningMaterial";
import { School } from "@/models/School";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

export const runtime = "nodejs";

interface ResolvedMaterial {
  id: string;
  title: string;
  description: string;
  audience: string;
  filename: string;
  size: number;
}

// GET /api/admin/school-materials?school=<id>&subject=english
// Returns the school's groups for a subject, with each material resolved to its
// metadata (dropping any dangling ids). Also returns the full pool for the
// subject so the editor can offer resources to add.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const school = (searchParams.get("school") ?? "").trim();
  const subject = (searchParams.get("subject") ?? "").trim();

  if (!mongoose.Types.ObjectId.isValid(school)) {
    return NextResponse.json({ error: "學校無效" }, { status: 400 });
  }
  if (!ALL_SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "科目無效" }, { status: 400 });
  }

  await connectDB();

  const [layout, poolDocs] = await Promise.all([
    SchoolMaterialLayout.findOne({ school, subject }).lean(),
    LearningMaterial.find({ subject })
      .select({ title: 1, description: 1, audience: 1, filename: 1, size: 1 })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const pool: ResolvedMaterial[] = poolDocs.map((d) => ({
    id: String(d._id),
    title: d.title,
    description: d.description ?? "",
    audience: d.audience,
    filename: d.filename,
    size: d.size,
  }));
  const poolMap = new Map(pool.map((p) => [p.id, p]));

  const groups = (layout?.groups ?? []).map((g: IMaterialGroup) => ({
    name: g.name,
    materials: (g.materials ?? [])
      .map((mid) => poolMap.get(String(mid)))
      .filter((m): m is ResolvedMaterial => Boolean(m)),
  }));

  return NextResponse.json({ groups, pool });
}

// PUT /api/admin/school-materials — replace a school's layout for a subject.
// Body: { school, subject, groups: [{ name, materialIds: string[] }] }
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const school = (body.school ?? "").toString().trim();
    const subject = (body.subject ?? "").toString().trim();

    if (!mongoose.Types.ObjectId.isValid(school)) {
      return NextResponse.json({ error: "學校無效" }, { status: 400 });
    }
    if (!ALL_SUBJECTS.includes(subject as Subject)) {
      return NextResponse.json({ error: "科目無效" }, { status: 400 });
    }

    await connectDB();

    const schoolDoc = await School.findById(school).select({ _id: 1 }).lean();
    if (!schoolDoc) {
      return NextResponse.json({ error: "學校不存在" }, { status: 400 });
    }

    // Only keep material ids that exist in the pool for this subject.
    const validIds = new Set(
      (await LearningMaterial.find({ subject }).select({ _id: 1 }).lean()).map((d) =>
        String(d._id)
      )
    );

    const rawGroups = Array.isArray(body.groups) ? body.groups : [];
    const groups: IMaterialGroup[] = rawGroups
      .map((g: { name?: unknown; materialIds?: unknown }) => {
        const name = (g?.name ?? "").toString().trim();
        const ids = Array.isArray(g?.materialIds) ? g.materialIds : [];
        const materials = ids
          .map((x: unknown) => String(x))
          .filter((x: string) => validIds.has(x))
          .map((x: string) => new mongoose.Types.ObjectId(x));
        return { name, materials };
      })
      .filter((g: IMaterialGroup) => g.name.length > 0);

    await SchoolMaterialLayout.findOneAndUpdate(
      { school, subject },
      { $set: { groups } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/school-materials:PUT]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
