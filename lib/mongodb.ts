import mongoose from "mongoose";

// Cache the connection to avoid reconnecting on every request in dev (HMR)
const cached = (globalThis as Record<string, unknown>).__mongoose as
  | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
  | undefined;

const mongoCache = cached ?? { conn: null, promise: null };
(globalThis as Record<string, unknown>).__mongoose = mongoCache;

/** mongoose readyState values. */
const CONNECTED = 1;
const CONNECTING = 2;

/**
 * Open (or reuse) the shared mongoose connection.
 *
 * The decision to reuse is made from the live `readyState`, never from the
 * presence of a cached object. `mongoCache` lives on `globalThis` so it survives
 * a hot reload, but the connection behind it does not always survive with it:
 * after a recompile the models are registered against a mongoose instance whose
 * readyState is back to 0. Returning the cached object in that state made this
 * function report success while every query sat in mongoose's buffer until it
 * died with `Operation "users.findOne()" buffering timed out after 10000ms` —
 * which looks like a dead database rather than a stale cache.
 */
export async function connectDB() {
  if (mongoose.connection.readyState === CONNECTED) {
    mongoCache.conn = mongoose;
    return mongoose;
  }

  // A connect already in flight is worth waiting for. Anything else means the
  // cache describes a connection that no longer exists — including a *resolved*
  // promise, which would otherwise hand back "connected" for a dead socket.
  if (mongoose.connection.readyState !== CONNECTING) {
    mongoCache.conn = null;
    mongoCache.promise = null;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }

  if (!mongoCache.promise) {
    // Assigned before the first await, so concurrent callers share one attempt.
    mongoCache.promise = mongoose
      .connect(uri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 30000,
      })
      .catch((err) => {
        // Never leave a rejected promise in the cache: every later request would
        // reuse this one failure instead of retrying the database.
        mongoCache.promise = null;
        throw err;
      });
  }

  mongoCache.conn = await mongoCache.promise;
  return mongoCache.conn;
}
