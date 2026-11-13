import Link from "next/link";
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
          <Link
            href="/profile"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-electric-teal text-caption font-bold text-black"
            aria-label="Account"
          >
            ME
          </Link>
        </div>
      </div>
    </header>
  );
}
