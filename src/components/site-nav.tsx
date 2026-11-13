"use client";

import { CalendarDays, CircleDot, MonitorPlay, Newspaper, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export const NAV_ITEMS = [
  { href: "/basho", label: "Basho", icon: CircleDot },
  { href: "/streams", label: "Streams", icon: MonitorPlay },
  { href: "/rikishi", label: "Rikishi", icon: Users },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

type IsActive = (href: string) => boolean;
const none: IsActive = () => false;

function isActiveFor(path: string): IsActive {
  return (href) => path === href || path.startsWith(`${href}/`) || (href === "/basho" && path.startsWith("/bout/"));
}

/*
 * Reading the URL (usePathname) can't be part of the prerendered shell, so each nav renders inside
 * <Suspense>: the shell ships the same links without highlighting, then the active tab lights up.
 */

function DesktopLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav className="hidden items-center gap-5 text-body-sm md:flex" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={`whitespace-nowrap hover:text-brand ${isActive(item.href) ? "font-bold text-brand underline decoration-2 underline-offset-8" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function MobileLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-caption ${active ? "font-bold text-brand" : "text-ink-soft"}`}
          >
            <item.icon aria-hidden className={`h-5 w-5 ${active ? "" : "opacity-70"}`} strokeWidth={active ? 2.25 : 1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveDesktop() {
  return <DesktopLinks isActive={isActiveFor(usePathname())} />;
}
function ActiveMobile() {
  return <MobileLinks isActive={isActiveFor(usePathname())} />;
}

/** Inline nav in the header — tablet and up. */
export function DesktopNav() {
  return (
    <Suspense fallback={<DesktopLinks isActive={none} />}>
      <ActiveDesktop />
    </Suspense>
  );
}

/** Fixed bottom tab bar on phones — the app-like nav when installed as a PWA. */
export function MobileNav() {
  return (
    <Suspense fallback={<MobileLinks isActive={none} />}>
      <ActiveMobile />
    </Suspense>
  );
}
