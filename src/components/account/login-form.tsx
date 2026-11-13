"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, updateProfile, type User } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/auth/firebase-client";

const input = "w-full border border-line bg-surface px-4 py-3 text-body";

/** Sign in / sign up with Firebase, then trade the ID token for a server session cookie. */
export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!firebaseConfigured) {
    return <p className="rounded-card border border-line bg-surface p-6 text-body-sm">Sign-in isn&apos;t configured yet (missing NEXT_PUBLIC_FIREBASE_* env vars).</p>;
  }

  async function finish(user: User) {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: await user.getIdToken(true) }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not start session");
    router.push("/profile");
    router.refresh();
  }

  async function run(fn: () => Promise<User>) {
    setBusy(true);
    setError(null);
    try {
      await finish(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Firebase: /, "") : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const email = String(f.get("email"));
          const password = String(f.get("password"));
          const name = String(f.get("name") ?? "");
          run(async () => {
            const auth = clientAuth();
            if (mode === "in") return (await signInWithEmailAndPassword(auth, email, password)).user;
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(user, { displayName: name });
            return user;
          });
        }}
      >
        {mode === "up" && (
          <label className="flex flex-col gap-1 text-body-sm">
            Display name
            <input name="name" className={input} autoComplete="nickname" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-body-sm">
          Email
          <input name="email" type="email" required className={input} autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1 text-body-sm">
          Password
          <input name="password" type="password" required minLength={6} className={input} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        {error && <p className="text-body-sm text-crimson-spotlight">{error}</p>}
        <button type="submit" disabled={busy} className="btn-pill justify-center bg-tangerine-pop disabled:opacity-60">
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(async () => (await signInWithPopup(clientAuth(), new GoogleAuthProvider())).user)}
        className="btn-pill justify-center bg-cobalt-stage disabled:opacity-60"
      >
        Continue with Google
      </button>
      <p className="text-center text-body-sm">
        {mode === "in" ? "New here? " : "Have an account? "}
        <button type="button" className="link-accent border-tangerine-pop" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
      <p className="text-center text-caption text-ink-soft">An account is optional — everything on Sumo Ring is free to browse.</p>
    </div>
  );
}
