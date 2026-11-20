"use client";

import { BookOpen, CalendarDays, ChevronDown, CircleDot, Ellipsis, ImageUp, MonitorPlay, Newspaper, Send, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/account/auth-provider";
import { Suspense, useEffect, useId, useRef, useState } from "react";

export const NAV_ITEMS = [
  { href: "/basho", label: "Basho", icon: CircleDot },
  { href: "/streams", label: "Streams", icon: MonitorPlay },
  { href: "/rikishi", label: "Rikishi", icon: Users },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

/**
 * Extra pages, tucked into the "Others" dropdown. Add new ones here. `adminOnly` hides the link for everyone else
 * (display only: those pages and their actions re-check admin on the server).
 */
export const OTHER_ITEMS: readonly { href: string; label: string; icon: typeof ImageUp; adminOnly?: boolean }[] = [
  { href: "/portraits", label: "Rikishi portraits", icon: ImageUp },
  { href: "/kimarite", label: "Kimarite (techniques)", icon: BookOpen },
  { href: "/telegram", label: "Telegram auto-post", icon: Send, adminOnly: true },
];

type IsActive = (href: string) => boolean;
const none: IsActive = () => false;

function isActiveFor(path: string): IsActive {
  return (href) => path === href || path.startsWith(`${href}/`) || (href === "/basho" && path.startsWith("/bout/"));
}

/*
 * Reading the URL (usePathname) can't be part of the prerendered shell, so each nav renders inside
 * <Suspense>: the shell ships the same links without highlighting, then the active tab lights up.
 */

/** "Others" dropdown: a button that opens a small menu of extra pages. Closes on outside click, Escape or navigation. */
function OthersMenu({ isActive, variant }: { isActive: IsActive; variant: "desktop" | "mobile" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { isAdmin } = useAuth();
  const items = OTHER_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const active = items.some((i) => isActive(i.href));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open && (
    <ul
      id={menuId}
      className={`absolute z-50 min-w-52 border border-line bg-surface py-1 shadow-none ${
        variant === "desktop" ? "right-0 top-full mt-3" : "bottom-full right-1 mb-2"
      }`}
    >
      {items.map((item) => {
        const here = isActive(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={here ? "page" : undefined}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-body-sm hover:bg-hover ${here ? "font-bold text-brand" : "text-ink"}`}
            >
              <item.icon aria-hidden className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "mobile") {
    return (
      <div ref={ref} className="relative flex">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full flex-col items-center gap-0.5 py-2 text-caption ${active || open ? "font-bold text-brand" : "text-ink-soft"}`}
        >
          <Ellipsis aria-hidden className={`h-5 w-5 ${active || open ? "" : "opacity-70"}`} strokeWidth={active ? 2.25 : 1.75} />
          Others
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 whitespace-nowrap hover:text-brand ${active ? "font-bold text-brand underline decoration-2 underline-offset-8" : ""}`}
      >
        Others
        <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {menu}
    </div>
  );
}

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
      <OthersMenu isActive={isActive} variant="desktop" />
    </nav>
  );
}

function MobileLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
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
      <OthersMenu isActive={isActive} variant="mobile" />
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
