/**
 * Seed script: create a demo teacher + student inside one school.
 *
 * This is a convenience for development and smoke-testing a fresh install. It
 * is NOT meant for a real deployment — create real accounts from /admin/users
 * or with scripts/create-user.ts, which takes a password per account.
 *
 * Replaces the old inline User schema, which had no `school` field: the accounts
 * it created had school: null, and app/api/auth/login/route.ts rejects any
 * non-admin without an active school, so neither demo account could log in.
 * A school is now required, and its enabled subjects bound what gets granted.
 *
 * Usage (inside Docker — the tools profile already supplies MONGODB_URI):
 *   docker compose run --rm -e SEED_SCHOOL_CODE=demo -e SEED_PASSWORD='...' \
 *     tools npx tsx scripts/seed-users.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   SEED_SCHOOL_CODE=demo npx tsx scripts/seed-users.ts
 *
 * Env:
 *   SEED_SCHOOL_CODE  (required) code of an existing active school
 *   SEED_PASSWORD     (optional) password for both accounts, default "aidcec"
 *
 * Existing accounts are left completely untouched, passwords included.
 */

import mongoose from "mongoose";
import { hashPassword } from "../lib/password";
import { requireMongoUri } from "./lib/load-env";
import { ALL_SUBJECTS, User, type Subject, type UserRole } from "../models/User";
import { School } from "../models/School";

const MONGODB_URI = requireMongoUri();
const SCHOOL_CODE = (process.env.SEED_SCHOOL_CODE || "").trim().toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD || "aidcec";

/** `subjects` is intersected with the school's enabled set before writing. */
const USERS: { username: string; role: UserRole; displayName: string; subjects: Subject[] }[] = [
  {
    username: "teacher01",
    role: "teacher",
    displayName: "Teacher",
    subjects: ["math", "chinese", "english"],
  },
  {
    username: "student01",
    role: "student",
    displayName: "Student",
    subjects: ["math", "chinese"],
  },
];

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function seed() {
  if (!SCHOOL_CODE) {
    fail(
      "SEED_SCHOOL_CODE is required.\n" +
        "       Teachers and students must belong to an active school or they cannot log in.\n" +
        "       Create one in /admin/schools, then re-run with its code.",
    );
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const school = await School.findOne({ code: SCHOOL_CODE });
    if (!school) fail(`no school with code "${SCHOOL_CODE}".`);
    if (!school.active) {
      fail(`school "${SCHOOL_CODE}" is inactive — all of its users are blocked from logging in.`);
    }

    const enabled = ALL_SUBJECTS.filter((s) => school.enabledSubjects.includes(s));
    if (!enabled.length) {
      fail(`school "${SCHOOL_CODE}" has no enabled subjects, so the accounts would see nothing.`);
    }

    const hashedPassword = await hashPassword(PASSWORD);

    for (const u of USERS) {
      const existing = await User.findOne({ username: u.username });
      if (existing) {
        console.log(`= "${u.username}" already exists — left untouched.`);
        continue;
      }

      const subjects = u.subjects.filter((s) => enabled.includes(s));
      const skipped = u.subjects.filter((s) => !enabled.includes(s));

      await User.create({
        username: u.username,
        hashedPassword,
        role: u.role,
        displayName: u.displayName,
        school: school._id,
        subjects,
        // Teachers get student-data access to exactly what they teach, which
        // `canViewStudentData` defaults to — nothing to set here.
      });

      console.log(
        `+ created "${u.username}" (${u.role} @ ${school.code}) subjects: [${subjects.join(", ")}]` +
          (skipped.length ? ` — skipped (not enabled by school): ${skipped.join(", ")}` : ""),
      );
    }

    console.log(`\nPassword for newly created accounts: ${PASSWORD}`);
    if (PASSWORD === "aidcec") {
      console.warn("WARNING: this is the built-in demo password. Do not use it on a real server.");
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
