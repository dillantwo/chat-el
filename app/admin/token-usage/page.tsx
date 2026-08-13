"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Coins,
  Download,
  Gauge,
  Loader2,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SUBJECTS, SUBJECT_LABELS } from "@/lib/subjects";
import { USAGE_TOPICS } from "@/lib/usage-topics";
import { basePath, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror /api/admin/token-usage)
// ---------------------------------------------------------------------------

interface Metrics {
  requests: number;
  nonCachedInputTokens: number;
  cachedInputTokens: number;
  inputTokens: number;
  completionTokens: number;
  totalTokens: number;
  ragTokens: number;
  cost: number;
  cacheSavings: number;
}

interface UsageRow extends Metrics {
  key: string;
  label: string;
  sublabel: string | null;
  userCount: number;
  costShare: number;
  lastUsedAt: string | null;
}

interface UsageUserRow extends Metrics {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  roleLabel: string;
  schoolId: string | null;
  schoolName: string | null;
  subjects: string[];
  topicCount: number;
  costShare: number;
  lastUsedAt: string | null;
}

interface TrendPoint {
  date: string;
  requests: number;
  totalTokens: number;
  cost: number;
}

interface UsageReport {
  range: { from: string; to: string };
  summary: Metrics & { activeUsers: number; activeSchools: number; activeTopics: number };
  trend: TrendPoint[];
  bySchool: UsageRow[];
  bySubject: UsageRow[];
  byTopic: UsageRow[];
  byModel: UsageRow[];
  byUser: UsageUserRow[];
  schools: { id: string; name: string; code: string }[];
}

interface DetailRecord {
  id: string;
  createdAt: string;
  userId: string;
  username: string;
  displayName: string;
  roleLabel: string;
  schoolName: string | null;
  subjectLabel: string;
  topicLabel: string;
  modelName: string;
  endpoint: string;
  inputTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  ragTokens: number;
  cost: number;
}

interface RecordsResponse {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  records: DetailRecord[];
}

type Dimension = "school" | "subject" | "topic" | "user" | "model";

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "school", label: "學校" },
  { value: "subject", label: "科目" },
  { value: "topic", label: "主題" },
  { value: "user", label: "學生 / 老師" },
  { value: "model", label: "模型" },
];

const PRESETS = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
  { days: 365, label: "近 1 年" },
];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const numberFormat = new Intl.NumberFormat("en-US");

function formatTokens(n: number): string {
  return numberFormat.format(Math.round(n));
}

