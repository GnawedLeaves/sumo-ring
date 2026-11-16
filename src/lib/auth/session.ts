// Data access layer for the signed-in viewer. Reads the Firebase session cookie set by /api/session.
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { isAdminIdentity } from "./admins";
import { adminAuth, adminConfigured } from "./firebase-admin";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type Viewer = { uid: string; email?: string; emailVerified: boolean; name?: string; admin: boolean } | null;

/**
 * Escape hatch for local testing only: ADMIN_OPEN=true lets every visitor use admin features.
 * Never set it in production.
 */
export const adminOpenToAll = process.env.ADMIN_OPEN === "true";

/**
 * The signed-in user, or null. `admin` is decided here on every request from the verified session cookie
 * and the ADMIN_EMAILS list, so removing an email from the list takes effect immediately.
 */
export const getViewer = cache(async function getViewer(): Promise<Viewer> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie && adminConfigured) {
    try {
      // checkRevoked: a disabled or signed-out-everywhere account loses access straight away.
      const claims = await (await adminAuth()).verifySessionCookie(cookie, true);
      return {
        uid: claims.uid,
        email: claims.email,
        emailVerified: claims.email_verified === true,
        name: claims.name as string | undefined,
        admin: isAdminIdentity(claims),
      };
    } catch {
      // expired or revoked (or Firebase Admin failed to load) — treat as signed out
    }
  }
  return null;
}); // cache(): one verification per request, however many components ask

/** Whether the current visitor may edit content. */
export async function isAdmin() {
  if (adminOpenToAll) return true;
  return (await getViewer())?.admin === true;
}

/** Call at the top of every mutating server action / route handler. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Only the admin can do that.");
}
