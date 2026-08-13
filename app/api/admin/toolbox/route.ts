import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ToolboxConfig, type ITool, type SchoolScope } from "@/models/ToolboxConfig";
import { School } from "@/models/School";
import { requireAdmin } from "@/lib/admin-auth";
import { TOOLBOX_DEFAULTS, type ToolboxConfigDefault } from "@/lib/toolbox-defaults";

function serializeGroup(c: {
  _id?: unknown;
  type: string;
  label: string;
  description: string;
  isActive?: boolean;
  schoolScope?: SchoolScope;
  schools?: unknown[];
  tools?: ITool[];
}) {
  return {
    id: c._id ? String(c._id) : `default:${c.type}`,
    type: c.type,
    label: c.label,
    description: c.description,
    isActive: c.isActive !== false,
    // Absent means the document predates the field, i.e. open to everyone.
    schoolScope: c.schoolScope ?? "all",
    schools: (c.schools ?? []).map((s) => String(s)),
    tools: (c.tools ?? []).map((t: ITool) => ({
      key: t.key,
      label: t.label,
      sub: t.sub,
      icon: t.icon,
      isActive: t.isActive !== false,
      schoolScope: t.schoolScope ?? "all",
      schools: (t.schools ?? []).map((s) => String(s)),
    })),
  };
}

/**
 * Validate a scope change. `schools` is filtered against the schools that
 * actually exist, so a deleted school cannot linger in the list.
 */
async function resolveScope(
  scope: unknown,
  rawSchools: unknown,
): Promise<
  { ok: true; schoolScope: SchoolScope; schools: mongoose.Types.ObjectId[] } | { ok: false; error: string }
> {
  if (scope !== "all" && scope !== "selected") {
    return { ok: false, error: "開放範圍無效" };
  }

  const ids = (Array.isArray(rawSchools) ? rawSchools : [])
    .map((s) => String(s))
    .filter((s) => mongoose.Types.ObjectId.isValid(s));

  const existing = await School.find({ _id: { $in: ids } })
    .select({ _id: 1 })
    .lean<{ _id: mongoose.Types.ObjectId }[]>();

  // The list is kept even for "all", which ignores it: opening something up for
  // a term and narrowing it again later should not mean rebuilding the selection
  // from memory.
  return {
    ok: true,
    schoolScope: scope,
    schools: existing.map((s) => s._id),
  };
}

// GET /api/admin/toolbox — list ALL toolbox groups (including disabled ones)
// so the admin can see and toggle everything.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  await connectDB();
  const configs = await ToolboxConfig.find().sort({ createdAt: 1 }).lean();
  const result = configs.map(serializeGroup);

  // Surface built-in groups that were never seeded (e.g. journey) so they still
  // get a toggle. They are persisted to the DB the first time they're toggled.
  const existingTypes = new Set(configs.map((c) => c.type));
  for (const def of Object.values(TOOLBOX_DEFAULTS)) {
    if (!existingTypes.has(def.type)) {
      result.push(serializeGroup(def));
    }
  }

  return NextResponse.json(result);
}

// PATCH /api/admin/toolbox — toggle, rename, or re-scope a group / single tool.
// Body (any one of isActive, label, schoolScope may be supplied):
//   { type, isActive }                      → toggle a whole group
//   { type, label }                         → rename a whole group
//   { type, schoolScope, schools }          → re-scope a whole group
//   { type, toolKey, isActive }             → toggle a single tool
//   { type, toolKey, label }                → rename a single tool
//   { type, toolKey, schoolScope, schools } → re-scope a single tool
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const type = (body.type ?? "").toString().trim();
    const toolKey = body.toolKey ? body.toolKey.toString().trim() : null;

    const hasIsActive = typeof body.isActive === "boolean";
    const isActive: boolean | undefined = hasIsActive ? body.isActive : undefined;

    const hasLabel = typeof body.label === "string";
    const label = hasLabel ? body.label.trim() : undefined;

    const hasScope = body.schoolScope !== undefined;

    if (!type) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }
    if (!hasIsActive && !hasLabel && !hasScope) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }
    if (hasLabel && !label) {
      return NextResponse.json({ error: "名稱不可為空白" }, { status: 400 });
    }

    await connectDB();

    const scope = hasScope ? await resolveScope(body.schoolScope, body.schools) : null;
    if (scope && !scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: 400 });
    }

    let config = await ToolboxConfig.findOne({ type });
    if (!config) {
      // Group isn't in the DB yet. If it's a known built-in default (journey),
      // create it now so the change persists; otherwise it genuinely doesn't exist.
      // hasOwn, so a `type` of "constructor" or "toString" is a 404 rather than
      // a prototype hit that blows up in create().
      const def: ToolboxConfigDefault | undefined = Object.hasOwn(TOOLBOX_DEFAULTS, type)
        ? TOOLBOX_DEFAULTS[type]
        : undefined;
      if (!def) {
        return NextResponse.json({ error: "找不到工具群組" }, { status: 404 });
      }
      config = await ToolboxConfig.create(def);
    }

    if (toolKey) {
      const tool = config.tools.find((t: ITool) => t.key === toolKey);
      if (!tool) {
        return NextResponse.json({ error: "找不到工具" }, { status: 404 });
      }
      if (isActive !== undefined) tool.isActive = isActive;
      if (label !== undefined) tool.label = label;
      if (scope?.ok) {
        tool.schoolScope = scope.schoolScope;
        tool.schools = scope.schools;
      }
      config.markModified("tools");
    } else {
      if (isActive !== undefined) config.isActive = isActive;
      if (label !== undefined) config.label = label;
      if (scope?.ok) {
        config.schoolScope = scope.schoolScope;
        config.schools = scope.schools;
      }
    }

    await config.save();

    return NextResponse.json(serializeGroup(config.toObject()));
  } catch (err) {
    console.error("[admin/toolbox:PATCH]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
