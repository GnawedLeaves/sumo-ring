import type { Metadata } from "next";
import { RikishiBrowser } from "@/components/rikishi/rikishi-browser";

export const metadata: Metadata = { title: "Rikishi · Sumo Ring" };

export default function Page() {
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading sm:text-heading-lg text-brand">Rikishi<span lang="ja" className="ml-2 font-jp text-[0.6em] font-normal">力士</span></h1>
      <RikishiBrowser />
    </section>
  );
}
