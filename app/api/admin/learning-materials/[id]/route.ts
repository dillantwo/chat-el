import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { LearningMaterial, MATERIAL_AUDIENCES, type MaterialAudience } from "@/models/LearningMaterial";
import { SchoolMaterialLayout } from "@/models/SchoolMaterialLayout";
import { MaterialTemplate } from "@/models/MaterialTemplate";
import { deleteMaterialFile } from "@/lib/gridfs";

export const runtime = "nodejs";

// PATCH /api/admin/learning-materials/[id] — update metadata (not the file).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    await connectDB();

    const material = await LearningMaterial.findById(id);
    if (!material) {
      return NextResponse.json({ error: "找不到教材" }, { status: 404 });
    }

    if (typeof body.title === "string" && body.title.trim()) {
      material.title = body.title.trim();
    }
    if (typeof body.description === "string") {
      material.description = body.description.trim();
    }
    if (
      typeof body.audience === "string" &&
      MATERIAL_AUDIENCES.includes(body.audience as MaterialAudience)
    ) {
      material.audience = body.audience as MaterialAudience;
    }

    await material.save();
    const obj = material.toObject();

    return NextResponse.json({
      id: String(obj._id),
      subject: obj.subject,
      title: obj.title,
      description: obj.description ?? "",
      audience: obj.audience,
      filename: obj.filename,
      contentType: obj.contentType,
      size: obj.size,
      createdAt: obj.createdAt,
    });
  } catch (err) {
    console.error("[admin/learning-materials/[id]:PATCH]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/learning-materials/[id] — remove metadata + GridFS file,
// and pull the reference out of every school layout that used it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const material = await LearningMaterial.findById(id);
    if (!material) {
      return NextResponse.json({ error: "找不到教材" }, { status: 404 });
    }

    await deleteMaterialFile(material.fileId);
    await material.deleteOne();

    // Remove this material from any school group and from the subject template
    // that referenced it, so a later template sync cannot resurrect the id.
    await Promise.all([
      SchoolMaterialLayout.updateMany(
        { "groups.materials": material._id },
        { $pull: { "groups.$[].materials": material._id } }
      ),
      MaterialTemplate.updateMany(
        { "groups.materials": material._id },
        { $pull: { "groups.$[].materials": material._id } }
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/learning-materials/[id]:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
