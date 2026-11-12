// Exchanges a Firebase ID token (from the client SDK) for an httpOnly session cookie, and clears it.
import { cookies } from "next/headers";
import { adminAuth, adminConfigured } from "@/lib/auth/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!adminConfigured) return Response.json({ error: "Auth is not configured on the server." }, { status: 503 });
  const { idToken } = (await request.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return Response.json({ error: "Missing idToken" }, { status: 400 });

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    // Only mint sessions from a recent sign-in.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return Response.json({ error: "Please sign in again." }, { status: 401 });
    }
    const session = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    (await cookies()).set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return Response.json({ admin: decoded.admin === true });
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
