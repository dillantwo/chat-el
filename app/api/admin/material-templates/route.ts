import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { MaterialTemplate, type IMaterialGroup } from "@/models/MaterialTemplate";
import { LearningMaterial } from "@/models/LearningMaterial";
import { School } from "@/models/School";
import { ALL_SUBJECTS, type Subject } from "@/models/User";

export const runtime = "nodejs";

const MAX_NAME_LENGTH = 60;

interface ResolvedMaterial {
  id: string;
  title: string;
  description: string;
  audience: string;
  filename: string;
  size: number;
}

/** Every material uploaded for a subject, i.e. what a group can draw from. */
async function loadPool(subject: string): Promise<ResolvedMaterial[]> {
  const docs = await LearningMaterial.find({ subject })
    .select({ title: 1, description: 1, audience: 1, filename: 1, size: 1 })
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    description: d.description ?? "",
    audience: d.audience,
    filename: d.filename,
    size: d.size,
  }));
}

/** Drop ids whose material has since been deleted, so the editor never shows a hole. */
function resolveGroups(groups: IMaterialGroup[], pool: ResolvedMaterial[]) {
  const poolMap = new Map(pool.map((p) => [p.id, p]));
  return (groups ?? []).map((g) => ({
    name: g.name,
    materials: (g.materials ?? [])
      .map((mid) => poolMap.get(String(mid)))
      .filter((m): m is ResolvedMaterial => Boolean(m)),
  }));
}

/**
 * Turn the editor's `{ name, materialIds }` groups into storable ones, keeping
 * only ids that really are in this subject's pool and dropping unnamed groups.
 */
async function sanitiseGroups(subject: string, raw: unknown): Promise<IMaterialGroup[]> {
  const validIds = new Set(
    (await LearningMaterial.find({ subject }).select({ _id: 1 }).lean()).map((d) => String(d._id))
  );

  const rawGroups = Array.isArray(raw) ? raw : [];
  return rawGroups
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
}

/**
 * Keep only ids of schools that exist, so a school deleted in another tab cannot
 * be stored back and inflate the 適用學校 count.
 */
async function sanitiseSchools(raw: unknown): Promise<mongoose.Types.ObjectId[]> {
  const ids: string[] = Array.isArray(raw) ? raw.map((x: unknown) => String(x).trim()) : [];
  const unique = [...new Set(ids)].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (unique.length === 0) return [];

  const found = await School.find({ _id: { $in: unique } })
    .select({ _id: 1 })
    .lean();

  return found.map((s) => new mongoose.Types.ObjectId(String(s._id)));
}

function readName(value: unknown): string {
  return (value ?? "").toString().trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * A duplicate-key error against the legacy `subject_1` index means the migration
 * that lifted the one-template-per-subject limit has not been run on this
 * database. Say so, because "名稱已被使用" would be a lie and the admin has no
 * way to guess the real cause.
 */
function duplicateKeyMessage(err: unknown): string | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (e?.code !== 11000) return null;

  const keys = Object.keys(e.keyPattern ?? {});
  if (keys.length === 1 && keys[0] === "subject") {
    return "此科目已有範本，資料庫仍限制每科只有一個。請先執行 npm run migrate:material-templates。";
  }
  return "同一科目已有相同名稱的範本，請改用另一個名稱。";
}

// GET /api/admin/material-templates?subject=english[&template=<id>]
// Always returns the subject's template list (with each one's 適用學校, so the
// editor can show which template a school currently belongs to) and the subject's
// material pool. With `template`, also returns that template's groups.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const subject = (searchParams.get("subject") ?? "").trim();
  const templateId = (searchParams.get("template") ?? "").trim();

  if (!ALL_SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "科目無效" }, { status: 400 });
  }

  await connectDB();

  const [templateDocs, pool] = await Promise.all([
    // Creation order, so the list does not reshuffle when a template is renamed.
    MaterialTemplate.find({ subject })
      .select({ name: 1, schools: 1, groups: 1 })
      .sort({ createdAt: 1 })
      .lean(),
    loadPool(subject),
  ]);

  const templates = templateDocs.map((d) => ({
    id: String(d._id),
    name: d.name ?? "",
    schools: (d.schools ?? []).map((s) => String(s)),
  }));

  if (!templateId) {
    return NextResponse.json({ templates, groups: [], pool });
  }

  const active = templateDocs.find((d) => String(d._id) === templateId);
  if (!active) {
    return NextResponse.json({ error: "範本不存在", templates, pool }, { status: 404 });
  }

  return NextResponse.json({ templates, groups: resolveGroups(active.groups ?? [], pool), pool });
}

