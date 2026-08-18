import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User, resolveAuthProvider } from "@/models/User";
import { establishSession } from "@/lib/auth-session";
import { hashPassword, isLegacyHash, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "用戶名和密碼不能為空" },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findOne({ username: username.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json({ error: "用戶名或密碼錯誤" }, { status: 401 });
    }

    // EdConnect accounts have no password at all, and their username is the
    // opaque profile_id. Refusing them here — before touching the hash — is
    // what keeps the two login routes mutually exclusive: whoever knows a
    // profile_id still cannot turn it into a password login attempt. The
    // message is deliberately specific, because this is a user pointed at the
    // wrong button rather than a failed guess.
    if (resolveAuthProvider(user.authProvider) === "edconnect") {
      return NextResponse.json(
        { error: "此帳戶請使用 EdCity 登入" },
        { status: 401 }
      );
    }

    if (!user.hashedPassword) {
      // A local account with no hash cannot be signed in. Report it as a
      // credential failure rather than leaking the account's broken state.
      console.error("[auth/login] local account without a password hash", user.username);
      return NextResponse.json({ error: "用戶名或密碼錯誤" }, { status: 401 });
    }

    const passwordMatch = await verifyPassword(password, user.hashedPassword);
    if (!passwordMatch) {
      return NextResponse.json({ error: "用戶名或密碼錯誤" }, { status: 401 });
    }

    // Upgrade bcrypt hashes to scrypt on the way through — this is the only
    // moment the plaintext is available. updateOne rather than user.save() so
    // no other path on the document is touched.
    if (isLegacyHash(user.hashedPassword)) {
      try {
        await User.updateOne(
          { _id: user._id },
          { $set: { hashedPassword: await hashPassword(password) } },
        );
      } catch (err) {
        // A failed upgrade must not block the login; it retries next time.
        console.error("[auth/login] password rehash failed", err);
      }
    }

    // School binding, school-active and subject-intersection rules, shared with
    // the EdConnect callback. Writes the session cookie on success.
    const result = await establishSession(user);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.identity);
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
