import "server-only";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

export const adminConfigured = Boolean(
  process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY,
);

/**
 * Firebase Admin Auth, loaded lazily. firebase-admin/auth pulls in jwks-rsa → jose (ESM-only), which needs
 * Node ≥ 22.12 to load. Importing it on demand (instead of at module top level) means a load failure only
 * affects the auth call that needed it — callers catch it — rather than crashing every page that imports this file.
 */
async function adminApp() {
  if (!adminConfigured) throw new Error("Firebase Admin is not configured");
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Env files store the key with literal \n sequences.
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    })
  );
}

export async function adminAuth(): Promise<Auth> {
  const [app, { getAuth }] = await Promise.all([adminApp(), import("firebase-admin/auth")]);
  return getAuth(app);
}

let db: Promise<Firestore> | undefined;

/**
 * Server-side Firestore (bypasses firestore.rules — only for data the server must control, e.g. profiles).
 * preferRest: the default gRPC transport hangs on networks that block HTTP/2 to Google (verified on this
 * project's dev network: gRPC never answered, REST replied in <1s). REST works everywhere and covers every
 * operation we use; only realtime listeners need gRPC, and the server doesn't use any.
 */
export function adminDb(): Promise<Firestore> {
  db ??= (async () => {
    const [app, { initializeFirestore }] = await Promise.all([adminApp(), import("firebase-admin/firestore")]);
    return initializeFirestore(app, { preferRest: true });
  })().catch((e) => {
    db = undefined; // let the next call retry
    throw e;
  });
  return db;
}

/** Rejects if a Firestore call takes too long, so a network problem shows an error instead of hanging. */
export function withTimeout<T>(p: Promise<T>, ms = 10_000, what = "Firestore"): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} didn't respond — try again`)), ms))]);
}
