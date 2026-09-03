"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Building2, Coins, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { basePath } from "@/lib/utils";

interface SchoolRow {
  id: string;
  name: string;
  code: string;
  enabledSubjects: string[];
  active: boolean;
  userCount: number;
}

interface UsageSummary {
  cost: number;
  totalTokens: number;
  requests: number;
  activeUsers: number;
}

function formatCost(n: number): string {
  if (n === 0) return "$0";
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/**
 * The three headline counts, each with the accent of the section it belongs to
 * in the sidebar: 學校 violet, 使用者 orange. Following the nav rather than
 * inventing a third palette keeps one colour per concept across the backend.
 */
const STATS = [
  { key: "schools", label: "學校總數", icon: Building2, accent: "#7a3dff" },
  { key: "activeSchools", label: "啟用中學校", icon: Building2, accent: "#00a81b" },
  { key: "users", label: "使用者總數", icon: Users, accent: "#ff6b00" },
] as const;

/** The four usage figures, coloured to match the 用量分析 charts. */
const USAGE_METRICS = [
  { key: "cost", label: "估算成本", accent: "#146ef5" },
  { key: "totalTokens", label: "總 tokens", accent: "#7a3dff" },
  { key: "requests", label: "請求數", accent: "#0891b2" },
  { key: "activeUsers", label: "使用人數", accent: "#ed52cb" },
] as const;

export default function AdminOverviewPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${basePath}/api/admin/schools`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSchools)
      .catch(() => setSchools([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${basePath}/api/admin/token-usage?userLimit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUsage(data?.summary ?? null))
      .catch(() => setUsage(null));
  }, []);

  const totalUsers = schools.reduce((sum, s) => sum + s.userCount, 0);
  const activeSchools = schools.filter((s) => s.active).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">總覽</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理學校、老師與學生的科目存取權限。
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {STATS.map(({ key, label, icon: Icon, accent }) => (
              <Card
                key={key}
                className="relative overflow-hidden"
                // Faint wash of the stat's own colour so the three cards are
                // distinguishable before the labels are read.
                style={{ backgroundColor: `${accent}0a` }}
              >
                {/* Colour rail down the leading edge, the cheapest way to give a
                    card an identity without tinting the numerals. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: accent }}
                />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    <span
                      aria-hidden
                      className="flex size-7 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${accent}24`, color: accent }}
                    >
                      <Icon className="size-4" strokeWidth={2.25} />
                    </span>
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent
                  className="text-3xl font-semibold tabular-nums"
                  style={{ color: accent }}
                >
                  {key === "schools"
                    ? schools.length
                    : key === "activeSchools"
                      ? activeSchools
                      : totalUsers}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-md bg-amber-100 text-amber-600"
                >
                  <Coins className="size-4" strokeWidth={2.25} />
                </span>
                近 30 天 token 用量
              </CardTitle>
              <Link
                href="/admin/token-usage"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <BarChart3 className="size-4" /> 查看詳細分析
              </Link>
            </CardHeader>
            <CardContent>
              {!usage ? (
                <p className="text-sm text-muted-foreground">載入中…</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-4">
                  {USAGE_METRICS.map(({ key, label, accent }) => (
                    <div
                      key={key}
                      className="rounded-lg border-l-[3px] pl-3"
                      style={{ borderLeftColor: accent }}
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p
                        className="mt-1 text-2xl font-semibold tabular-nums"
                        style={{ color: accent }}
                      >
                        {key === "cost"
                          ? formatCost(usage.cost)
                          : usage[key].toLocaleString("en-US")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Link
              href="/admin/schools"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              管理學校
            </Link>
            <Link
              href="/admin/users"
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              管理使用者
            </Link>
            <Link
              href="/admin/token-usage"
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              用量分析
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
