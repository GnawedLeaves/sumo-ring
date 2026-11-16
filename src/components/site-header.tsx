import Link from "next/link";
import { AccountButton } from "@/components/account/account-button";
import { DesktopNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
        <Link href="/basho" className="font-display text-subheading font-bold italic text-brand">
          Sumo Ring
        </Link>
        <div className="flex items-center gap-3 md:gap-5">
          <DesktopNav />
          <ThemeToggle />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}
