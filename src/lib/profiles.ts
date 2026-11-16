// User profiles: Firestore /profiles/{uid} = { color, photoURL?, avatarAssetId?, pendingAvatar?, ... }.
// Public to read (comments show avatars), written ONLY here via the Admin SDK — firestore.rules deny client
// writes, so nobody can point their avatar at an arbitrary URL or pick someone else's colour.
import "server-only";
import { randomInt } from "node:crypto";
import { adminDb, withTimeout } from "@/lib/auth/firebase-admin";
import { TONE_COUNT } from "@/lib/rikishi-color";

export type ProfileDoc = {
  /** Palette index (see rikishi-color.ts), chosen at random when the account first signs in. */
  color: number;
  photoURL?: string | null;
  /** Hygraph asset currently used as the avatar (deleted when replaced). */
  avatarAssetId?: string | null;
  /** The one upload this user may turn into their avatar (set when the upload starts). */
  pendingAvatar?: string | null;
  lastAvatarUploadAt?: number;
  createdAt?: number;
};

const ref = async (uid: string) => (await adminDb()).collection("profiles").doc(uid);

/** Creates the profile with a random colour the first time; never changes an existing colour. */
export async function ensureProfile(uid: string): Promise<ProfileDoc> {
  const doc = await ref(uid);
  const db = await adminDb();
  return withTimeout(
    db.runTransaction(async (tx) => {
      const snap = await tx.get(doc);
      if (snap.exists) return snap.data() as ProfileDoc;
      const fresh: ProfileDoc = { color: randomInt(TONE_COUNT), createdAt: Date.now() };
      tx.set(doc, fresh);
      return fresh;
    }),
  );
}

export async function updateProfileDoc(uid: string, data: Partial<ProfileDoc>) {
  await withTimeout((await ref(uid)).set(data, { merge: true }));
}
