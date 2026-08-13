import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export default function EnglishReadingComprehensionCycle3Reading2RoleplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
    </SidebarProvider>
  );
}
