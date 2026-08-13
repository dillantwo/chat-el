import { requireTopicPage } from "@/lib/subject-access";
import { requireMathToolPage } from "@/lib/toolbox-access";

/**
 * Access guard shared by every page that belongs to the 數學科「AI 解題輔助」
 * topic. The tools (分數、時鐘、行程、體積…) sit in their own folders directly
 * under /math but are only ever reached from /math/dashboard, so closing that
 * topic for a school has to close them too — otherwise a bookmarked tool URL
 * would still let a student in.
 *
 * Two checks run here: the topic must be open for the school (學校管理), and the
 * tool itself must be live and in scope for that school (工具管理). Which tools
 * appear in the dashboard comes from the same rules, so the sidebar and the URL
 * can no longer disagree.
 *
 * Each tool folder exports its own guard by naming its tool:
 *
 *     export const runtime = "nodejs";
 *     export default mathToolLayout("fraction-addition");
 */
export function mathToolLayout(toolKey: string) {
  return async function MathToolLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    await requireTopicPage("math", "ai-problem-solving");
    await requireMathToolPage(toolKey);

    return children;
  };
}

/** For pages under the topic that are not a toolbox tool. */
export default async function AiToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("math", "ai-problem-solving");

  return children;
}
