import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { getSubjectAccess } from "@/lib/subject-access";
import { ToolboxConfig, type ITool, type SchoolScope } from "@/models/ToolboxConfig";
import { TOOLBOX_DEFAULTS } from "@/lib/toolbox-defaults";

/**
 * Authorization for the individual tools of the 數學科「AI 解題輔助」topic.
 *
 * Three independent switches decide whether someone may use a tool, and all of
 * them are read from the database on each request:
 *
 *  1. the school holds 數學科 and its「AI 解題輔助」topic (lib/subject-access.ts),
 *  2. the tool's group and the tool itself are live (`isActive`, set globally in
 *     工具管理), and
 *  3. the school is within the group's *and* the tool's `schoolScope`.
 *
 * Admins bypass all three, so they can still open a tool that is switched off or
 * scoped to other schools in order to check it.
 */

export interface ScopeFields {
  schoolScope?: SchoolScope;
  schools?: unknown[];
}

/** Whether one group/tool's scope admits the given school. */
export function isSchoolInScope(entry: ScopeFields, schoolId: string | null): boolean {
  if ((entry.schoolScope ?? "all") === "all") return true;
  if (!schoolId) return false;
  return (entry.schools ?? []).some((s) => String(s) === schoolId);
}

type GroupDoc = {
  type: string;
  isActive?: boolean;
  schoolScope?: SchoolScope;
  schools?: unknown[];
  tools?: ITool[];
};

/**
 * The group that contains a tool. Falls back to the built-in definition for a
 * group that was never seeded (journey), matching /api/toolbox.
 */
async function loadGroupForTool(toolKey: string): Promise<GroupDoc | null> {
  await connectDB();

  const config = await ToolboxConfig.findOne({ "tools.key": toolKey }).lean<GroupDoc | null>();
  if (config) return config;

  const fallback = Object.values(TOOLBOX_DEFAULTS).find((def) =>
    def.tools.some((t) => t.key === toolKey),
  );
  return fallback ?? null;
}

async function loadToolAccess(toolKey: string): Promise<boolean> {
  const access = await getSubjectAccess();
  if (!access.ok) return false;

  // Admins are global; they also have no school to match a scope against.
  if (access.role === "admin") return true;

  if (!access.subjects.includes("math")) return false;
  if (access.disabledTopics.includes("math:ai-problem-solving")) return false;

  const group = await loadGroupForTool(toolKey);
  if (!group) return false;

  if (group.isActive === false) return false;
  if (!isSchoolInScope(group, access.schoolId)) return false;

  const tool = (group.tools ?? []).find((t) => t.key === toolKey);
  if (!tool) return false;
  if (tool.isActive === false) return false;
  if (!isSchoolInScope(tool, access.schoolId)) return false;

  return true;
}

/** Deduplicated per request so a layout and its handlers share the queries. */
export const canUseMathTool = cache(loadToolAccess);

/**
 * Gate a tool's route. A tool the school may not use sends the user back to the
 * dashboard, where it is not listed anyway.
 */
export async function requireMathToolPage(toolKey: string): Promise<void> {
  if (!(await canUseMathTool(toolKey))) {
    redirect(`/math/dashboard?denied=${toolKey}`);
  }
}

/** The refusal an endpoint returns for a tool the caller may not use. */
export function mathToolDenied(): Response {
  return new Response(JSON.stringify({ error: "此工具未開放" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/** Gate a route handler that belongs to one tool. */
export async function requireMathToolApi(toolKey: string): Promise<Response | null> {
  if (await canUseMathTool(toolKey)) return null;
  return mathToolDenied();
}
