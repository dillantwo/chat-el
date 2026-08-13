import "server-only";
import { TokenUsage } from "@/models/TokenUsage";
import { User } from "@/models/User";
import { calculateUsageCost, getPricing } from "@/lib/token-cost";
import { resolveTopicKey, topicLabel, TOPIC_SUBJECTS } from "@/lib/usage-topics";
import { SUBJECT_LABELS, ROLE_LABELS } from "@/lib/subjects";

/** Reports are bucketed by Hong Kong local days, not UTC. */
export const REPORT_TIMEZONE = "Asia/Hong_Kong";

/** Sentinel value for "users that belong to no school" (admins / orphans). */
export const NO_SCHOOL = "none";

const PER_MILLION = 1_000_000;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface UsageFilters {
  from: Date;
  to: Date;
  /** School id, NO_SCHOOL, or null for all schools. */
  schoolId: string | null;
  subject: string | null;
  topic: string | null;
  /** A single user id to drill into. */
  userId: string | null;
  role: string | null;
  /** Free-text search on username / display name. */
  q: string | null;
}

/** Fixed UTC offset for REPORT_TIMEZONE. Hong Kong does not observe DST. */
const REPORT_UTC_OFFSET = "+08:00";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a boundary. A bare `yyyy-mm-dd` is interpreted in the report timezone
 * so that "5 Aug" means the whole of 5 Aug in Hong Kong, not in UTC.
 */
function parseBoundary(
  value: string | null,
  edge: "start" | "end",
  fallback: Date,
): Date {
  if (!value) return fallback;
  const iso = DATE_ONLY.test(value)
    ? `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}${REPORT_UTC_OFFSET}`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Read filters off a request query string, defaulting to the last 30 days. */
export function parseUsageFilters(searchParams: URLSearchParams): UsageFilters {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = parseBoundary(searchParams.get("from"), "start", defaultFrom);
  const to = parseBoundary(searchParams.get("to"), "end", now);

  const clean = (key: string) => {
    const v = searchParams.get(key);
    return v && v.trim() ? v.trim() : null;
  };

  return {
    from,
    to,
    schoolId: clean("school"),
    subject: clean("subject"),
    topic: clean("topic"),
    userId: clean("user"),
    role: clean("role"),
    q: clean("q"),
  };
}

// ---------------------------------------------------------------------------
// User directory
// ---------------------------------------------------------------------------

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  role: string;
  schoolId: string | null;
  schoolName: string | null;
}

/**
 * Load the user directory once per request.
 *
 * Usage records are attributed to the user's *current* school so a report can
 * be reconciled against the school that is actually being billed. The school
 * denormalized onto each record is used as a fallback when the user no longer
 * exists.
 */
export async function loadUserDirectory(): Promise<Map<string, UserInfo>> {
  const users = await User.find()
    .select("username displayName role school")
    .populate<{ school: { _id: unknown; name: string } | null }>("school", "name")
    .lean();

  const map = new Map<string, UserInfo>();
  for (const u of users) {
    const school = u.school as unknown as { _id: unknown; name: string } | null;
    map.set(String(u._id), {
      id: String(u._id),
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      schoolId: school ? String(school._id) : null,
      schoolName: school ? school.name : null,
    });
  }
  return map;
}

/**
 * Build the Mongo $match for a set of filters.
 *
 * School / role / text filters are resolved to a set of user ids up front so
 * the query stays index-friendly (userId is indexed) instead of needing a
 * per-document $lookup.
 */
