"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, ClipboardList, FolderDown, GraduationCap, Library, Loader2, LogOut, ShieldCheck, Users, Wrench } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

/**
 * Nav sections, each with its own accent.
 *
 * The accents are not decoration for its own sake: nine grey rows all looked the
 * same, and a colour per section gives the eye something to aim at when jumping
 * between 學校 / 班級 / 使用者 all day. The first four reuse the pupil-facing
 * subject sticker colours so the two halves of the product share a palette.
 */
const NAV = [
  { href: "/admin", label: "總覽", icon: ShieldCheck, exact: true, accent: "#146ef5" },
  { href: "/admin/schools", label: "學校管理", icon: Building2, accent: "#7a3dff" },
  { href: "/admin/classes", label: "班級管理", icon: GraduationCap, accent: "#00a81b" },
  { href: "/admin/users", label: "使用者管理", icon: Users, accent: "#ff6b00" },
  { href: "/admin/token-usage", label: "用量分析", icon: BarChart3, accent: "#ed52cb" },
  { href: "/admin/toolbox", label: "工具管理", icon: Wrench, accent: "#0891b2" },
  { href: "/admin/materials", label: "上傳資源", icon: Library, accent: "#d97706" },
  { href: "/admin/school-materials", label: "學校資源", icon: FolderDown, accent: "#059669" },
  { href: "/admin/survey-links", label: "問卷範本", icon: ClipboardList, accent: "#e11d48" },
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

  // The admin palette lives on <html> rather than on the wrapper below, because
  // Dialog / Select / Popover content is portalled to <body>: scoping it to the
  // wrapper would leave every admin form popup on the neutral grey theme.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-theme");
    return () => root.classList.remove("admin-theme");
  }, []);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="admin-theme flex h-full flex-1 overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
        {/* Identity block. The gradient is the one place a large flat colour
            earns its keep — it anchors the sidebar and names the product. */}
        <div className="border-b bg-gradient-to-br from-primary to-[#7a3dff] px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/20 ring-1 ring-inset ring-white/30">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">管理後台</p>
              <p className="truncate text-xs text-primary-foreground/75">{user.displayName}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                style={
                  active
                    ? { backgroundColor: `${item.accent}1a`, color: item.accent }
                    : undefined
                }
              >
                {/* Rail on the active row: the tinted fill alone is subtle at
                    10% alpha, and this makes the current page unmistakable. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ backgroundColor: item.accent }}
                  />
                )}
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors"
                  style={{
                    backgroundColor: active ? item.accent : `${item.accent}1f`,
                    color: active ? "#fff" : item.accent,
                  }}
                >
                  <Icon className="size-3.5" strokeWidth={2.25} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="m-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          登出
        </button>
      </aside>

      {/* A wash of the theme hue at the top, fading into the page background, so
          the content area is not a flat white slab. */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-primary/[0.045] via-background to-background p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
