/**
 * One-off migration: replace the per-teacher `dataSubjects` list with the
 * `canViewStudentData` switch.
 *
 * Student-data access used to be configured twice — once as 科目權限
 * (`User.subjects`, which tools a teacher may use) and again as a separate list
 * of subjects whose student records they could review (`User.dataSubjects`).
 * Every write path defaulted the second to the first, so the two were identical
 * for almost every teacher. Holding a subject now grants that subject's student
 * data outright, and the only remaining question is whether 查看學生數據 is
 * available to a teacher at all.
 *
 * What this does:
 *   1. sets `canViewStudentData: true` on every user that lacks the field, and
 *   2. removes the obsolete `dataSubjects` field from every user.
 *
 * Nothing breaks without it. `canViewStudentData()` reads a missing field as
 * true, and no code reads `dataSubjects` any more. Run it anyway so the
 * documents match the schema and the stale field cannot be mistaken for a live
 * permission later.
 *
 * WIDENING: a teacher whose `dataSubjects` was narrower than their `subjects`
 * gains access to the difference — that is the point of the change, not a side
 * effect. --dry-run lists exactly who those teachers are before anything is
 * written, so review that output first. To keep one of them locked out, turn the
 * switch off for them in /admin/users after migrating.
 *
 * `dataSubjects` is read and unset through the raw collection because it is no
 * longer part of the schema, and Mongoose strips unknown paths from updates.
 *
 * Usage (inside Docker — the tools profile supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/migrate-student-data-access.ts --dry-run
 *   docker compose run --rm tools npx tsx scripts/migrate-student-data-access.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/migrate-student-data-access.ts --dry-run
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { ALL_SUBJECTS, User, type Subject } from "../models/User";

const MONGODB_URI = requireMongoUri();
const DRY_RUN = process.argv.includes("--dry-run");

type LegacyDoc = {
  username: string;
  role: string;
  subjects?: Subject[];
  dataSubjects?: Subject[];
};

/** Keep ALL_SUBJECTS order so two lists of the same subjects compare equal. */
function canonical(subjects: Subject[] | undefined): Subject[] {
  return ALL_SUBJECTS.filter((s) => (subjects ?? []).includes(s));
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const users = User.collection;

    // Report the teachers whose access widens, before touching anything.
    const legacy = await users
      .find<LegacyDoc>(
        { role: "teacher", dataSubjects: { $exists: true } },
        { projection: { username: 1, role: 1, subjects: 1, dataSubjects: 1 } },
      )
      .toArray();

    const widened = legacy
      .map((u) => {
        const subjects = canonical(u.subjects);
        const before = canonical(u.dataSubjects);
        return { username: u.username, before, gained: subjects.filter((s) => !before.includes(s)) };
      })
      .filter((u) => u.gained.length > 0);

    if (widened.length) {
      console.log(`\n${widened.length} teacher(s) gain student-data access:`);
      for (const u of widened) {
        console.log(
          `  - ${u.username}: [${u.before.join(", ") || "(none)"}] -> ` +
            `+[${u.gained.join(", ")}]`,
        );
      }
      console.log("");
    } else {
      console.log("No teacher's student-data access widens.");
    }

    const missingFlag = await users.countDocuments({ canViewStudentData: { $exists: false } });
    const staleField = await users.countDocuments({ dataSubjects: { $exists: true } });

    if (missingFlag === 0 && staleField === 0) {
      console.log("Nothing to do: already migrated.");
      return;
    }

    if (DRY_RUN) {
      console.log(`Would set canViewStudentData=true on ${missingFlag} user(s).`);
      console.log(`Would remove dataSubjects from ${staleField} user(s).`);
      return;
    }

    if (missingFlag > 0) {
      const set = await users.updateMany(
        { canViewStudentData: { $exists: false } },
        { $set: { canViewStudentData: true } },
      );
      console.log(`Set canViewStudentData=true on ${set.modifiedCount} of ${missingFlag} user(s).`);
    }

    if (staleField > 0) {
      const unset = await users.updateMany(
        { dataSubjects: { $exists: true } },
        { $unset: { dataSubjects: "" } },
      );
      console.log(`Removed dataSubjects from ${unset.modifiedCount} of ${staleField} user(s).`);
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log("Done.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
