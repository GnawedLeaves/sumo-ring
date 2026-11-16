"use client";

import Link from "next/link";
import { useAuth } from "@/components/account/auth-provider";
import { UserAvatar } from "@/components/account/user-avatar";

/** Header link to the profile: the user's picture or colour when signed in, the "ME" badge otherwise. */
export function AccountButton() {
  const { user, profile } = useAuth();
  if (user && profile) {
    const name = user.displayName || user.email?.split("@")[0] || "Me";
    return (
      <Link href="/profile" aria-label={`Account: ${name}`} className="rounded-full ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-line">
        <UserAvatar name={name} color={profile.color} photoURL={profile.photoURL} />
      </Link>
    );
  }
  return (
    <Link
      href="/profile"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-electric-teal text-caption font-bold text-black"
      aria-label="Account"
    >
      ME
    </Link>
  );
}
