/**
 * Seed script: create the initial platform administrator.
 *
 * Admins are global (school: null) and bypass subject restrictions. Run this
 * once to bootstrap access to the /admin area, then manage everything from the
 * UI. A fresh database has no users at all and /login is the only public page,
 * so the deployment is unusable until this has run.
 *
 * Usage (inside Docker — the tools profile already supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/seed-admin.ts
 *   docker compose run --rm -e ADMIN_USERNAME=root -e ADMIN_PASSWORD='...' \
 *     tools npx tsx scripts/seed-admin.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/seed-admin.ts
 *
 * Recover a locked-out admin by resetting its password:
 *   ADMIN_RESET=1 ADMIN_PASSWORD=newSecret123 npx tsx scripts/seed-admin.ts
 *
 * Env: ADMIN_USERNAME (admin) · ADMIN_PASSWORD (admin123) ·
 *      ADMIN_DISPLAY (Administrator) · ADMIN_RESET (unset)
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireMongoUri } from "./lib/load-env";
import { User } from "../models/User";

const MONGODB_URI = requireMongoUri();
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_DISPLAY = process.env.ADMIN_DISPLAY || "Administrator";
const ADMIN_RESET = process.env.ADMIN_RESET === "1";

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const existing = await User.findOne({ username: ADMIN_USERNAME });

  if (existing) {
    if (!ADMIN_RESET) {
      console.log(
        `Admin "${ADMIN_USERNAME}" already exists — skipping. ` +
          "Use ADMIN_RESET=1 with ADMIN_PASSWORD to reset its password.",
      );
    } else {
      existing.hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      // Force the account back to a usable global admin: a demoted or
      // school-scoped account is exactly the state you are recovering from.
      existing.role = "admin";
      existing.school = null;
      await existing.save();
      console.log(`Reset "${ADMIN_USERNAME}" to a global admin. Password: ${ADMIN_PASSWORD}`);
    }
  } else {
    await User.create({
      username: ADMIN_USERNAME,
      hashedPassword: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: "admin",
      displayName: ADMIN_DISPLAY,
      school: null,
      subjects: [],
    });
    console.log(`Created admin "${ADMIN_USERNAME}" (password: ${ADMIN_PASSWORD}).`);
  }

  if (ADMIN_PASSWORD === "admin123") {
    console.warn("\nWARNING: using the default password. Change it from the admin UI now.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
