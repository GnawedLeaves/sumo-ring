// Data access layer for the signed-in viewer. Reads the Firebase session cookie set by /api/session.
import "server-only";
import { cookies } from "next/headers";
import { adminAuth, adminConfigured } from "./firebase-admin";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type Viewer = { uid: string; email?: string; name?: string; admin: boolean } | null;

/**
 * DEVELOPMENT ONLY: while running `next dev`, everyone (signed in or not) gets admin rights so streams
 * and clips can be edited without setting up Firebase. Set DEV_ADMIN=false to test the real restrictions.
 * `next build` / `next start` always run with NODE_ENV=production, so this can never apply in production.
 */
export const devAdmin = process.env.NODE_ENV === "development" && process.env.DEV_ADMIN !== "false";

export async function getViewer(): Promise<Viewer> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie && adminConfigured) {
    try {
      const claims = await adminAuth().verifySessionCookie(cookie);
      return { uid: claims.uid, email: claims.email, name: claims.name as string | undefined, admin: claims.admin === true || devAdmin };
    } catch {
      // expired or revoked — treat as signed out
    }
  }
  return devAdmin ? { uid: "dev", name: "Dev admin", admin: true } : null;
}

export async function isAdmin() {
  return (await getViewer())?.admin === true;
}

/** Call at the top of every mutating server action / route handler. */
export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.admin) throw new Error("Only the admin can do that.");
  return viewer;
}
