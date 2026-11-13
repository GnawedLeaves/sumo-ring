import "server-only";
import type { Auth } from "firebase-admin/auth";

export const adminConfigured = Boolean(
  process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY,
);

/**
 * Firebase Admin Auth, loaded lazily. firebase-admin/auth pulls in jwks-rsa → jose (ESM-only), which needs
 * Node ≥ 22.12 to load. Importing it on demand (instead of at module top level) means a load failure only
 * affects the auth call that needed it — callers catch it — rather than crashing every page that imports this file.
 */
export async function adminAuth(): Promise<Auth> {
  if (!adminConfigured) throw new Error("Firebase Admin is not configured");
  const [{ cert, getApps, initializeApp }, { getAuth }] = await Promise.all([import("firebase-admin/app"), import("firebase-admin/auth")]);
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Env files store the key with literal \n sequences.
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  return getAuth(app);
}
