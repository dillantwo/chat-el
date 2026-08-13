/**
 * Detect MongoDB's duplicate-key error (E11000).
 *
 * Every admin create endpoint pre-checks for a conflict with findOne() and
 * returns a 409 with a field-specific message. That check is not atomic: two
 * concurrent requests can both pass it, and the loser then trips the unique
 * index inside create(). Without this helper that error falls through to the
 * generic catch and the admin sees "伺服器錯誤" (500) for what is really a
 * name collision — a misleading message for an entirely expected condition.
 *
 * The unique index is what actually guarantees integrity here; the findOne is
 * only there to produce a good message on the common path. So the right shape
 * is: keep both, and map E11000 onto the same 409 the pre-check would have
 * returned.
 *
 * Note this only reports *that* a unique constraint was violated, not which
 * one. Callers pass their own message, which keeps the racy path and the
 * pre-check path worded identically. A collection that grows a second unique
 * index needs `duplicateKeyFields()` to tell them apart.
 */

/** True when `err` is a MongoDB duplicate-key (E11000) error. */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

/**
 * The field names that collided, from the driver's `keyPattern`.
 * Returns [] when unavailable, so callers must tolerate an empty result.
 */
export function duplicateKeyFields(err: unknown): string[] {
  if (!isDuplicateKeyError(err)) return [];

  const keyPattern = (err as { keyPattern?: unknown }).keyPattern;
  if (typeof keyPattern !== "object" || keyPattern === null) return [];

  return Object.keys(keyPattern as Record<string, unknown>);
}
