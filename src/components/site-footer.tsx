import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-indigo-frame">
      <div className="mx-auto flex min-h-[120px] max-w-[1200px] items-center justify-center gap-4 px-4">
        <Link href="/streams" className="btn-pill bg-tangerine-pop" aria-label="Watch streams">
          ▶
        </Link>
        <span className="text-subheading font-bold text-white">Watch the dohyō.</span>
      </div>
    </footer>
  );
}
