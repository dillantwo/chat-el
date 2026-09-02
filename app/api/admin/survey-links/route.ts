import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import {
  SurveyTemplate,
  type ISurveyGroup,
  type ISurveyItem,
  type ISurveySlot,
} from "@/models/SurveyTemplate";
import { School } from "@/models/School";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import {
  DEFAULT_SLOT_TITLES,
  MAX_DESCRIPTION_LENGTH,
  MAX_GROUPS,
  MAX_GROUP_NAME_LENGTH,
  MAX_SURVEYS_PER_GROUP,
  MAX_TITLE_LENGTH,
  PHASE_LABELS,
  countSurveys,
  templateGroups,
  type SurveyPhase,
} from "@/lib/surveys";

export const runtime = "nodejs";

const MAX_NAME_LENGTH = 60;

type ItemResult = { ok: true; item: ISurveyItem | null } | { ok: false; error: string };
type GroupsResult = { ok: true; groups: ISurveyGroup[] } | { ok: false; error: string };

/**
 * Parse one questionnaire from the editor.
 *
 * An empty url means the admin added the row and has not pasted a link yet, which
 * is normal — the 後測 link usually appears weeks after the 前測 one — so the row
 * is dropped instead of stored. Anything else must be a plain https URL: the value
 * ends up in an `<iframe src>` and an `href`, so `javascript:` and friends are
 * rejected here rather than at render time, and http would be blocked as mixed
 * content on the student page anyway.
 */
function readItem(raw: unknown, where: string): ItemResult {
  if (!raw || typeof raw !== "object") return { ok: true, item: null };

  const r = raw as Record<string, unknown>;
  const phase: SurveyPhase = r.phase === "post" ? "post" : "pre";
  const url = (r.url ?? "").toString().trim();
  if (!url) return { ok: true, item: null };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: `${where}${PHASE_LABELS[phase]}連結格式不正確` };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: `${where}${PHASE_LABELS[phase]}連結必須以 https:// 開頭` };
  }

  const title = (r.title ?? "").toString().trim().slice(0, MAX_TITLE_LENGTH);

  return {
    ok: true,
    item: {
      phase,
      title: title || DEFAULT_SLOT_TITLES[phase],
      url: parsed.toString(),
      description: (r.description ?? "").toString().trim().slice(0, MAX_DESCRIPTION_LENGTH),
      embed: r.embed !== false,
    },
  };
}

/**
 * Turn the editor's 類別 list into storable groups.
 *
 * Unnamed 類別 are dropped rather than stored as blank tabs — the editor warns
 * about that before the save. An empty 類別 is kept: an admin often creates it
 * first and pastes the links afterwards. Order is preserved throughout: it is what
 * students see, and only the editor decides it.
 */
function readGroups(raw: unknown): GroupsResult {
  const rawGroups = Array.isArray(raw) ? raw : [];
  if (rawGroups.length > MAX_GROUPS) {
    return { ok: false, error: `類別最多 ${MAX_GROUPS} 個` };
  }

  const groups: ISurveyGroup[] = [];
  for (const entry of rawGroups) {
    const g = (entry ?? {}) as Record<string, unknown>;
    const name = (g.name ?? "").toString().trim().slice(0, MAX_GROUP_NAME_LENGTH);
    if (!name) continue;

    const rawSurveys = Array.isArray(g.surveys) ? g.surveys : [];
    if (rawSurveys.length > MAX_SURVEYS_PER_GROUP) {
      return { ok: false, error: `「${name}」的問卷最多 ${MAX_SURVEYS_PER_GROUP} 份` };
    }

    const surveys: ISurveyItem[] = [];
    for (const rawItem of rawSurveys) {
      const parsed = readItem(rawItem, `「${name}」的`);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      if (parsed.item) surveys.push(parsed.item);
    }

    groups.push({ name, surveys });
  }

  return { ok: true, groups };
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

function duplicateNameMessage(err: unknown): string | null {
  const e = err as { code?: number };
  if (e?.code !== 11000) return null;
  return "同一科目已有相同名稱的範本，請改用另一個名稱。";
}

/** Every field the editor needs about a template other than its 類別. */
function toSummary(doc: {
  _id: unknown;
  name?: string;
  schools?: unknown[];
  groups?: ISurveyGroup[] | null;
  pre?: ISurveySlot | null;
  post?: ISurveySlot | null;
}) {
  const groups = templateGroups(doc);
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    schools: (doc.schools ?? []).map((s) => String(s)),
    // Enough for the picker to show what a template actually contains.
    groupCount: groups.length,
    surveyCount: countSurveys(groups),
  };
}