export function buildUsageMatch(
  filters: UsageFilters,
  directory: Map<string, UserInfo>,
): Record<string, unknown> {
  const match: Record<string, unknown> = {
    createdAt: { $gte: filters.from, $lte: filters.to },
  };

  if (filters.subject) match.subject = filters.subject;

  if (filters.userId) {
    match.userId = filters.userId;
    return match;
  }

  const needsUserFilter = Boolean(filters.schoolId || filters.role || filters.q);
  if (needsUserFilter) {
    const rx = filters.q
      ? new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const ids: string[] = [];
    for (const info of directory.values()) {
      if (filters.role && info.role !== filters.role) continue;
      if (filters.schoolId) {
        const target = filters.schoolId === NO_SCHOOL ? null : filters.schoolId;
        if (info.schoolId !== target) continue;
      }
      if (rx && !rx.test(info.username) && !rx.test(info.displayName)) continue;
      ids.push(info.id);
    }

    if (filters.schoolId && filters.schoolId !== NO_SCHOOL && !filters.role && !rx) {
      // Also catch records whose user has since been deleted but which carry
      // the school denormalized on the record itself.
      match.$or = [{ userId: { $in: ids } }, { schoolId: filters.schoolId }];
    } else {
      match.userId = { $in: ids };
    }
  }

  return match;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** One raw aggregation bucket: a user's usage of one topic on one model. */
interface UsageBucket {
  _id: {
    userId: string;
    subject: string | null;
    topic: string | null;
    endpoint: string | null;
    modelName: string | null;
  };
  requests: number;
  promptTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  ragTokens: number;
  lastUsedAt: Date;
  username: string | null;
  displayName: string | null;
  role: string | null;
  schoolId: string | null;
  schoolName: string | null;
}

interface TrendBucket {
  _id: { day: string; modelName: string | null };
  requests: number;
  promptTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  ragTokens: number;
}

const SUM_FIELDS = {
  requests: { $sum: 1 },
  promptTokens: { $sum: { $ifNull: ["$promptTokens", 0] } },
  cachedInputTokens: { $sum: { $ifNull: ["$cachedInputTokens", 0] } },
  completionTokens: { $sum: { $ifNull: ["$completionTokens", 0] } },
  totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
  ragTokens: { $sum: { $ifNull: ["$ragTokens", 0] } },
} as const;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface UsageMetrics {
  requests: number;
  /** Input tokens billed at the full rate. */
  nonCachedInputTokens: number;
  cachedInputTokens: number;
  /** nonCached + cached. */
  inputTokens: number;
  completionTokens: number;
  totalTokens: number;
  ragTokens: number;
  /** Estimated USD cost across all models used. */
  cost: number;
  /** USD saved by prompt-cache hits vs. paying the full input rate. */
  cacheSavings: number;
}

function emptyMetrics(): UsageMetrics {
  return {
    requests: 0,
    nonCachedInputTokens: 0,
    cachedInputTokens: 0,
    inputTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    ragTokens: 0,
    cost: 0,
    cacheSavings: 0,
  };
}

interface TokenSums {
  requests: number;
  promptTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  ragTokens: number;
}

/** Fold one bucket (which belongs to a single model) into a metrics accumulator. */
function addBucket(target: UsageMetrics, sums: TokenSums, modelName: string | null): void {
  const cost = calculateUsageCost({
    modelName,
    promptTokens: sums.promptTokens,
    cachedInputTokens: sums.cachedInputTokens,
    completionTokens: sums.completionTokens,
  });
  const pricing = getPricing(modelName);

  target.requests += sums.requests;
  target.nonCachedInputTokens += cost.nonCachedInputTokens;
  target.cachedInputTokens += cost.cachedInputTokens;
  target.inputTokens += cost.nonCachedInputTokens + cost.cachedInputTokens;
  target.completionTokens += cost.outputTokens;
  target.totalTokens += sums.totalTokens;
  target.ragTokens += sums.ragTokens;
  target.cost += cost.totalCost;
  target.cacheSavings +=
    (cost.cachedInputTokens * (pricing.input - pricing.cachedInput)) / PER_MILLION;
}

// ---------------------------------------------------------------------------
// Report rows
// ---------------------------------------------------------------------------

export interface UsageRow extends UsageMetrics {
  key: string;
  label: string;
  /** Secondary label, e.g. the subject a topic belongs to. */
  sublabel?: string | null;
  /** Number of distinct users behind this row. */
  userCount: number;
  /** Share of the total cost in the current report, 0-1. */
  costShare: number;
  lastUsedAt: string | null;
}

export interface UsageUserRow extends UsageMetrics {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  roleLabel: string;
  schoolId: string | null;
  schoolName: string | null;
  /** Subject labels this user consumed tokens in. */
  subjects: string[];
  topicCount: number;
  costShare: number;
  lastUsedAt: string | null;
}

export interface UsageTrendPoint {
  date: string;
  requests: number;
  totalTokens: number;
  cost: number;
}

export interface UsageReport {
  range: { from: string; to: string };
  summary: UsageMetrics & { activeUsers: number; activeSchools: number; activeTopics: number };
  trend: UsageTrendPoint[];
  bySchool: UsageRow[];
  bySubject: UsageRow[];
  byTopic: UsageRow[];
  byModel: UsageRow[];
  byUser: UsageUserRow[];
}

/** Mutable accumulator used while folding buckets into a dimension. */
interface RowAcc {
  key: string;
  label: string;
  sublabel?: string | null;
  metrics: UsageMetrics;
  users: Set<string>;
  lastUsedAt: Date | null;
}

function getRow(
  map: Map<string, RowAcc>,
  key: string,
  label: string,
  sublabel?: string | null,
): RowAcc {
  let row = map.get(key);
  if (!row) {
    row = { key, label, sublabel, metrics: emptyMetrics(), users: new Set(), lastUsedAt: null };
    map.set(key, row);
  }
  return row;
}

function touch(row: RowAcc, userId: string, lastUsedAt: Date | null): void {
  row.users.add(userId);
  if (lastUsedAt && (!row.lastUsedAt || lastUsedAt > row.lastUsedAt)) {
    row.lastUsedAt = lastUsedAt;
  }
}

function finalizeRows(map: Map<string, RowAcc>, totalCost: number): UsageRow[] {
  return [...map.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      sublabel: row.sublabel ?? null,
      ...row.metrics,
      userCount: row.users.size,
      costShare: totalCost > 0 ? row.metrics.cost / totalCost : 0,
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    }))
    .sort((a, b) => b.cost - a.cost || b.totalTokens - a.totalTokens);
}

