import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { MaterialTemplate } from "@/models/MaterialTemplate";
import { type IMaterialGroup } from "@/models/SchoolMaterialLayout";
import { LearningMaterial } from "@/models/LearningMaterial";
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

// GET /api/admin/material-templates?subject=english
// Same response shape as /api/admin/school-materials: { groups, pool }.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const subject = (req.nextUrl.searchParams.get("subject") ?? "").trim();
  if (!ALL_SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "科目無效" }, { status: 400 });
  }

  await connectDB();

  const [template, poolDocs] = await Promise.all([
    MaterialTemplate.findOne({ subject }).lean(),
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

  const groups = (template?.groups ?? []).map((g: IMaterialGroup) => ({
    name: g.name,
    materials: (g.materials ?? [])
      .map((mid) => poolMap.get(String(mid)))
      .filter((m): m is ResolvedMaterial => Boolean(m)),
  }));

  return NextResponse.json({ groups, pool });
}

// PUT /api/admin/material-templates — replace the template for a subject.
// Body: { subject, groups: [{ name, materialIds: string[] }] }
export async function PUT(req: NextRequest) {
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

    await MaterialTemplate.findOneAndUpdate(
      { subject },
      { $set: { groups } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/material-templates:PUT]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
