import Link from "next/link";

/** Link-based tabs: each tab is a URL so it can be shared and prerendered. */
export function TabNav({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav className="flex gap-0 border-b border-line" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className="tab"
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
