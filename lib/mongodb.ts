import mongoose from "mongoose";

// Cache the connection to avoid reconnecting on every request in dev (HMR)
const cached = (globalThis as Record<string, unknown>).__mongoose as
  | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
  | undefined;

const mongoCache = cached ?? { conn: null, promise: null };
(globalThis as Record<string, unknown>).__mongoose = mongoCache;

export async function connectDB() {
  if (mongoCache.conn) return mongoCache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }

  if (!mongoCache.promise) {
    mongoCache.promise = mongoose.connect(uri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000,
    });
  }

  mongoCache.conn = await mongoCache.promise;
  return mongoCache.conn;
}
