import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import {
  effectiveClassIds,
  isSubject,
  jsonError,
  requirePromptAuthor,
  toObjectId,
} from "@/lib/teacher-prompts";
import { TeacherPromptSetting } from "@/models/TeacherPromptSetting";

export const runtime = "nodejs";

// PUT /api/prompts/settings — which classes see the caller's prompts
// in one subject. Applies to every prompt they wrote for it.
// Body: { subject, classIds: string[] | null }
//   - an array saves that choice (it may be empty: no class sees them)
//   - null drops the choice, back to "every class I teach"
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isSubject(body.subject)) return jsonError("科目無效", 400);

  const author = await requirePromptAuthor(body.subject);
  if (!author.ok) return author.response;
  const { teacherId, classIds: ownClassIds } = author.teacher;

  try {
    await connectDB();

    if (body.classIds === null) {
      await TeacherPromptSetting.deleteOne({ teacher: teacherId, subject: body.subject });
      return NextResponse.json({
        visibleClassIds: ownClassIds.map(String),
        classesCustomized: false,
      });
    }

    if (!Array.isArray(body.classIds)) return jsonError("班別無效", 400);

    // Only the teacher's own classes can be chosen; anything else is dropped
    // rather than trusted.
    const requested = (body.classIds as unknown[])
      .map(toObjectId)
      .filter((id): id is mongoose.Types.ObjectId => id !== null);
    const chosen = effectiveClassIds(ownClassIds, requested);

    await TeacherPromptSetting.findOneAndUpdate(
      { teacher: teacherId, subject: body.subject },
      { $set: { classes: chosen } },
      { upsert: true },
    );

    return NextResponse.json({
      visibleClassIds: chosen.map(String),
      classesCustomized: true,
    });
  } catch (err) {
    console.error("[prompts/settings:PUT]", err);
    return jsonError("伺服器錯誤", 500);
  }
}
