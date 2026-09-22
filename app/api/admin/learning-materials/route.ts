import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { LearningMaterial, MATERIAL_AUDIENCES, type MaterialAudience } from "@/models/LearningMaterial";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import { uploadMaterialFile, deleteMaterialFile } from "@/lib/gridfs";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { parseLinkUrl, serializeMaterial } from "@/lib/learning-materials";

export const runtime = "nodejs";

/** The fields a file and a link resource have in common. `null` when they pass. */
function commonFieldError(subject: string, title: string, audience: string): string | null {
  if (!ALL_SUBJECTS.includes(subject as Subject)) return "科目無效";
  if (!title) return "標題不能為空";
  if (!MATERIAL_AUDIENCES.includes(audience as MaterialAudience)) return "對象無效";
  return null;
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
  return NextResponse.json(docs.map(serializeMaterial));
}

/**
 * POST /api/admin/learning-materials — add a resource to the pool.
 *
 * Two transports, because the two kinds carry different things: a file has to be
 * multipart/form-data, while a link is just metadata and is posted as JSON like
 * the rest of the admin API. The content type picks the branch rather than a
 * `kind` field, so a JSON body can never be read as if it held a file.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    return createLink(req, session.userId);
  }
  return createFile(req, session.userId);
}

/** Body: { subject, title, description?, audience?, url } */
async function createLink(req: NextRequest, userId: string) {
  try {
    const body = await req.json();
    const subject = (body.subject ?? "").toString().trim();
    const title = (body.title ?? "").toString().trim();
    const description = (body.description ?? "").toString().trim();
    const audience = (body.audience ?? "both").toString().trim();

    const invalid = commonFieldError(subject, title, audience);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const link = parseLinkUrl((body.url ?? "").toString());
    if (!link.ok) {
      return NextResponse.json({ error: link.error }, { status: 400 });
    }

    await connectDB();

    const doc = await LearningMaterial.create({
      subject,
      title,
      description,
      audience,
      kind: "link",
      url: link.url,
      // A link has no file half. Stored empty rather than left unset so the
      // serialized shape is the same for both kinds.
      filename: "",
      contentType: "",
      size: 0,
      uploadedBy: userId,
    });

    return NextResponse.json(serializeMaterial(doc.toObject()), { status: 201 });
  } catch (err) {
    console.error("[admin/learning-materials:POST link]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

/** Multipart fields: file, subject, title, description, audience */
async function createFile(req: NextRequest, userId: string) {
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

    const invalid = commonFieldError(subject, title, audience);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
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
      kind: "file",
      fileId,
      filename: file.name,
      contentType,
      size: file.size,
      uploadedBy: userId,
    });

    return NextResponse.json(serializeMaterial(doc.toObject()), { status: 201 });
  } catch (err) {
    // Roll back the orphaned GridFS file if metadata creation failed.
    if (fileId) await deleteMaterialFile(fileId);
    console.error("[admin/learning-materials:POST file]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
