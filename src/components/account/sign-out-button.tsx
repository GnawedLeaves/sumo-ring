"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/auth/firebase-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-pill self-start bg-plum-velvet"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        if (firebaseConfigured) await signOut(clientAuth()).catch(() => {});
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
