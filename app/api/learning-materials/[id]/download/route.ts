import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { LearningMaterial, type MaterialAudience } from "@/models/LearningMaterial";
import { MaterialTemplate } from "@/models/MaterialTemplate";
import { openMaterialDownloadStream } from "@/lib/gridfs";
import { isAudienceAllowed } from "@/lib/material-access";
import { canAccessTopic } from "@/lib/subject-access";

export const runtime = "nodejs";

/** Convert a Node async-iterable stream into a Web ReadableStream. */
function toWebStream(nodeStream: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = nodeStream[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

// GET /api/learning-materials/[id]/download — stream the file if allowed.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登錄" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "找不到教材" }, { status: 404 });
  }

  await connectDB();
  const material = await LearningMaterial.findById(id)
    .select({ fileId: 1, filename: 1, contentType: 1, size: 1, audience: 1, subject: 1 })
    .lean();

  if (!material) {
    return NextResponse.json({ error: "找不到教材" }, { status: 404 });
  }

  // Non-admins: must own the subject, the audience must match, and the material
  // must appear in the template that applies to their school for this subject.
  if (session.role !== "admin") {
    if (!(await canAccessTopic(material.subject, "learning-materials"))) {
      return NextResponse.json({ error: "無權存取" }, { status: 403 });
    }
    if (!isAudienceAllowed(session.role, material.audience as MaterialAudience)) {
      return NextResponse.json({ error: "無權存取" }, { status: 403 });
    }
    if (!session.schoolId) {
      return NextResponse.json({ error: "無權存取" }, { status: 403 });
    }
    const assigned = await MaterialTemplate.exists({
      subject: material.subject,
      schools: session.schoolId,
      "groups.materials": material._id,
    });
    if (!assigned) {
      return NextResponse.json({ error: "無權存取" }, { status: 403 });
    }
  }

  const downloadStream = await openMaterialDownloadStream(
    material.fileId as mongoose.Types.ObjectId
  );

  const encodedName = encodeURIComponent(material.filename).replace(/['()]/g, escape);

  return new Response(toWebStream(downloadStream), {
    status: 200,
    headers: {
      "Content-Type": material.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(material.size ?? ""),
      "Cache-Control": "private, no-store",
    },
  });
}
