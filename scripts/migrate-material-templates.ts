/**
 * One-off migration: move 學校資源 from per-school layouts to named templates.
 *
 * Before, each school had its own `SchoolMaterialLayout` document per subject and
 * a subject had at most one nameless 範本 that an admin could copy over every
 * school at once. Now a 資源範本 is named, carries its own 適用學校 list, and is
 * read directly by /api/learning-materials — so saving one applies immediately and
 * the per-school copies are gone.
 *
 * What this does:
 *   1. drops the legacy unique index on `subject`, which enforced one template
 *      per subject (an index already built in the collection is never rewritten
 *      by a schema change, so this cannot be left to Mongoose),
 *   2. names any template that predates `name`,
 *   3. folds every existing per-school layout into templates: schools that share
 *      the same groups end up on one template, and a school whose layout already
 *      matches a template is simply attached to it, and
 *   4. builds the unique index on `{ subject, name }`.
 *
 * This is required, not optional. Until it runs, schools keep reading nothing
 * (their layouts are no longer consulted) and 新增範本 fails for any subject that
 * already has a template.
 *
 * The old `schoolmateriallayouts` collection is left in place as a backup. Once
 * 學校資源 looks right in the admin UI it can be dropped by hand; nothing reads it.
 *
 * Safe to re-run: every step is skipped when already done, and a school that some
 * template already covers is never moved.
 *
 * Usage (inside Docker — the tools profile supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/migrate-material-templates.ts --dry-run
 *   docker compose run --rm tools npx tsx scripts/migrate-material-templates.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/migrate-material-templates.ts --dry-run
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { MaterialTemplate } from "../models/MaterialTemplate";

const MONGODB_URI = requireMongoUri();
const DRY_RUN = process.argv.includes("--dry-run");

/** What a nameless legacy template becomes. */
const LEGACY_NAME = "預設範本";
/** What a template imported from per-school layouts is called. */
const IMPORTED_NAME = "原有設定";

const LEGACY_COLLECTION = "schoolmateriallayouts";

type IndexInfo = {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
};

type LegacyGroup = { name?: string; materials?: mongoose.Types.ObjectId[] };

type TemplateDoc = {
  _id: mongoose.Types.ObjectId;
  subject?: string;
  name?: string;
  schools?: mongoose.Types.ObjectId[];
  groups?: LegacyGroup[];
};

type LegacyLayout = {
  _id: mongoose.Types.ObjectId;
  school?: mongoose.Types.ObjectId;
  subject?: string;
  groups?: LegacyGroup[];
};

/** The legacy index is the one keyed on `subject` alone and marked unique. */
function isLegacySubjectIndex(index: IndexInfo): boolean {
  const keys = Object.keys(index.key ?? {});
  return keys.length === 1 && keys[0] === "subject" && index.unique === true;
}

/**
 * Identity of a layout's contents: group names and material ids, in order. Two
 * schools with the same key can share one template, which is the whole point of
 * the import — otherwise every school would get a near-duplicate.
 */
function groupsKey(groups: LegacyGroup[] | undefined): string {
  return JSON.stringify(
    (groups ?? []).map((g) => [String(g.name ?? ""), (g.materials ?? []).map((m) => String(m))]),
  );
}

