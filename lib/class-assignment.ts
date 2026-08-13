import "server-only";
import mongoose from "mongoose";
import { Class } from "@/models/Class";

/**
 * Resolve a requested list of class ids down to the ones that actually exist
 * inside `schoolId`, dropping anything malformed or belonging to another school.
 *
 * This is the single guard that keeps class assignment inside school
 * boundaries — without it an admin could put a student in another school's
 * class and expose their records to that school's teachers.
 *
 * Disabled classes are intentionally still resolvable: they are a labelling
 * state, so re-saving a user must not silently drop their existing assignment.
 */
export async function resolveClassesForSchool(
  input: unknown,
  // Accepts whatever the caller has to hand (ObjectId, string, or a Mongoose
  // document `_id`), since Mongoose casts the query value anyway.
  schoolId: unknown,
): Promise<mongoose.Types.ObjectId[]> {
  if (!schoolId || !Array.isArray(input) || input.length === 0) return [];

  const requested = input
    .map((value) => String(value ?? ""))
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

  if (requested.length === 0) return [];

  const found = await Class.find({ _id: { $in: requested }, school: String(schoolId) })
    .select({ _id: 1 })
    .lean<{ _id: mongoose.Types.ObjectId }[]>();

  return found.map((c) => c._id);
}
