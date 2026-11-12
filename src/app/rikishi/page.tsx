import type { Metadata } from "next";
import { RikishiBrowser } from "@/components/rikishi/rikishi-browser";

export const metadata: Metadata = { title: "Rikishi · Sumo Hub" };

export default function Page() {
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading-lg text-brand">Rikishi</h1>
      <RikishiBrowser />
    </section>
  );
}
