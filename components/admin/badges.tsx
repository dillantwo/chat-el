"use client";

import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, SUBJECT_LABELS, subjectAccent } from "@/lib/subjects";
import { cn } from "@/lib/utils";

/**
 * Shared coloured labels for the admin area.
 *
 * Subject and role badges appear on almost every admin page, and as plain
 * `variant="outline"` they were an indistinguishable row of grey pills. Colour
 * is doing real work here: a subject keeps the same hue as its pupil-facing
 * tile, and the three roles are told apart at a glance instead of by reading.
 */

/**
 * A subject pill in that subject's own colour.
 *
 * The tint is built from the accent hex with an alpha suffix, so adding a
 * subject to SUBJECT_ACCENTS is the only change a new subject needs.
 */
export function SubjectBadge({
  subject,
  className,
}: {
  subject: string;
  className?: string;
}) {
  const accent = subjectAccent(subject);
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", className)}
      style={{
        // 16% fill / 40% edge: enough separation between neighbouring pills
        // without the row turning into five saturated blocks.
        backgroundColor: `${accent}29`,
        borderColor: `${accent}66`,
        color: accent,
      }}
    >
      {SUBJECT_LABELS[subject] ?? subject}
    </Badge>
  );
}

/** Subject pills for a list, or an em dash when the list is empty. */
export function SubjectBadgeList({
  subjects,
  empty = "—",
  className,
}: {
  subjects: string[];
  empty?: React.ReactNode;
  className?: string;
}) {
  if (subjects.length === 0) {
    return <span className="text-muted-foreground">{empty}</span>;
  }
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {subjects.map((s) => (
        <SubjectBadge key={s} subject={s} />
      ))}
    </div>
  );
}

/**
 * Role colours. Admin is the theme blue because it is the privileged role and
 * should match the primary actions; teacher and student get their own hues so
 * a filtered list is scannable.
 */
const ROLE_STYLES: Record<string, string> = {
  admin: "border-primary/40 bg-primary/12 text-primary",
  teacher: "border-violet-300 bg-violet-100 text-violet-700",
  student: "border-teal-300 bg-teal-100 text-teal-700",
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        ROLE_STYLES[role] ?? "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

/**
 * 啟用 / 停用. Green and grey rather than the default filled-vs-outline pair,
 * which needed a second look to tell apart.
 */
export function StatusBadge({
  active,
  activeLabel = "啟用",
  inactiveLabel = "停用",
  className,
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        active
          ? "border-emerald-300 bg-emerald-100 text-emerald-700"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
