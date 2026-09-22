import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { LearningMaterial, MATERIAL_AUDIENCES, type MaterialAudience } from "@/models/LearningMaterial";
import { MaterialTemplate } from "@/models/MaterialTemplate";
import { deleteMaterialFile } from "@/lib/gridfs";
import { parseLinkUrl, serializeMaterial } from "@/lib/learning-materials";

export const runtime = "nodejs";

// PATCH /api/admin/learning-materials/[id] — update metadata.
// An uploaded file is immutable (delete and re-upload to replace it), but a
// link's url can be corrected in place: that is the whole point of keeping links
// in the pool, since the same link may be assigned to several templates.
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
    if (typeof body.url === "string") {
      if (material.kind !== "link") {
        return NextResponse.json({ error: "檔案資源沒有連結網址" }, { status: 400 });
      }
      const link = parseLinkUrl(body.url);
      if (!link.ok) {
        return NextResponse.json({ error: link.error }, { status: 400 });
      }
      material.url = link.url;
    }

    await material.save();

    return NextResponse.json(serializeMaterial(material.toObject()));
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

    // Links have no stored bytes; everything else about deleting them is the same.
    if (material.fileId) {
      await deleteMaterialFile(material.fileId);
    }
    await material.deleteOne();

    // Drop the material from every template group that referenced it. The groups
    // are what the schools read directly, so leaving the id behind would show a
    // dead row on their 學習資源 page.
    await MaterialTemplate.updateMany(
      { "groups.materials": material._id },
      { $pull: { "groups.$[].materials": material._id } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/learning-materials/[id]:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