// POST /api/admin/material-templates — create a template.
// Body: { subject, name, copyFrom?: <template id> }
//
// Created with no 適用學校 on purpose: a new template should not start by taking
// schools away from an existing one, and 適用學校 is set from the editor.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const subject = (body.subject ?? "").toString().trim();
    const name = readName(body.name);
    const copyFrom = (body.copyFrom ?? "").toString().trim();

    if (!ALL_SUBJECTS.includes(subject as Subject)) {
      return NextResponse.json({ error: "科目無效" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "請輸入範本名稱" }, { status: 400 });
    }

    await connectDB();

    if (await MaterialTemplate.exists({ subject, name })) {
      return NextResponse.json({ error: "同一科目已有相同名稱的範本" }, { status: 409 });
    }

    // Starting from an existing template beats rebuilding a long list of groups
    // by hand when two schools differ by one item.
    let groups: IMaterialGroup[] = [];
    if (copyFrom) {
      if (!mongoose.Types.ObjectId.isValid(copyFrom)) {
        return NextResponse.json({ error: "來源範本無效" }, { status: 400 });
      }
      const source = await MaterialTemplate.findOne({ _id: copyFrom, subject })
        .select({ groups: 1 })
        .lean();
      if (!source) {
        return NextResponse.json({ error: "來源範本不存在" }, { status: 400 });
      }
      groups = (source.groups ?? []).map((g) => ({ name: g.name, materials: [...g.materials] }));
    }

    const created = await MaterialTemplate.create({ subject, name, schools: [], groups });

    return NextResponse.json({ id: String(created._id), name: created.name });
  } catch (err) {
    const duplicate = duplicateKeyMessage(err);
    if (duplicate) {
      return NextResponse.json({ error: duplicate }, { status: 409 });
    }
    console.error("[admin/material-templates:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// PUT /api/admin/material-templates — replace one template's groups and 適用學校,
// and optionally rename it. This is the whole "apply" step: the schools listed
// here read these groups directly, so the save takes effect immediately.
// Body: { id, groups: [{ name, materialIds }], schools?: string[], name? }
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = (body.id ?? "").toString().trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "範本無效" }, { status: 400 });
    }

    await connectDB();

    const template = await MaterialTemplate.findById(id).select({
      subject: 1,
      name: 1,
      schools: 1,
    });
    if (!template) {
      return NextResponse.json({ error: "範本不存在" }, { status: 404 });
    }

    // The subject comes from the stored template, never the request: it decides
    // which pool the material ids are checked against.
    const subject = String(template.subject);
    const groups = await sanitiseGroups(subject, body.groups);

    if (body.name !== undefined) {
      const name = readName(body.name);
      if (!name) {
        return NextResponse.json({ error: "請輸入範本名稱" }, { status: 400 });
      }
      if (
        name !== template.name &&
        (await MaterialTemplate.exists({ subject, name, _id: { $ne: template._id } }))
      ) {
        return NextResponse.json({ error: "同一科目已有相同名稱的範本" }, { status: 409 });
      }
      template.name = name;
    }

    let moved: string[] = [];
    if (body.schools !== undefined) {
      const schools = await sanitiseSchools(body.schools);

      // One template per school per subject. Taking a school means releasing it
      // from whichever template held it, so the two never disagree about what
      // that school should see.
      if (schools.length > 0) {
        const previousOwners = await MaterialTemplate.find({
          subject,
          _id: { $ne: template._id },
          schools: { $in: schools },
        })
          .select({ name: 1 })
          .lean();
        moved = previousOwners.map((t) => t.name);

        await MaterialTemplate.updateMany(
          { subject, _id: { $ne: template._id } },
          { $pull: { schools: { $in: schools } } },
        );
      }

      template.schools = schools;
    }

    template.groups = groups;
    await template.save();

    return NextResponse.json({
      success: true,
      id: String(template._id),
      name: template.name,
      schools: template.schools.map((s) => String(s)),
      // Named so the editor can tell the admin which templates lost a school.
      movedFrom: [...new Set(moved)],
    });
  } catch (err) {
    const duplicate = duplicateKeyMessage(err);
    if (duplicate) {
      return NextResponse.json({ error: duplicate }, { status: 409 });
    }
    console.error("[admin/material-templates:PUT]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/material-templates?id=<template id>
// The template is what its 適用學校 read, so deleting it empties their 學習資源
// page for that subject. The editor warns about that before calling this.
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "範本無效" }, { status: 400 });
  }

  try {
    await connectDB();

    const deleted = await MaterialTemplate.findByIdAndDelete(id).select({ _id: 1 }).lean();
    if (!deleted) {
      return NextResponse.json({ error: "範本不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/material-templates:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