// GET /api/admin/survey-links?subject=english[&template=<id>]
// Always returns the subject's template list (with each one's 適用學校, so the
// editor can show which template a school currently belongs to). With `template`,
// also returns that template's 類別.
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

  // Creation order, so the list does not reshuffle when a template is renamed.
  const docs = await SurveyTemplate.find({ subject })
    .select({ name: 1, schools: 1, groups: 1, pre: 1, post: 1 })
    .sort({ createdAt: 1 })
    .lean();

  const templates = docs.map(toSummary);

  if (!templateId) {
    return NextResponse.json({ templates, groups: [] });
  }

  const active = docs.find((d) => String(d._id) === templateId);
  if (!active) {
    return NextResponse.json({ error: "範本不存在", templates }, { status: 404 });
  }

  return NextResponse.json({ templates, groups: templateGroups(active) });
}

// POST /api/admin/survey-links — create a template.
// Body: { subject, name, copyFrom?: <template id> }
//
// Created with no 適用學校 on purpose: a new template should not start by taking
// schools away from an existing one.
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

    if (await SurveyTemplate.exists({ subject, name })) {
      return NextResponse.json({ error: "同一科目已有相同名稱的範本" }, { status: 409 });
    }

    // Starting from an existing template beats retyping a long list of 類別 when
    // two cohorts differ by one link.
    let groups: ISurveyGroup[] = [];
    if (copyFrom) {
      if (!mongoose.Types.ObjectId.isValid(copyFrom)) {
        return NextResponse.json({ error: "來源範本無效" }, { status: 400 });
      }
      const source = await SurveyTemplate.findOne({ _id: copyFrom, subject })
        .select({ groups: 1, pre: 1, post: 1 })
        .lean();
      if (!source) {
        return NextResponse.json({ error: "來源範本不存在" }, { status: 400 });
      }
      groups = templateGroups(source);
    }

    const created = await SurveyTemplate.create({ subject, name, schools: [], groups });

    return NextResponse.json({ id: String(created._id), name: created.name });
  } catch (err) {
    const duplicate = duplicateNameMessage(err);
    if (duplicate) {
      return NextResponse.json({ error: duplicate }, { status: 409 });
    }
    console.error("[admin/survey-links:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// PUT /api/admin/survey-links — replace one template's 類別 and 適用學校, and
// optionally rename it. This is the whole "apply" step: the schools listed here
// read these links directly, so the save takes effect immediately.
// Body: { id, groups?: [{ name, pre, post }], schools?: string[], name? }
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

    const template = await SurveyTemplate.findById(id).select({
      subject: 1,
      name: 1,
      schools: 1,
      groups: 1,
      pre: 1,
      post: 1,
    });
    if (!template) {
      return NextResponse.json({ error: "範本不存在" }, { status: 404 });
    }

    const subject = String(template.subject);

    if (body.groups !== undefined) {
      const parsed = readGroups(body.groups);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      template.groups = parsed.groups;
      // The editor was loaded with the legacy pair already folded into 類別, so
      // keeping it would duplicate those links — and resurrect them if the admin
      // later deletes every 類別.
      template.pre = null;
      template.post = null;
    }

    if (body.name !== undefined) {
      const name = readName(body.name);
      if (!name) {
        return NextResponse.json({ error: "請輸入範本名稱" }, { status: 400 });
      }
      if (
        name !== template.name &&
        (await SurveyTemplate.exists({ subject, name, _id: { $ne: template._id } }))
      ) {
        return NextResponse.json({ error: "同一科目已有相同名稱的範本" }, { status: 409 });
      }
      template.name = name;
    }

    let moved: string[] = [];
    if (body.schools !== undefined) {
      const schools = await sanitiseSchools(body.schools);

      // One template per school per subject. Taking a school means releasing it
      // from whichever template held it, so the two never disagree about which
      // questionnaires that school should answer.
      if (schools.length > 0) {
        const previousOwners = await SurveyTemplate.find({
          subject,
          _id: { $ne: template._id },
          schools: { $in: schools },
        })
          .select({ name: 1 })
          .lean();
        moved = previousOwners.map((t) => t.name);

        await SurveyTemplate.updateMany(
          { subject, _id: { $ne: template._id } },
          { $pull: { schools: { $in: schools } } },
        );
      }

      template.schools = schools;
    }

    await template.save();

    return NextResponse.json({
      success: true,
      id: String(template._id),
      name: template.name,
      schools: template.schools.map((s) => String(s)),
      groups: templateGroups(template),
      // Named so the editor can tell the admin which templates lost a school.
      movedFrom: [...new Set(moved)],
    });
  } catch (err) {
    const duplicate = duplicateNameMessage(err);
    if (duplicate) {
      return NextResponse.json({ error: duplicate }, { status: 409 });
    }
    console.error("[admin/survey-links:PUT]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/survey-links?id=<template id>
// The template is what its 適用學校 read, so deleting it leaves their 前測-後測
// page empty. The editor warns about that before calling this.
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

    const deleted = await SurveyTemplate.findByIdAndDelete(id).select({ _id: 1 }).lean();
    if (!deleted) {
      return NextResponse.json({ error: "範本不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/survey-links:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
