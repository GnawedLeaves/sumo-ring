import Link from "next/link";
import { NAV_ITEMS } from "@/components/site-header";

const CARD_COLORS = ["bg-cobalt-stage", "bg-tangerine-pop", "bg-plum-velvet", "bg-rose-petal", "bg-vermillion"];

export default function Home() {
  return (
    <>
      <section className="bg-indigo-frame text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-24 md:px-6">
          <h1 className="font-display text-heading-lg md:text-display">Every bout, every basho.</h1>
          <p className="mt-6 max-w-xl font-display text-subheading">
            Live streams, torikumi, head-to-head records and sumo news in one place.
          </p>
        </div>
      </section>
      <section className="page">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
          {NAV_ITEMS.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${CARD_COLORS[i]} flex aspect-square items-start p-6 text-subheading font-bold text-white`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
