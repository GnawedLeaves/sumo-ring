import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { BashoCalendar } from "@/components/calendar/basho-calendar";
import { sumoApi } from "@/lib/sumo-api";
import { nextBashoIds } from "@/lib/basho";

export const metadata: Metadata = { title: "Calendar · Sumo Hub" };

/**
 * Official start dates for basho the API already knows about (it lists upcoming basho once the
 * schedule is set); anything else falls back to the second-Sunday rule on the client.
 */
async function getKnownStarts(): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");
  const from = `${new Date().getUTCFullYear() - 1}01`;
  const ids = nextBashoIds(from, 18);
  const results = await Promise.all(ids.map((id) => sumoApi.basho(id).catch(() => null)));
  return Object.fromEntries(results.filter((b) => b?.startDate).map((b) => [b!.date, b!.startDate!]));
}

export default async function Page() {
  const apiStarts = await getKnownStarts();
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading sm:text-heading-lg text-brand">Calendar</h1>
      <BashoCalendar apiStarts={apiStarts} />
    </section>
  );
}
