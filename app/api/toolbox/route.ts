import { connectDB } from "@/lib/mongodb";
import { ToolboxConfig, type ITool } from "@/models/ToolboxConfig";
import { journeyFallbackConfig } from "@/lib/toolbox-defaults";
import { getSubjectAccess, requireTopicApi } from "@/lib/subject-access";
import { isSchoolInScope } from "@/lib/toolbox-access";

// The toolbox drives the math dashboard, so it is gated as a math resource.
export async function GET() {
  const denied = await requireTopicApi("math", "ai-problem-solving");
  if (denied) return denied;

  const access = await getSubjectAccess();
  // requireTopicApi already rejected anything else, so this is only for typing.
  if (!access.ok) return denied ?? new Response(null, { status: 403 });

  // Admins have no school, and see every group and tool regardless of scope.
  const schoolId = access.role === "admin" ? null : access.schoolId;
  const scoped = access.role !== "admin";

  await connectDB();

  // Only active groups, and within them only active tools. Tools/groups saved
  // before the isActive flag existed have it undefined, which we treat as live.
  // Groups and tools are then narrowed to the ones this school may use.
  const configs = await ToolboxConfig.find({ isActive: true }).lean();
  const result = configs
    .filter((config) => !scoped || isSchoolInScope(config, schoolId))
    .map((config) => ({
      ...config,
      tools: (config.tools ?? []).filter(
        (tool: ITool) =>
          tool.isActive !== false && (!scoped || isSchoolInScope(tool, schoolId)),
      ),
    }))
    // A group whose tools are all out of scope would render as an empty section.
    .filter((config) => config.tools.length > 0);

  // Re-add the built-in journey tool only when no journey group exists at all.
  // If an admin has explicitly disabled the journey group it will be absent from
  // `configs` but still exist in the DB, so we must not force it back in.
  const journeyExists = await ToolboxConfig.exists({ type: "journey" });
  if (!journeyExists) {
    result.push(journeyFallbackConfig as unknown as (typeof result)[number]);
  }

  return Response.json(result);
}
