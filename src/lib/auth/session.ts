// Data access layer for the signed-in viewer. Reads the Firebase session cookie set by /api/session.
import "server-only";
import { cookies } from "next/headers";
import { adminAuth, adminConfigured } from "./firebase-admin";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type Viewer = { uid: string; email?: string; name?: string; admin: boolean } | null;

/**
 * TEMPORARY: admin rights are open to everyone (signed in or not), in development AND production, so
 * streams and clips can be managed before the admin account is set up.
 * To turn the restriction on, set ADMIN_RESTRICTED=true in the environment (Render + .env.local);
 * only users with the Firebase `admin` claim can then edit. See README → "Admin account".
 */
export const adminOpenToAll = process.env.ADMIN_RESTRICTED !== "true";

/** The signed-in user, or null. `admin` reflects the real Firebase claim. */
export async function getViewer(): Promise<Viewer> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie && adminConfigured) {
    try {
      const claims = await adminAuth().verifySessionCookie(cookie);
      return { uid: claims.uid, email: claims.email, name: claims.name as string | undefined, admin: claims.admin === true };
    } catch {
      // expired or revoked — treat as signed out
    }
  }
  return null;
}

/** Whether the current visitor may edit content. */
export async function isAdmin() {
  if (adminOpenToAll) return true;
  return (await getViewer())?.admin === true;
}

/** Call at the top of every mutating server action / route handler. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Only the admin can do that.");
}
