"use client";
// Reads public profiles (/profiles/{uid}: colour + avatar) for the comment list and the header avatar.
// One batched query per 30 users, cached for the page session, so a thread of 100 comments costs a few reads.
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { clientDb } from "@/lib/auth/firebase-client";
import { TONE_COUNT } from "@/lib/rikishi-color";

export type PublicProfile = { color: number; photoURL?: string | null };

const cache = new Map<string, PublicProfile | null>();
const inflight = new Map<string, Promise<void>>();

/** Stable colour from the uid, used until the profile (with its random colour) exists. */
export function fallbackColor(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return Math.abs(h) % TONE_COUNT;
}

export function cachedProfile(uid: string): PublicProfile | null | undefined {
  return cache.get(uid);
}

/** Loads any of these profiles not yet cached (or all of them with `force`). Missing profiles cache as null. */
export async function loadProfiles(uids: string[], force = false): Promise<void> {
  const want = [...new Set(uids)].filter((u) => force || !cache.has(u));
  const waits: Promise<void>[] = [];
  const todo: string[] = [];
  for (const u of want) {
    const p = !force && inflight.get(u);
    if (p) waits.push(p);
    else todo.push(u);
  }
  for (let i = 0; i < todo.length; i += 30) {
    const chunk = todo.slice(i, i + 30);
    const p = getDocs(query(collection(clientDb(), "profiles"), where(documentId(), "in", chunk)))
      .then((snap) => {
        const found = new Map(snap.docs.map((d) => [d.id, d.data() as PublicProfile]));
        for (const u of chunk) cache.set(u, found.get(u) ?? null);
      })
      .catch((e: { code?: string }) => {
        // Offline or rules not deployed: avatars fall back to uid colours. Say why in development.
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            e?.code === "permission-denied"
              ? "[profiles] Firestore denied reading /profiles — publish the latest firestore.rules (profiles: allow read)."
              : `[profiles] couldn't load profiles: ${e?.code ?? e}`,
          );
        }
      })
      .finally(() => chunk.forEach((u) => inflight.delete(u)));
    chunk.forEach((u) => inflight.set(u, p));
    waits.push(p);
  }
  await Promise.all(waits);
}