/**
 * Run the usage report.
 *
 * One aggregation groups by (user × subject × topic × model) — a bounded set —
 * and every breakdown is folded from those buckets in memory. Cost has to be
 * computed per model (prices differ), which is why modelName is part of the
 * grouping key.
 */
export async function buildUsageReport(
  filters: UsageFilters,
  directory: Map<string, UserInfo>,
  options: { userLimit?: number } = {},
): Promise<UsageReport> {
  const match = buildUsageMatch(filters, directory);

  const [facet] = await TokenUsage.aggregate<{
    buckets: UsageBucket[];
    trend: TrendBucket[];
  }>([
    { $match: match },
    {
      $facet: {
        buckets: [
          {
            $group: {
              _id: {
                userId: "$userId",
                subject: "$subject",
                topic: "$topic",
                endpoint: "$endpoint",
                modelName: "$modelName",
              },
              ...SUM_FIELDS,
              lastUsedAt: { $max: "$createdAt" },
              username: { $last: "$username" },
              displayName: { $last: "$displayName" },
              role: { $last: "$role" },
              schoolId: { $last: "$schoolId" },
              schoolName: { $last: "$schoolName" },
            },
          },
        ],
        trend: [
          {
            $group: {
              _id: {
                day: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                    timezone: REPORT_TIMEZONE,
                  },
                },
                modelName: "$modelName",
              },
              ...SUM_FIELDS,
            },
          },
          { $sort: { "_id.day": 1 } },
        ],
      },
    },
  ]);

  const buckets = facet?.buckets ?? [];
  const trendBuckets = facet?.trend ?? [];

  const summaryMetrics = emptyMetrics();
  const schools = new Map<string, RowAcc>();
  const subjects = new Map<string, RowAcc>();
  const topics = new Map<string, RowAcc>();
  const models = new Map<string, RowAcc>();

  interface UserAcc {
    info: UserInfo;
    metrics: UsageMetrics;
    subjects: Set<string>;
    topics: Set<string>;
    lastUsedAt: Date | null;
  }
  const users = new Map<string, UserAcc>();

  for (const bucket of buckets) {
    const { userId, subject, topic, endpoint, modelName } = bucket._id;
    const sums: TokenSums = {
      requests: bucket.requests,
      promptTokens: bucket.promptTokens,
      cachedInputTokens: bucket.cachedInputTokens,
      completionTokens: bucket.completionTokens,
      totalTokens: bucket.totalTokens,
      ragTokens: bucket.ragTokens,
    };
    const lastUsedAt = bucket.lastUsedAt ? new Date(bucket.lastUsedAt) : null;

    // Live user record wins; fall back to what was denormalized on the record
    // so usage from deleted users is still reported.
    const live = directory.get(userId);
    const info: UserInfo = live ?? {
      id: userId,
      username: bucket.username ?? userId,
      displayName: bucket.displayName ?? bucket.username ?? "（已刪除使用者）",
      role: bucket.role ?? "student",
      schoolId: bucket.schoolId ?? null,
      schoolName: bucket.schoolName ?? null,
    };

    addBucket(summaryMetrics, sums, modelName);

    // School
    const schoolKey = info.schoolId ?? NO_SCHOOL;
    const schoolRow = getRow(
      schools,
      schoolKey,
      info.schoolName ?? (schoolKey === NO_SCHOOL ? "未綁定學校" : schoolKey),
    );
    addBucket(schoolRow.metrics, sums, modelName);
    touch(schoolRow, userId, lastUsedAt);

    // Subject
    const subjectKey = subject ?? "unknown";
    const subjectRow = getRow(
      subjects,
      subjectKey,
      SUBJECT_LABELS[subjectKey] ?? subjectKey,
    );
    addBucket(subjectRow.metrics, sums, modelName);
    touch(subjectRow, userId, lastUsedAt);

    // Topic (derived from the endpoint for records written before topics existed)
    const topicKey = resolveTopicKey({ topic, endpoint, subject });
    const topicSubject = TOPIC_SUBJECTS[topicKey] ?? subjectKey;
    const topicRow = getRow(
      topics,
      topicKey,
      topicLabel(topicKey),
      SUBJECT_LABELS[topicSubject] ?? topicSubject,
    );
    addBucket(topicRow.metrics, sums, modelName);
    touch(topicRow, userId, lastUsedAt);

    // Model
    const modelKey = modelName ?? "unknown";
    const modelRow = getRow(models, modelKey, modelKey);
    addBucket(modelRow.metrics, sums, modelName);
    touch(modelRow, userId, lastUsedAt);

    // User
    let userAcc = users.get(userId);
    if (!userAcc) {
      userAcc = {
        info,
        metrics: emptyMetrics(),
        subjects: new Set(),
        topics: new Set(),
        lastUsedAt: null,
      };
      users.set(userId, userAcc);
    }
    addBucket(userAcc.metrics, sums, modelName);
    userAcc.subjects.add(subjectKey);
    userAcc.topics.add(topicKey);
    if (lastUsedAt && (!userAcc.lastUsedAt || lastUsedAt > userAcc.lastUsedAt)) {
      userAcc.lastUsedAt = lastUsedAt;
    }
  }

  const totalCost = summaryMetrics.cost;

  // Daily trend — cost still has to be resolved per model, then merged per day.
  const trendMap = new Map<string, UsageTrendPoint>();
  for (const bucket of trendBuckets) {
    const day = bucket._id.day;
    let point = trendMap.get(day);
    if (!point) {
      point = { date: day, requests: 0, totalTokens: 0, cost: 0 };
      trendMap.set(day, point);
    }
    const cost = calculateUsageCost({
      modelName: bucket._id.modelName,
      promptTokens: bucket.promptTokens,
      cachedInputTokens: bucket.cachedInputTokens,
      completionTokens: bucket.completionTokens,
    });
    point.requests += bucket.requests;
    point.totalTokens += bucket.totalTokens;
    point.cost += cost.totalCost;
  }

  const userLimit = options.userLimit ?? 200;
  const byUser: UsageUserRow[] = [...users.values()]
    .map((acc) => ({
      userId: acc.info.id,
      username: acc.info.username,
      displayName: acc.info.displayName,
      role: acc.info.role,
      roleLabel: ROLE_LABELS[acc.info.role] ?? acc.info.role,
      schoolId: acc.info.schoolId,
      schoolName: acc.info.schoolName,
      subjects: [...acc.subjects].map((s) => SUBJECT_LABELS[s] ?? s),
      topicCount: acc.topics.size,
      ...acc.metrics,
      costShare: totalCost > 0 ? acc.metrics.cost / totalCost : 0,
      lastUsedAt: acc.lastUsedAt ? acc.lastUsedAt.toISOString() : null,
    }))
    .sort((a, b) => b.cost - a.cost || b.totalTokens - a.totalTokens)
    .slice(0, userLimit);

  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    summary: {
      ...summaryMetrics,
      activeUsers: users.size,
      activeSchools: schools.size,
      activeTopics: topics.size,
    },
    trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    bySchool: finalizeRows(schools, totalCost),
    bySubject: finalizeRows(subjects, totalCost),
    byTopic: finalizeRows(topics, totalCost),
    byModel: finalizeRows(models, totalCost),
    byUser,
  };
}
