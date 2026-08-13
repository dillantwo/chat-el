/**
 * Create (or update) a single teacher / student account.
 *
 * Replaces the old scripts/create-user.cjs, which declared its own copy of the
 * User schema. That copy had drifted from models/User.ts and was missing the
 * `school` field entirely, so every account it created had school: null — and
 * app/api/auth/login/route.ts rejects any non-admin user without an active
 * school. The accounts looked fine in the database and could never log in.
 * This version imports the real model, so it cannot drift again, and it
 * requires --school for teacher/student so the account is usable.
 *
 * Usage (inside Docker — the tools profile already supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/create-user.ts \
 *     --username teacher02 --password 'S3cret!' --displayName 'Ms Chan' \
 *     --role teacher --school spc --subjects math,chinese,english
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/create-user.ts --username s01 --password '...' \
 *     --role student --school spc --subjects math
 *
 * Flags:
 *   --username      (required) login name, stored lowercase
 *   --password      (required) plaintext; hashed with bcrypt (12 rounds)
 *   --school        (required) the school's `code`, e.g. spc
 *   --displayName   (optional) defaults to the username
 *   --role          (optional) teacher | student   (default: teacher)
 *   --subjects      (optional) comma list; must be a subset of the school's
 *                              enabledSubjects. Defaults to none.
 *   --dataSubjects  (optional) teachers only — subjects whose student data they
 *                              may review. Omit to fall back to --subjects.
 *   --force         (optional) update an existing user instead of failing
 *
 * Admins are global and have no school, so they are not creatable here.
 * Use scripts/seed-admin.ts for those.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireMongoUri } from "./lib/load-env";
import { isDuplicateKeyError } from "../lib/duplicate-key";
import { ALL_SUBJECTS, User, type Subject, type UserRole } from "../models/User";
import { School } from "../models/School";

const ASSIGNABLE_ROLES: UserRole[] = ["teacher", "student"];

type Args = Record<string, string | true>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith("--")) {
      args[key] = true; // boolean flag, e.g. --force
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

/** Parse a comma list of subjects, rejecting anything outside ALL_SUBJECTS. */
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

async function main() {
  const MONGODB_URI = requireMongoUri();
  const args = parseArgs(process.argv.slice(2));

  const username = str(args, "username").toLowerCase();
  const password = typeof args.password === "string" ? args.password : "";
  const schoolCode = str(args, "school").toLowerCase();
  const role = (str(args, "role") || "teacher") as UserRole;
  const displayName = str(args, "displayName") || username;
  const force = args.force === true;

  if (!username) fail("--username is required.");
  if (!password) fail("--password is required.");
  if (!ASSIGNABLE_ROLES.includes(role)) {
    fail(`--role must be one of: ${ASSIGNABLE_ROLES.join(", ")} (use seed-admin.ts for admins)`);
  }
  if (!schoolCode) {
    fail(
      "--school is required.\n" +
        "       Teachers and students must belong to an active school or they cannot log in.\n" +
        "       Pass the school's code, e.g. --school spc. Create schools in /admin/schools.",
    );
  }

  const subjects = parseSubjects(str(args, "subjects"), "subjects");
  const hasDataSubjects = typeof args.dataSubjects === "string";
  const dataSubjects = hasDataSubjects
    ? parseSubjects(str(args, "dataSubjects"), "dataSubjects")
    : undefined;

  if (dataSubjects && role !== "teacher") {
    fail("--dataSubjects only applies to teachers.");
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const school = await School.findOne({ code: schoolCode });
    if (!school) {
      const known = await School.find().select({ code: 1, name: 1 }).lean<
        { code: string; name: string }[]
      >();
      fail(
        `no school with code "${schoolCode}".\n` +
          (known.length
            ? `       known codes: ${known.map((s) => `${s.code} (${s.name})`).join(", ")}`
            : "       no schools exist yet — create one in /admin/schools first."),
      );
    }

    // Mirror the login checks so a created account is actually usable, rather
    // than failing later with a message the operator cannot connect to this run.
    if (!school.active) {
      fail(`school "${schoolCode}" is inactive — all of its users are blocked from logging in.`);
    }

    const notEnabled = subjects.filter((s) => !school.enabledSubjects.includes(s));
    if (notEnabled.length) {
      fail(
        `school "${schoolCode}" does not have these subjects enabled: ${notEnabled.join(", ")}\n` +
          `       enabled: ${school.enabledSubjects.join(", ") || "(none)"}\n` +
          "       Login intersects a user's subjects with the school's, so these would be dropped.",
      );
    }

    const outOfScope = dataSubjects?.filter((s) => !subjects.includes(s)) ?? [];
    if (outOfScope.length) {
      fail(`--dataSubjects must be a subset of --subjects; extra: ${outOfScope.join(", ")}`);
    }

    const existing = await User.findOne({ username });

    if (existing && !force) {
      fail(`user "${username}" already exists. Re-run with --force to update it.`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    if (existing) {
      if (existing.role === "admin") {
        fail(
          `"${username}" is an admin. Refusing to demote it to ${role} — ` +
            "that could lock you out of /admin. Use the admin UI if this is intended.",
        );
      }

      existing.hashedPassword = hashedPassword;
      existing.role = role;
      existing.displayName = displayName;
      existing.school = school._id as mongoose.Types.ObjectId;
      existing.subjects = subjects;
      if (dataSubjects) existing.dataSubjects = dataSubjects;
      await existing.save();

      console.log(`Updated "${username}".`);
    } else {
      await User.create({
        username,
        hashedPassword,
        role,
        displayName,
        school: school._id,
        subjects,
        ...(dataSubjects ? { dataSubjects } : {}),
      });

      console.log(`Created "${username}".`);
    }

    console.log(`  role     : ${role}`);
    console.log(`  school   : ${school.code} (${school.name})`);
    console.log(`  subjects : [${subjects.join(", ")}]`);
    if (dataSubjects) console.log(`  data     : [${dataSubjects.join(", ")}]`);
  } catch (err) {
    // Same non-atomic findOne/create pattern as the admin API. Far less likely
    // from a CLI, but a raw E11000 stack trace would not tell the operator that
    // the name is simply taken.
    if (isDuplicateKeyError(err)) {
      fail(`user "${username}" already exists. Re-run with --force to update it.`);
    }
    throw err;
  } finally {
    await mongoose.disconnect();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
