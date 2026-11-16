"use client";

import Link from "next/link";
import { Bell, ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAnnouncements } from "@/components/AnnouncementProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useCopy } from "@/components/LocaleProvider";
import { COMMON_COPY } from "@/lib/i18n/common";
import { basePath } from "@/lib/utils";

export default function Header({ backHref, backLabel }: { backHref?: string; backLabel?: string } = {}) {
  const { user, logout } = useAuth();
  const copy = useCopy(COMMON_COPY);
  const announcements = useAnnouncements();
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
            <span className="hidden sm:inline">{backLabel ?? copy.back}</span>
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

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        {user && (
          <>
            {announcements.enabled && (
              <button
                onClick={announcements.openCenter}
                title={copy.announcements}
                className="relative inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Bell className="size-4" />
                <span className="hidden sm:inline">{copy.announcements}</span>
                {announcements.unreadCount > 0 && (
                  <span className="absolute -top-0.5 left-4 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {announcements.unreadCount > 9 ? "9+" : announcements.unreadCount}
                  </span>
                )}
              </button>
            )}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="hidden max-w-[8rem] truncate sm:inline">{user.displayName}</span>
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                {user.role === "teacher" ? copy.roles.teacher : copy.roles.student}
              </span>
            </span>
            <button
              onClick={logout}
              title={copy.logout}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{copy.logout}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
