// Exchanges a Firebase ID token (from the client SDK) for an httpOnly session cookie, and clears it.
import { cookies } from "next/headers";
import { adminAuth, adminConfigured } from "@/lib/auth/firebase-admin";
import { isAdminIdentity } from "@/lib/auth/admins";
import { ensureProfile } from "@/lib/profiles";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!adminConfigured) return Response.json({ error: "Auth is not configured on the server." }, { status: 503 });
  const { idToken } = (await request.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return Response.json({ error: "Missing idToken" }, { status: 400 });

  try {
    const auth = await adminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    // Only mint sessions from a recent sign-in.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return Response.json({ error: "Please sign in again." }, { status: 401 });
    }
    // Keep the Firebase `admin` claim in step with ADMIN_EMAILS. The server decides admin access from the list
    // on every request; the claim is what firestore.rules and the browser use (e.g. deleting any comment).
    const admin = isAdminIdentity(decoded);
    let claimChanged = false;
    if ((decoded.admin === true) !== admin) {
      const user = await auth.getUser(decoded.uid);
      await auth.setCustomUserClaims(decoded.uid, { ...(user.customClaims ?? {}), admin });
      claimChanged = true;
    }
    // First sign-in: give the account its random palette colour (no-op afterwards). Best-effort — a
    // Firestore hiccup shouldn't block signing in; the browser falls back to a colour derived from the uid.
    await ensureProfile(decoded.uid).catch((e) => console.error("[session] ensureProfile failed", e));
    const session = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    (await cookies()).set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    // claimChanged tells the browser to refresh its ID token so Firestore sees the new claim now, not in an hour.
    return Response.json({ admin, emailVerified: decoded.email_verified === true, claimChanged });
  } catch (e) {
    // Firebase's own token errors carry an `auth/...` code; anything else is the server failing (bad service-account
    // key, firebase-admin failing to load…) and shouldn't be reported to the user as a bad token.
    const code = (e as { code?: string }).code ?? "";
    console.error("[session] sign-in failed", code, e);
    if (/^auth\/(id-token-expired|id-token-revoked|argument-error|invalid-id-token|user-disabled)/.test(code)) {
      return Response.json({ error: "Invalid token", code }, { status: 401 });
    }
    return Response.json({ error: "Sign-in failed on the server", code: code || undefined, detail: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
