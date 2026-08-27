/**
 * Update ONLY a user's subject permissions — leaving the password, role,
 * display name and school untouched (unlike create-user.ts --force).
 *
 * Replaces the old scripts/update-user-subjects.cjs, whose inline copy of the
 * User schema declared `role` as an enum of teacher|student only. Loading an
 * admin through it and calling save() threw a ValidationError, and its schema
 * also lacked school / classes. This version imports the real model, so it
 * stays in step with models/User.ts.
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
 *
 * For a teacher this also changes which student data they may review in
 * 查看學生數據: that follows `subjects`, so revoking a subject here revokes its
 * student data too. Use scripts/create-user.ts --noStudentData (or the admin UI)
 * to switch the feature off without touching the subjects.
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { ALL_SUBJECTS, User, canViewStudentData, type Subject } from "../models/User";
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

    user.subjects = after;

    await user.save();

    console.log(`Updated "${username}" (${user.role} @ ${school.code}):`);
    console.log(`  subjects before: [${before.join(", ")}]`);
    console.log(`  subjects after : [${after.join(", ")}]`);
    if (user.role === "teacher") {
      // Student data follows the subjects, so the only extra thing worth
      // reporting is whether the feature is switched off for this teacher.
      console.log(
        `  student data   : ${canViewStudentData(user) ? `[${after.join(", ")}]` : "已關閉"}`,
      );
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
