"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, ClipboardList, FolderDown, GraduationCap, Library, Loader2, LogOut, ShieldCheck, Users, Wrench } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "總覽", icon: ShieldCheck, exact: true },
  { href: "/admin/schools", label: "學校管理", icon: Building2 },
  { href: "/admin/classes", label: "班級管理", icon: GraduationCap },
  { href: "/admin/users", label: "使用者管理", icon: Users },
  { href: "/admin/token-usage", label: "用量分析", icon: BarChart3 },
  { href: "/admin/toolbox", label: "工具管理", icon: Wrench },
  { href: "/admin/materials", label: "上傳資源", icon: Library },
  { href: "/admin/school-materials", label: "學校資源", icon: FolderDown },
  { href: "/admin/survey-links", label: "問卷範本", icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/login?from=/admin");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-muted/30">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-tight">管理後台</p>
            <p className="text-xs text-muted-foreground">{user.displayName}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="m-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
          登出
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
