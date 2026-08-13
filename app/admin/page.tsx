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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-4" /> 學校總數
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{schools.length}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-4" /> 啟用中學校
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{activeSchools}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4" /> 使用者總數
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{totalUsers}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <Coins className="size-4" /> 近 30 天 token 用量
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
                  <div>
                    <p className="text-xs text-muted-foreground">估算成本</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCost(usage.cost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">總 tokens</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {usage.totalTokens.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">請求數</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {usage.requests.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">使用人數</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {usage.activeUsers.toLocaleString("en-US")}
                    </p>
                  </div>
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
