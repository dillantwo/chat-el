import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function ChineseCharacterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("chinese", "character-description");

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
    </SidebarProvider>
  );
}
