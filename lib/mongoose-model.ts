import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Register a mongoose model, tolerating hot reloads.
 *
 * Mongoose keeps its compiled models on the mongoose singleton, and `next dev`
 * keeps one Node process alive across hot reloads, so the plain
 * `mongoose.models.X ?? mongoose.model(...)` idiom hands back a model compiled
 * from an *older* version of the schema after you edit a model file. Writes to a
 * field added in that edit are then dropped **silently**, because mongoose's
 * strict mode ignores paths the compiled schema does not know: the API responds
 * 200 with the new value (the in-memory document did accept it) while the
 * database keeps the old one. That failure mode is very hard to read from the
 * outside, so it is worth preventing rather than remembering to restart.
 *
 * In development the stale model is therefore discarded and rebuilt from the
 * schema as written. In production the process starts clean and each model is
 * registered once, so the existing model is reused as before.
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;

  if (existing) {
    // Reusing it is correct in production and avoids an OverwriteModelError if a
    // module ever gets evaluated twice.
    if (process.env.NODE_ENV === "production") return existing;
    mongoose.deleteModel(name);
  }

  return mongoose.model<T>(name, schema);
}
