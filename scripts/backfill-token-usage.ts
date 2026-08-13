/**
 * Backfill script: populate the analytics fields added to TokenUsage
 * (schoolId, schoolName, displayName, role, topic) on records written before
 * those fields existed.
 *
 * The admin report can render without this — it falls back to the live User
 * directory and derives topics from the endpoint — but backfilling makes the
 * stored records self-contained, which keeps reports stable after a user is
 * moved between schools or deleted.
 *
 * A fresh deployment has no such records, so this is not part of first-time
 * setup. Note it is also the `tools` image's default CMD, which means a bare
 * `docker compose run --rm tools` runs this against live data — always pass an
 * explicit command.
 *
 * Usage (inside Docker — the tools profile already supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/backfill-token-usage.ts --dry-run
 *   docker compose run --rm tools npx tsx scripts/backfill-token-usage.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/backfill-token-usage.ts --dry-run
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { TokenUsage } from "../models/TokenUsage";
import { User } from "../models/User";
import { School } from "../models/School";
import { topicFromEndpoint } from "../lib/usage-topics";

const MONGODB_URI = requireMongoUri();
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 1000;

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB${DRY_RUN ? " (dry run)" : ""}`);

  // Build a userId -> { school, displayName, role } map once.
  const schools = await School.find().select("name").lean();
  const schoolNames = new Map(schools.map((s) => [String(s._id), s.name]));

  const users = await User.find().select("displayName role school").lean();
  const userInfo = new Map(
    users.map((u) => {
      const schoolId = u.school ? String(u.school) : null;
      return [
        String(u._id),
        {
          displayName: u.displayName,
          role: u.role,
          schoolId,
          schoolName: schoolId ? (schoolNames.get(schoolId) ?? null) : null,
        },
      ] as const;
    }),
  );
  console.log(`Loaded ${userInfo.size} users across ${schoolNames.size} schools`);

  // Only touch records that are missing at least one of the new fields.
  const filter = {
    $or: [
      { schoolId: { $exists: false } },
      { topic: { $exists: false } },
      { topic: null },
      { role: { $exists: false } },
      { role: null },
    ],
  };

  const total = await TokenUsage.countDocuments(filter);
  console.log(`${total} record(s) need backfilling`);
  if (total === 0) {
    await mongoose.disconnect();
    return;
  }

  let processed = 0;
  let updated = 0;
  let unmatchedUsers = 0;
  let ops: Parameters<typeof TokenUsage.bulkWrite>[0] = [];

  const flush = async () => {
    if (ops.length === 0) return;
    if (!DRY_RUN) await TokenUsage.bulkWrite(ops);
    updated += ops.length;
    ops = [];
  };

  const cursor = TokenUsage.find(filter)
    .select("userId username subject topic endpoint")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    processed += 1;
    const info = userInfo.get(doc.userId);
    if (!info) unmatchedUsers += 1;

    const set: Record<string, unknown> = {};
    if (info) {
      set.schoolId = info.schoolId;
      set.schoolName = info.schoolName;
      set.displayName = info.displayName;
      set.role = info.role;
    }
    if (!doc.topic) {
      set.topic = topicFromEndpoint(doc.endpoint, doc.subject);
    }

    if (Object.keys(set).length > 0) {
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    }

    if (ops.length >= BATCH_SIZE) {
      await flush();
      console.log(`  ${processed}/${total} processed…`);
    }
  }

  await flush();

  console.log(
    `Done. processed=${processed} updated=${updated} unmatchedUsers=${unmatchedUsers}` +
      (DRY_RUN ? " (dry run — nothing written)" : ""),
  );
  if (unmatchedUsers > 0) {
    console.log(
      `Note: ${unmatchedUsers} record(s) reference a user that no longer exists; ` +
        "their school stays unset and the report will show them as 未綁定學校.",
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Backfill failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
