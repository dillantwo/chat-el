import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

/**
 * AI 生成圖解 — its own topic, so a school can open it to teachers without
 * opening AI 解題輔助 (and the other way round).
 *
 * No ToolboxProvider here on purpose: this page has no 工具箱, and AppSidebar
 * already treats the toolbox context as optional (`useToolbox()` returns null
 * outside a provider), so the sidebar renders the 圖解生成記錄 list and nothing
 * else.
 */
export default async function MathDiagramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("math", "ai-diagram");

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
    </SidebarProvider>
  );
}