function pickName(base: string, used: Set<string>): string {
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${base} ${n}`;
  used.add(name);
  return name;
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const templates = MaterialTemplate.collection;
    const db = mongoose.connection.db!;

    // ── 1. the legacy unique index ────────────────────────────────────────────
    // listIndexes throws NamespaceNotFound (26) when no template was ever saved,
    // which is a perfectly normal state for a fresh install.
    let indexes: IndexInfo[] = [];
    try {
      indexes = (await templates.listIndexes().toArray()) as unknown as IndexInfo[];
    } catch (err) {
      if ((err as { code?: number }).code !== 26) throw err;
      console.log("No materialtemplates collection yet.");
    }

    const legacy = indexes.find(isLegacySubjectIndex);
    if (legacy) {
      if (DRY_RUN) {
        console.log(`Would drop legacy unique index "${legacy.name}" on { subject: 1 }.`);
      } else {
        await templates.dropIndex(legacy.name);
        console.log(`Dropped legacy unique index "${legacy.name}".`);
      }
    } else {
      console.log("No legacy unique index on { subject: 1 } — already dropped.");
    }

    // ── 2. name the templates that predate `name` ─────────────────────────────
    // Read through the raw collection: these documents are missing a field the
    // schema now requires, which makes them unsaveable through the model.
    const existing = await templates.find<TemplateDoc>({}).toArray();

    /** Names already taken per subject, so both steps below stay unique. */
    const namesBySubject = new Map<string, Set<string>>();
    const namesOf = (subject: string) => {
      if (!namesBySubject.has(subject)) namesBySubject.set(subject, new Set());
      return namesBySubject.get(subject)!;
    };
    for (const doc of existing) {
      if (doc.name) namesOf(String(doc.subject ?? "")).add(String(doc.name));
    }

    const nameless = existing.filter((d) => !d.name);
    if (nameless.length === 0) {
      console.log("Every template already has a name.");
    } else {
      for (const doc of nameless) {
        const subject = String(doc.subject ?? "");
        const name = pickName(LEGACY_NAME, namesOf(subject));
        doc.name = name;

        if (DRY_RUN) {
          console.log(`Would name ${subject} template ${doc._id} "${name}".`);
        } else {
          await templates.updateOne({ _id: doc._id }, { $set: { name } });
          console.log(`Named ${subject} template ${doc._id} "${name}".`);
        }
      }
    }

    // ── 3. fold the per-school layouts into templates ─────────────────────────
    const hasLegacyCollection = (
      await db.listCollections({ name: LEGACY_COLLECTION }).toArray()
    ).length > 0;

    if (!hasLegacyCollection) {
      console.log(`No ${LEGACY_COLLECTION} collection — nothing to import.`);
    } else {
      const layouts = await db
        .collection(LEGACY_COLLECTION)
        .find<LegacyLayout>({})
        .toArray();

      /** Schools already claimed by a template, which must not be moved. */
      const claimed = new Map<string, Set<string>>();
      /** Existing templates keyed by contents, so a match is reused not duplicated. */
      const byContents = new Map<string, TemplateDoc>();
      for (const doc of existing) {
        const subject = String(doc.subject ?? "");
        if (!claimed.has(subject)) claimed.set(subject, new Set());
        for (const s of doc.schools ?? []) claimed.get(subject)!.add(String(s));
        byContents.set(`${subject}|${groupsKey(doc.groups)}`, doc);
      }

      /** Schools to add to a template that already exists. */
      const attach = new Map<string, Set<string>>();
      /** Templates to create, keyed the same way. */
      const create = new Map<
        string,
        { subject: string; name: string; groups: LegacyGroup[]; schools: string[] }
      >();

      let skippedEmpty = 0;
      let skippedClaimed = 0;

      for (const layout of layouts) {
        const subject = String(layout.subject ?? "");
        const schoolId = String(layout.school ?? "");
        if (!subject || !schoolId) continue;

        if ((layout.groups ?? []).length === 0) {
          skippedEmpty++;
          continue;
        }
        if (claimed.get(subject)?.has(schoolId)) {
          skippedClaimed++;
          continue;
        }

        const key = `${subject}|${groupsKey(layout.groups)}`;

        const match = byContents.get(key);
        if (match) {
          if (!attach.has(String(match._id))) attach.set(String(match._id), new Set());
          attach.get(String(match._id))!.add(schoolId);
          continue;
        }

        const pending = create.get(key);
        if (pending) {
          pending.schools.push(schoolId);
          continue;
        }
        create.set(key, {
          subject,
          name: pickName(IMPORTED_NAME, namesOf(subject)),
          groups: layout.groups ?? [],
          schools: [schoolId],
        });
      }

      if (skippedEmpty > 0) console.log(`Skipped ${skippedEmpty} empty layout(s).`);
      if (skippedClaimed > 0) {
        console.log(`Skipped ${skippedClaimed} layout(s) whose school a template already covers.`);
      }

      if (attach.size === 0 && create.size === 0) {
        console.log("No layouts left to import.");
      }

      for (const [templateId, schoolIds] of attach) {
        const ids = [...schoolIds];
        const doc = existing.find((d) => String(d._id) === templateId);
        if (DRY_RUN) {
          console.log(`Would attach ${ids.length} school(s) to "${doc?.name}" (${doc?.subject}).`);
        } else {
          await templates.updateOne(
            { _id: new mongoose.Types.ObjectId(templateId) },
            { $addToSet: { schools: { $each: ids.map((id) => new mongoose.Types.ObjectId(id)) } } },
          );
          console.log(`Attached ${ids.length} school(s) to "${doc?.name}" (${doc?.subject}).`);
        }
      }

      for (const plan of create.values()) {
        if (DRY_RUN) {
          console.log(
            `Would create ${plan.subject} template "${plan.name}" ` +
              `with ${plan.groups.length} group(s) for ${plan.schools.length} school(s).`,
          );
        } else {
          const now = new Date();
          await templates.insertOne({
            subject: plan.subject,
            name: plan.name,
            schools: plan.schools.map((id) => new mongoose.Types.ObjectId(id)),
            groups: plan.groups.map((g) => ({
              name: String(g.name ?? ""),
              materials: [...(g.materials ?? [])],
            })),
            createdAt: now,
            updatedAt: now,
          });
          console.log(
            `Created ${plan.subject} template "${plan.name}" for ${plan.schools.length} school(s).`,
          );
        }
      }
    }

    // ── 4. the new unique index ───────────────────────────────────────────────
    const hasCompound = indexes.some((i) => {
      const keys = Object.keys(i.key ?? {});
      return keys.length === 2 && keys[0] === "subject" && keys[1] === "name";
    });

    if (hasCompound) {
      console.log("Unique index on { subject, name } already exists.");
    } else if (DRY_RUN) {
      console.log("Would create unique index on { subject: 1, name: 1 }.");
    } else {
      await templates.createIndex({ subject: 1, name: 1 }, { unique: true });
      console.log("Created unique index on { subject: 1, name: 1 }.");
    }

    if (hasLegacyCollection) {
      console.log(
        `\nNothing reads ${LEGACY_COLLECTION} any more. Check 學校資源 in the admin UI, ` +
          `then drop that collection when you are satisfied.`,
      );
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log(DRY_RUN ? "Dry run complete — nothing was written." : "Done.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
