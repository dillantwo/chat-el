/**
 * One-off migration: stamp `authProvider: "local"` on users created before the
 * field existed.
 *
 * Nothing breaks without this. Every read path normalizes a missing value
 * through `resolveAuthProvider()`, which returns "local". The reason to run it
 * anyway is queries: `{ authProvider: "local" }` is an equality match that skips
 * documents lacking the field, so the 使用者管理 filter has to be written as
 * `{ $ne: "edconnect" }` to compensate. Backfilling once lets that stay a
 * detail of the rollout rather than a permanent shape every future query has to
 * remember.
 *
 * Only documents with no `authProvider` at all are touched, so it is safe to run
 * repeatedly and cannot convert an EdConnect account into a password account.
 *
 * Usage (inside Docker — the tools profile supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/backfill-auth-provider.ts --dry-run
 *   docker compose run --rm tools npx tsx scripts/backfill-auth-provider.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/backfill-auth-provider.ts --dry-run
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { User } from "../models/User";

const MONGODB_URI = requireMongoUri();
const DRY_RUN = process.argv.includes("--dry-run");

async function backfill() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const filter = { authProvider: { $exists: false } };
    const pending = await User.countDocuments(filter);

    if (pending === 0) {
      console.log("Nothing to do: every user already has an authProvider.");
      return;
    }

    if (DRY_RUN) {
      console.log(`Would set authProvider="local" on ${pending} user(s).`);
      const sample = await User.find(filter).select({ username: 1, role: 1 }).limit(10).lean();
      for (const u of sample) console.log(`  - ${u.username} (${u.role})`);
      if (pending > sample.length) console.log(`  ... and ${pending - sample.length} more`);
      return;
    }

    const result = await User.updateMany(filter, { $set: { authProvider: "local" } });
    console.log(`Updated ${result.modifiedCount} of ${pending} user(s).`);
  } finally {
    await mongoose.disconnect();
  }

  console.log("Done.");
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
