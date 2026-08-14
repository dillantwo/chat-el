import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

/**
 * Password hashing for every account in the app.
 *
 * scrypt from node:crypto rather than bcryptjs, because bcryptjs is a pure-JS
 * implementation and spends its whole cost on the event loop. Measured on a dev
 * machine: one cost-12 comparison takes 228ms of CPU and stalls the loop for up
 * to ~191ms in one stretch, and 100 simultaneous logins need ~23s per Node
 * process. node's scrypt runs on the libuv threadpool, so the same 100 logins
 * finish in ~0.8s with a worst-case loop stall of ~5ms.
 *
 * That difference decides whether a class works: 100-200 students sign in
 * within the same minute, and the AI chat responses stream from the same event
 * loop, so blocking it delays every conversation already in flight.
 *
 * Stored format:
 *   scrypt$<N>$<r>$<p>$<salt base64>$<key base64>
 *
 * Hashes beginning with `$2` are bcrypt, written before this change. They still
 * verify, and the login route rewrites them to scrypt on the next successful
 * sign-in, so no password reset is needed.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Cost parameters. Memory per hash is 128 * N * r, i.e. 16MB here. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
/** Node's default cap is 32MB; raising it leaves room for a future N increase. */
const MAXMEM = 64 * 1024 * 1024;
const PREFIX = "scrypt";

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(plain, salt, KEY_BYTES, { N, r: R, p: P, maxmem: MAXMEM });
  return [PREFIX, N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/** True for a bcrypt hash written before the move to scrypt. */
export function isLegacyHash(stored: string): boolean {
  return stored.startsWith("$2");
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false;
  if (isLegacyHash(stored)) return bcrypt.compare(plain, stored);
  return verifyScrypt(plain, stored);
}

async function verifyScrypt(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  // Cost parameters come from the stored hash, so hashes written with older
  // settings keep verifying after the constants above are raised.
  const actual = await scrypt(plain, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