/** Compact token count for tight columns: 12.3K / 4.5M. */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** Costs are often fractions of a cent, so scale the precision. */
function formatCost(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(days: number): string {
  return toDateInput(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Inline share bar — avoids pulling in a charting dependency. */
function ShareBar({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        role="presentation"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

/** Daily cost trend as a plain SVG bar chart. */
function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return null;

  const max = Math.max(...trend.map((p) => p.cost), 0);
  const total = trend.reduce((sum, p) => sum + p.cost, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          每日成本趨勢
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          區間合計 {formatCost(total)}
        </span>
      </CardHeader>
      <CardContent>
        <div
          className="flex h-32 items-end gap-px"
          role="img"
          aria-label={`每日成本趨勢，共 ${trend.length} 天，區間合計 ${formatCost(total)}`}
        >
          {trend.map((p) => {
            const height = max > 0 ? Math.max(2, (p.cost / max) * 100) : 2;
            return (
              <div
                key={p.date}
                className="group relative flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                style={{ height: `${height}%` }}
              >
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                  {p.date} · {formatCost(p.cost)} · {formatTokens(p.totalTokens)} tokens
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{trend[0]?.date}</span>
          <span>{trend[trend.length - 1]?.date}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TokenUsagePage() {
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; label: string } | null>(
    null,
  );

  const [dimension, setDimension] = useState<Dimension>("school");

  // detail records
  const [records, setRecords] = useState<RecordsResponse | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [page, setPage] = useState(1);

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (school) p.set("school", school);
    if (subject) p.set("subject", subject);
    if (topic) p.set("topic", topic);
    if (role) p.set("role", role);
    if (query.trim()) p.set("q", query.trim());
    if (selectedUser) p.set("user", selectedUser.id);
    return p.toString();
  }, [from, to, school, subject, topic, role, query, selectedUser]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/admin/token-usage?${filterParams}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "載入失敗");
        setReport(null);
        return;
      }
      setReport(await res.json());
    } catch {
      setError("載入失敗");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [filterParams]);

  useEffect(() => {
    const t = setTimeout(loadReport, 250);
    return () => clearTimeout(t);
  }, [loadReport]);

  // Reset paging whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [filterParams]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch(
        `${basePath}/api/admin/token-usage/records?${filterParams}&page=${page}&pageSize=25`,
      );
      setRecords(res.ok ? await res.json() : null);
    } catch {
      setRecords(null);
    } finally {
      setRecordsLoading(false);
    }
  }, [filterParams, page]);

  useEffect(() => {
    const t = setTimeout(loadRecords, 300);
    return () => clearTimeout(t);
  }, [loadRecords]);

  const schools = report?.schools ?? [];
  const summary = report?.summary;

  const topicOptions = useMemo(
    () => (subject ? USAGE_TOPICS.filter((t) => t.subject === subject) : USAGE_TOPICS),
    [subject],
  );

  function resetFilters() {
    setFrom(daysAgo(30));
    setTo(toDateInput(new Date()));
    setSchool("");
    setSubject("");
    setTopic("");
    setRole("");
    setQuery("");
    setSelectedUser(null);
  }

  function applyPreset(days: number) {
    setFrom(daysAgo(days));
    setTo(toDateInput(new Date()));
  }

  /** Clicking a row drills the whole report into that slice. */
  function drillInto(dim: Dimension, row: UsageRow | UsageUserRow) {
    if (dim === "school") {
      setSchool((row as UsageRow).key);
    } else if (dim === "subject") {
      setSubject((row as UsageRow).key);
      setTopic("");
    } else if (dim === "topic") {
      setTopic((row as UsageRow).key);
    } else if (dim === "user") {
      const u = row as UsageUserRow;
      setSelectedUser({ id: u.userId, label: `${u.displayName}（${u.username}）` });
    }
  }

  function exportCsv(type: Dimension | "records") {
    window.open(
      `${basePath}/api/admin/token-usage/export?${filterParams}&type=${type}`,
      "_blank",
    );
  }

  const activeChips = [
    school && {
      label: `學校：${schools.find((s) => s.id === school)?.name ?? (school === "none" ? "未綁定學校" : school)}`,
      clear: () => setSchool(""),
    },
    subject && {
      label: `科目：${SUBJECT_LABELS[subject] ?? subject}`,
      clear: () => {
        setSubject("");
        setTopic("");
      },
    },
    topic && {
      label: `主題：${USAGE_TOPICS.find((t) => t.key === topic)?.label ?? topic}`,
      clear: () => setTopic(""),
    },
    role && {
      label: `角色：${role === "student" ? "學生" : role === "teacher" ? "老師" : "管理員"}`,
      clear: () => setRole(""),
    },
    selectedUser && {
      label: `使用者：${selectedUser.label}`,
      clear: () => setSelectedUser(null),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const rows: UsageRow[] =
    dimension === "school"
      ? (report?.bySchool ?? [])
      : dimension === "subject"
        ? (report?.bySubject ?? [])
        : dimension === "topic"
          ? (report?.byTopic ?? [])
          : dimension === "model"
            ? (report?.byModel ?? [])
            : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">用量分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按學校、科目、主題與使用者查看 token 消耗與估算成本。點擊表格任一列可下探該範圍。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCsv(dimension)}>
            <Download className="size-4" /> 匯出目前分類
          </Button>
          <Button variant="outline" onClick={() => exportCsv("records")}>
            <Download className="size-4" /> 匯出明細
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const active = from === daysAgo(p.days) && to === toDateInput(new Date());
            return (
              <button
                key={p.days}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-40"
              aria-label="開始日期"
            />
            <span className="text-sm text-muted-foreground">至</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-40"
              aria-label="結束日期"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={school} onValueChange={(v) => setSchool(v as string)}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="全部學校">
                {(v) =>
                  !v
                    ? "全部學校"
                    : v === "none"
                      ? "未綁定學校"
                      : (schools.find((s) => s.id === v)?.name ?? "全部學校")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部學校</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              <SelectItem value="none">未綁定學校</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={subject}
            onValueChange={(v) => {
              setSubject(v as string);
              setTopic("");
            }}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="全部科目">
                {(v) => (!v ? "全部科目" : (SUBJECT_LABELS[v as string] ?? "全部科目"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部科目</SelectItem>
              {SUBJECTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={topic} onValueChange={(v) => setTopic(v as string)}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="全部主題">
                {(v) =>
                  !v
                    ? "全部主題"
                    : (USAGE_TOPICS.find((t) => t.key === v)?.label ?? "全部主題")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部主題</SelectItem>
              {topicOptions.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={role} onValueChange={(v) => setRole(v as string)}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue placeholder="全部角色">
                {(v) =>
                  !v
                    ? "全部角色"
                    : v === "student"
                      ? "學生"
                      : v === "teacher"
                        ? "老師"
                        : "管理員"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部角色</SelectItem>
              <SelectItem value="student">學生</SelectItem>
              <SelectItem value="teacher">老師</SelectItem>
              <SelectItem value="admin">管理員</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋用戶名或姓名"
            className="h-9 max-w-xs"
          />

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="size-4" /> 重設
          </Button>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">目前篩選：</span>
            {activeChips.map((chip) => (
              <Badge key={chip.label} variant="secondary" className="gap-1 pr-1">
                {chip.label}
                <button
                  type="button"
                  onClick={chip.clear}
                  aria-label={`移除篩選 ${chip.label}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !report ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !summary ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Coins}
              title="估算成本"
              value={formatCost(summary.cost)}
              hint={`快取節省 ${formatCost(summary.cacheSavings)}`}
            />
            <StatCard
              icon={Gauge}
              title="總 tokens"
              value={formatTokens(summary.totalTokens)}
              hint={`輸入 ${formatCompact(summary.inputTokens)} · 輸出 ${formatCompact(summary.completionTokens)}`}
            />
            <StatCard
              icon={Users}
              title="使用人數"
              value={formatTokens(summary.activeUsers)}
              hint={`${formatTokens(summary.requests)} 次請求`}
            />
            <StatCard
              icon={Building2}
              title="涵蓋學校"
              value={formatTokens(summary.activeSchools)}
              hint={`${formatTokens(summary.activeTopics)} 個主題有使用記錄`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="輸入 tokens（全價）" value={formatTokens(summary.nonCachedInputTokens)} />
            <MiniStat label="快取輸入 tokens（折扣價）" value={formatTokens(summary.cachedInputTokens)} />
            <MiniStat label="輸出 tokens" value={formatTokens(summary.completionTokens)} />
            <MiniStat label="RAG 檢索 tokens" value={formatTokens(summary.ragTokens)} />
          </div>

          <TrendChart trend={report?.trend ?? []} />

          {/* Breakdown */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-muted p-1" role="tablist">
                {DIMENSIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    role="tab"
                    aria-selected={dimension === d.value}
                    onClick={() => setDimension(d.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      dimension === d.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {loading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {dimension === "user" ? (
              <UserTable
                rows={report?.byUser ?? []}
                onSelect={(row) => drillInto("user", row)}
              />
            ) : (
              <DimensionTable
                rows={rows}
                dimension={dimension}
                onSelect={(row) => drillInto(dimension, row)}
              />
            )}
          </div>

          {/* Detail log */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">明細記錄</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {recordsLoading && <Loader2 className="size-4 animate-spin" />}
                <span>共 {formatTokens(records?.total ?? 0)} 筆</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一頁
                </Button>
                <span className="tabular-nums">
                  {records?.page ?? 1} / {records?.pageCount ?? 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!records || page >= records.pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一頁
                </Button>
              </div>
            </div>
            <RecordsTable records={records?.records ?? []} />
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DimensionTable({
  rows,
  dimension,
  onSelect,
}: {
  rows: UsageRow[];
  dimension: Dimension;
  onSelect: (row: UsageRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
        此範圍沒有使用記錄。
      </p>
    );
  }

  const nameHeader =
    dimension === "school"
      ? "學校"
      : dimension === "subject"
        ? "科目"
        : dimension === "topic"
          ? "主題"
          : "模型";
  const drillable = dimension !== "model";

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-4">{nameHeader}</TableHead>
            <TableHead className="px-4 text-right">請求數</TableHead>
            <TableHead className="px-4 text-right">使用人數</TableHead>
            <TableHead className="px-4 text-right">輸入</TableHead>
            <TableHead className="px-4 text-right">快取</TableHead>
            <TableHead className="px-4 text-right">輸出</TableHead>
            <TableHead className="px-4 text-right">總 tokens</TableHead>
            <TableHead className="px-4 text-right">估算成本</TableHead>
            <TableHead className="px-4">成本佔比</TableHead>
            <TableHead className="px-4">最後使用</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              className={drillable ? "cursor-pointer" : undefined}
              onClick={drillable ? () => onSelect(row) : undefined}
            >
              <TableCell className="px-4 py-3">
                <span className="font-medium">{row.label}</span>
                {row.sublabel && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {row.sublabel}
                  </span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(row.requests)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(row.userCount)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatCompact(row.inputTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatCompact(row.cachedInputTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatCompact(row.completionTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(row.totalTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right font-medium tabular-nums">
                {formatCost(row.cost)}
              </TableCell>
              <TableCell className="px-4 py-3">
                <ShareBar share={row.costShare} />
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                {formatDateTime(row.lastUsedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserTable({
  rows,
  onSelect,
}: {
  rows: UsageUserRow[];
  onSelect: (row: UsageUserRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
        此範圍沒有使用記錄。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-4">姓名</TableHead>
            <TableHead className="px-4">角色</TableHead>
            <TableHead className="px-4">學校</TableHead>
            <TableHead className="px-4">科目</TableHead>
            <TableHead className="px-4 text-right">主題數</TableHead>
            <TableHead className="px-4 text-right">請求數</TableHead>
            <TableHead className="px-4 text-right">輸入</TableHead>
            <TableHead className="px-4 text-right">輸出</TableHead>
            <TableHead className="px-4 text-right">總 tokens</TableHead>
            <TableHead className="px-4 text-right">估算成本</TableHead>
            <TableHead className="px-4">成本佔比</TableHead>
            <TableHead className="px-4">最後使用</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.userId}
              className="cursor-pointer"
              onClick={() => onSelect(row)}
            >
              <TableCell className="px-4 py-3">
                <span className="font-medium">{row.displayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {row.username}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Badge variant={row.role === "student" ? "secondary" : "outline"}>
                  {row.roleLabel}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-muted-foreground">
                {row.schoolName ?? "—"}
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {row.subjects.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {row.topicCount}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(row.requests)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatCompact(row.inputTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatCompact(row.completionTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(row.totalTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right font-medium tabular-nums">
                {formatCost(row.cost)}
              </TableCell>
              <TableCell className="px-4 py-3">
                <ShareBar share={row.costShare} />
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                {formatDateTime(row.lastUsedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RecordsTable({ records }: { records: DetailRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        此範圍沒有明細記錄。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-4">時間</TableHead>
            <TableHead className="px-4">使用者</TableHead>
            <TableHead className="px-4">學校</TableHead>
            <TableHead className="px-4">科目 / 主題</TableHead>
            <TableHead className="px-4">模型</TableHead>
            <TableHead className="px-4 text-right">輸入</TableHead>
            <TableHead className="px-4 text-right">快取</TableHead>
            <TableHead className="px-4 text-right">輸出</TableHead>
            <TableHead className="px-4 text-right">RAG</TableHead>
            <TableHead className="px-4 text-right">成本</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                {formatDateTime(r.createdAt)}
              </TableCell>
              <TableCell className="px-4 py-3">
                <span className="font-medium">{r.displayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.roleLabel}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-muted-foreground">
                {r.schoolName ?? "—"}
              </TableCell>
              <TableCell className="px-4 py-3">
                <span>{r.topicLabel}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.subjectLabel}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                {r.modelName}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(r.inputTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatTokens(r.cachedInputTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                {formatTokens(r.completionTokens)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {r.ragTokens ? formatTokens(r.ragTokens) : "—"}
              </TableCell>
              <TableCell className="px-4 py-3 text-right font-medium tabular-nums">
                {formatCost(r.cost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
