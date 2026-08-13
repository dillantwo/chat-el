/**
 * Update ONLY a user's subject permissions — leaving the password, role,
 * display name and school untouched (unlike create-user.ts --force).
 *
 * Replaces the old scripts/update-user-subjects.cjs, whose inline copy of the
 * User schema declared `role` as an enum of teacher|student only. Loading an
 * admin through it and calling save() threw a ValidationError, and its schema
 * also lacked school / dataSubjects / classes. This version imports the real
 * model, so it stays in step with models/User.ts.
 *
 * Usage (inside Docker — the tools profile already supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/update-user-subjects.ts \
 *     --username teacher01 --subjects math,chinese,science
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   # Grant every subject the school has enabled (the default):
 *   npx tsx scripts/update-user-subjects.ts --username teacher01
 *
 *   # Add to what the user already has, removing nothing:
 *   npx tsx scripts/update-user-subjects.ts --username teacher01 --subjects science --add
 *
 * Flags:
 *   --username      (required) login name, matched lowercased
 *   --subjects      (optional) comma list; defaults to the school's enabled set
 *   --add           (optional) merge with current subjects instead of replacing
 *   --dataSubjects  (optional) teachers only — subjects whose student data they
 *                              may review. Always narrowed to --subjects.
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { ALL_SUBJECTS, User, effectiveDataSubjects, type Subject } from "../models/User";
import { School } from "../models/School";

type Args = Record<string, string | true>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith("--")) {
      args[key] = true; // boolean flag, e.g. --add
    } else {
      args[key] = next;
      i++;
    }
  }

  return args;
}

function str(args: Args, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseSubjects(raw: string, flag: string): Subject[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const bad = parts.filter((s) => !ALL_SUBJECTS.includes(s as Subject));
  if (bad.length) {
    fail(`invalid --${flag}: ${bad.join(", ")}\n       allowed: ${ALL_SUBJECTS.join(", ")}`);
  }

  return [...new Set(parts as Subject[])];
}

/** Keep ALL_SUBJECTS order so output and stored arrays stay comparable. */
function canonical(subjects: Subject[]): Subject[] {
  return ALL_SUBJECTS.filter((s) => subjects.includes(s));
}

async function main() {
  const MONGODB_URI = requireMongoUri();
  const args = parseArgs(process.argv.slice(2));

  const username = str(args, "username").toLowerCase();
  if (!username) fail("--username is required.");

  const merge = args.add === true;
  const explicitSubjects = typeof args.subjects === "string";
  const requested = explicitSubjects ? parseSubjects(str(args, "subjects"), "subjects") : null;
  const hasDataSubjects = typeof args.dataSubjects === "string";
  const requestedData = hasDataSubjects
    ? parseSubjects(str(args, "dataSubjects"), "dataSubjects")
    : null;

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const user = await User.findOne({ username });
    if (!user) fail(`user "${username}" not found.`);

    if (user.role === "admin") {
      fail(
        `"${username}" is an admin. Admins bypass subject restrictions entirely ` +
          "(see proxy.ts), so setting subjects on them has no effect.",
      );
    }

    // Login intersects the user's subjects with the school's enabled set, so an
    // unavailable subject cannot be granted here either — it would silently
    // vanish at the next login and look like this script had failed.
    const school = await School.findById(user.school);
    if (!school) {
      fail(
        `user "${username}" has no school (school: ${String(user.school)}).\n` +
          "       Non-admins need an active school to log in. Fix it with:\n" +
          `       npx tsx scripts/create-user.ts --username ${username} --force ...`,
      );
    }

    const allowed = canonical(school.enabledSubjects);
    const before = canonical(user.subjects ?? []);
    const beforeData = canonical(effectiveDataSubjects(user));

    // Default: everything the school has enabled.
    const target = requested ?? allowed;

    const notEnabled = target.filter((s) => !allowed.includes(s));
    if (notEnabled.length) {
      fail(
        `school "${school.code}" does not have these subjects enabled: ${notEnabled.join(", ")}\n` +
          `       enabled: ${allowed.join(", ") || "(none)"}`,
      );
    }

    const after = merge ? canonical([...before, ...target]) : canonical(target);

    if (requestedData) {
      const outOfScope = requestedData.filter((s) => !after.includes(s));
      if (outOfScope.length) {
        fail(
          "--dataSubjects must be a subset of the resulting subjects; " +
            `extra: ${outOfScope.join(", ")}`,
        );
      }
    }

    user.subjects = after;

    // Narrow dataSubjects to the new subject set. Without this, revoking a
    // subject would leave the teacher still able to read that subject's student
    // data in 查看學生數據, because that check reads dataSubjects, not subjects.
    const afterData = canonical(requestedData ?? beforeData).filter((s) => after.includes(s));
    const dataChanged =
      afterData.join(",") !== beforeData.join(",") || requestedData !== null;
    if (user.role === "teacher" && dataChanged) {
      user.dataSubjects = afterData;
    }

    await user.save();

    console.log(`Updated "${username}" (${user.role} @ ${school.code}):`);
    console.log(`  subjects before: [${before.join(", ")}]`);
    console.log(`  subjects after : [${after.join(", ")}]`);
    if (user.role === "teacher") {
      console.log(`  data before    : [${beforeData.join(", ")}]`);
      console.log(`  data after     : [${canonical(effectiveDataSubjects(user)).join(", ")}]`);
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
