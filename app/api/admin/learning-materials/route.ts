import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { LearningMaterial, MATERIAL_AUDIENCES, type MaterialAudience } from "@/models/LearningMaterial";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import { uploadMaterialFile, deleteMaterialFile } from "@/lib/gridfs";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

export const runtime = "nodejs";

function serialize(doc: {
  _id: unknown;
  subject: string;
  title: string;
  description?: string;
  audience: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: Date;
}) {
  return {
    id: String(doc._id),
    subject: doc.subject,
    title: doc.title,
    description: doc.description ?? "",
    audience: doc.audience,
    filename: doc.filename,
    contentType: doc.contentType,
    size: doc.size,
    createdAt: doc.createdAt,
  };
}

// GET /api/admin/learning-materials?subject=english — list pool resources.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  await connectDB();

  const filter: Record<string, unknown> = {};
  const subject = req.nextUrl.searchParams.get("subject");
  if (subject && ALL_SUBJECTS.includes(subject as Subject)) {
    filter.subject = subject;
  }

  const docs = await LearningMaterial.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json(docs.map(serialize));
}

// POST /api/admin/learning-materials — multipart upload of a new pool resource.
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  let fileId: mongoose.Types.ObjectId | null = null;
  try {
    const form = await req.formData();

    const file = form.get("file");
    const subject = (form.get("subject") ?? "").toString().trim();
    const title = (form.get("title") ?? "").toString().trim();
    const description = (form.get("description") ?? "").toString().trim();
    const audience = (form.get("audience") ?? "both").toString().trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "請選擇要上傳的檔案" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `檔案過大（上限 ${MAX_UPLOAD_LABEL}）` },
        { status: 413 },
      );
    }
    if (!ALL_SUBJECTS.includes(subject as Subject)) {
      return NextResponse.json({ error: "科目無效" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "標題不能為空" }, { status: 400 });
    }
    if (!MATERIAL_AUDIENCES.includes(audience as MaterialAudience)) {
      return NextResponse.json({ error: "對象無效" }, { status: 400 });
    }

    await connectDB();

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    fileId = await uploadMaterialFile(buffer, file.name, contentType);

    const doc = await LearningMaterial.create({
      subject,
      title,
      description,
      audience,
      fileId,
      filename: file.name,
      contentType,
      size: file.size,
      uploadedBy: session.userId,
    });

    return NextResponse.json(serialize(doc.toObject()), { status: 201 });
  } catch (err) {
    // Roll back the orphaned GridFS file if metadata creation failed.
    if (fileId) await deleteMaterialFile(fileId);
    console.error("[admin/learning-materials:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
