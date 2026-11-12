import Link from "next/link";

export const NAV_ITEMS = [
  { href: "/streams", label: "Streams" },
  { href: "/basho", label: "Basho" },
  { href: "/rikishi", label: "Rikishi" },
  { href: "/news", label: "News" },
  { href: "/calendar", label: "Calendar" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-black bg-cream-paper">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-4 py-4 md:px-6">
        <Link href="/" className="font-display text-subheading font-bold italic text-indigo-frame">
          Sumo Hub
        </Link>
        <nav className="flex items-center gap-5 overflow-x-auto text-body-sm">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-indigo-frame">
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-electric-teal text-caption font-bold text-white"
            aria-label="Account"
          >
            ME
          </Link>
        </nav>
      </div>
    </header>
  );
}
