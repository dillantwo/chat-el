"use client";

import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { basePath } from "@/lib/utils";

export default function Header({ backHref, backLabel }: { backHref?: string; backLabel?: string } = {}) {
  const { user, logout } = useAuth();
  const logoSrc = `${basePath}/logo.png`.replace(/\/+$/g, "").replace(/([^:]\/)\/+/g, "$1") || "/logo.png";

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-3 border-b border-border bg-background sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-1"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">{backLabel ?? "返回"}</span>
          </Link>
        )}
        <Link href="/" className="inline-flex min-w-0 items-center gap-2 hover:opacity-80 transition-opacity sm:gap-3">
          <img
            src={logoSrc}
            alt="AI Learning Platform logo"
            className="h-8 w-auto shrink-0 object-contain sm:h-9"
          />
          <span className="hidden truncate text-base font-semibold tracking-tight sm:inline">
            AI and Coding for Subject Learning
          </span>
        </Link>
      </div>

      {user && (
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="hidden max-w-[8rem] truncate sm:inline">{user.displayName}</span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium capitalize">
              {user.role === "teacher" ? "教師" : "學生"}
            </span>
          </span>
          <button
            onClick={logout}
            title="登出"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">登出</span>
          </button>
        </div>
      )}
    </header>
  );
}
