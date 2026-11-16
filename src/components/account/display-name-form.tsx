"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { clientAuth } from "@/lib/auth/firebase-client";
import { useAuth } from "@/components/account/auth-provider";

/** Same limit as firestore.rules applies to the name stored on each comment. */
const MAX_NAME = 60;

/**
 * Change the display name shown on comments and the profile. Works for every sign-in method, including
 * Google: this sets the account's own name, which Google sign-ins don't overwrite afterwards.
 */
export function DisplayNameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function save(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const user = clientAuth().currentUser;
    if (!user) return setError("Your sign-in has expired. Sign out and back in, then try again.");
    if (!trimmed) return setError("Enter a name");
    setState("saving");
    setError(null);
    try {
      await updateProfile(user, { displayName: trimmed.slice(0, MAX_NAME) });
      setState("saved");
      await refresh(); // header avatar initial + comment form name
      router.refresh(); // the profile card reads the name from Firebase on the server
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setError("Couldn't save your name. Try again.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label htmlFor="display-name" className="text-caption font-bold uppercase text-ink-soft">
        Display name
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          autoComplete="nickname"
          className="min-w-0 flex-1 border border-line bg-surface px-3 py-2 text-body"
        />
        <button
          type="submit"
          disabled={state === "saving" || !trimmed || trimmed === initial}
          className="btn-pill shrink-0 bg-cobalt-stage px-5 disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </button>
      </div>
      <p className="text-caption text-ink-soft">Shown on new comments. Comments you&apos;ve already posted keep the old name.</p>
      {error && (
        <p role="alert" className="text-caption text-crimson-spotlight">
          {error}
        </p>
      )}
    </form>
  );
}
