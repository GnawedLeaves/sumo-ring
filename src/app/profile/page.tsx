import { Spinner } from "@/components/spinner";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/account/sign-out-button";
import { SearchHistoryList } from "@/components/account/search-history-list";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile · Sumo Ring" };

export default function Page() {
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading sm:text-heading-lg text-brand">Profile</h1>
      <Suspense fallback={<Spinner label="Loading" />}>
        <Profile />
      </Suspense>
      <div className="mx-auto w-full max-w-md">
        <SearchHistoryList />
      </div>
    </section>
  );
}

async function Profile() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-body">You&apos;re browsing as a guest. Sign in to keep a profile.</p>
        <Link href="/login" className="btn-pill bg-tangerine-pop">
          Sign in or create an account
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <p className="font-display text-heading font-bold text-brand">{viewer.name ?? viewer.email ?? "Rikishi fan"}</p>
      {viewer.email && <p className="text-body-sm">{viewer.email}</p>}
      {viewer.admin && <span className="badge self-start">ADMIN</span>}
      {viewer.email && !viewer.emailVerified && (
        <p className="text-caption text-ink-soft">
          Email not verified yet — use the link we emailed you (or sign in with Google), then sign out and back in.
        </p>
      )}
      <SignOutButton />
    </div>
  );
}
