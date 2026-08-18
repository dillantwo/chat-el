import { Schema, Document, Types } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

export type UserRole = "admin" | "teacher" | "student";

export type Subject = "math" | "chinese" | "english" | "science" | "humanities";

export const ALL_SUBJECTS: Subject[] = ["math", "chinese", "english", "science", "humanities"];

/**
 * How a user proves who they are. This is not a permission — it selects which
 * login route may sign the account in, and the two are mutually exclusive:
 *
 *  - "local"     → POST /api/auth/login with a password. Rejected by SSO.
 *  - "edconnect" → HKEdCity EdConnect OAuth 2.0. Rejected by password login.
 *
 * The exclusivity is the whole point. An EdConnect account's `username` holds
 * the opaque `profile_id` that EdConnect returns, so without this field any
 * account whose username happened to equal a valid profile_id could be entered
 * without a password, and conversely an SSO account with a password set would
 * be a silent second way in. Each route checks this field before authenticating.
 */
export type AuthProvider = "local" | "edconnect";

export const ALL_AUTH_PROVIDERS: AuthProvider[] = ["local", "edconnect"];

/**
 * Documents written before this field existed have no `authProvider`. Mongoose
 * applies the schema default when hydrating a full document, but `.lean()`
 * queries bypass that and yield `undefined`, so every read path normalizes
 * through this helper rather than trusting the field to be present.
 *
 * scripts/backfill-auth-provider.ts stamps the existing rows; this stays as the
 * safety net for anything written by an older running replica during the
 * rollout, and for queries that need `{ authProvider: { $ne: "edconnect" } }`
 * semantics rather than an equality match.
 */
export function resolveAuthProvider(value: unknown): AuthProvider {
  return value === "edconnect" ? "edconnect" : "local";
}

export interface IUser extends Document {
  /**
   * Login identifier. For "local" accounts this is a human-chosen name; for
   * "edconnect" accounts it is EdConnect's `profile_id`, lowercased by the
   * schema setter below (the callback must lowercase its lookup to match).
   */
  username: string;
  /**
   * scrypt hash. Absent on "edconnect" accounts, which have no password at all
   * rather than an unusable placeholder — see the conditional `required` below.
   */
  hashedPassword?: string;
  /** Which login route may authenticate this account. */
  authProvider: AuthProvider;
  /**
   * The user's readable HKEdCity login name (`hkedcity_id`), e.g. "hke-stud001".
   *
   * Never used for authentication — `username` alone decides that. This exists
   * because an EdConnect account's username is an opaque string like
   * "typny8njaooh", which is what /admin/users, /admin/token-usage and the
   * teacher-facing student list in components/student-data/StudentDataBrowser
   * would otherwise show next to a student's name. Purely for humans.
   */
  edcityLoginId?: string;
  role: UserRole;
  displayName: string;
  /**
   * The school this user belongs to. Required for teacher/student.
   * Admins are global and have no school (null).
   */
  school: Types.ObjectId | null;
  /** Subjects this user may access (must be a subset of the school's enabled subjects) */
  subjects: Subject[];
  /**
   * Subjects whose *student data* this teacher may review in 查看學生數據.
   * Teachers only; always a subset of the school's enabled subjects.
   *
   * Tri-state on purpose:
   *  - field absent  → not configured yet, falls back to `subjects`
   *  - `[]`          → explicitly no access to any subject's student data
   *  - `[...]`       → access to exactly those subjects
   *
   * The fallback keeps teachers created before this field existed working
   * without a migration. Resolve it with `effectiveDataSubjects()` rather
   * than reading the field directly.
   */
  dataSubjects?: Subject[];
  /**
   * Classes this user belongs to. Always within the user's own school.
   *
   * Both roles can hold several: a teacher teaches multiple classes, and a
   * student can sit in a homeroom class plus an elective group. For teachers
   * this is also the scope of 查看學生數據 — they only ever see students who
   * share a class with them, so a teacher with no class sees no students.
   */
  classes: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    hashedPassword: {
      type: String,
      // Required for password accounts only. An EdConnect account stores no
      // hash rather than a placeholder that can never match: a placeholder
      // looks like a credential in the database and invites someone to
      // "fix" it later, whereas an absent field makes verifyPassword's
      // `if (!plain || !stored) return false` guard the obvious outcome.
      required: function (this: { authProvider?: AuthProvider }) {
        return resolveAuthProvider(this.authProvider) === "local";
      },
    },
    authProvider: {
      type: String,
      enum: ALL_AUTH_PROVIDERS,
      default: "local",
      required: true,
      index: true,
    },
    // No default: absent means "not an EdConnect account, or not supplied".
    edcityLoginId: { type: String, trim: true, default: undefined },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    displayName: { type: String, required: true, trim: true },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    subjects: {
      type: [String],
      enum: ["math", "chinese", "english", "science", "humanities"],
      default: [],
    },
    dataSubjects: {
      type: [String],
      enum: ["math", "chinese", "english", "science", "humanities"],
      // No default: an absent field means "not configured", which is
      // meaningfully different from an empty array (see IUser.dataSubjects).
      default: undefined,
    },
    classes: {
      type: [{ type: Schema.Types.ObjectId, ref: "Class" }],
      default: [],
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * Which subjects' student data a teacher may review.
 * Falls back to their teaching subjects while `dataSubjects` is unset.
 */
export function effectiveDataSubjects(user: {
  subjects?: Subject[];
  dataSubjects?: Subject[] | null;
}): Subject[] {
  if (Array.isArray(user.dataSubjects)) return user.dataSubjects;
  return user.subjects ?? [];
}

export const User = defineModel<IUser>("User", UserSchema);
