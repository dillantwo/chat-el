import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ToolboxProvider } from "@/contexts/ToolboxContext";
import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function MathDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("math", "ai-problem-solving");

  return (
    <ToolboxProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
      </SidebarProvider>
    </ToolboxProvider>
  );
}
