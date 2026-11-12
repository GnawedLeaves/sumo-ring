import type { Metadata } from "next";
import { Suspense } from "react";
import { BashoPicker } from "@/components/basho/basho-picker";
import { BashoTabs } from "@/components/basho/basho-tabs";
import { HistoryList } from "@/components/basho/history-list";
import { bashoByYear, getHistoryPage } from "@/lib/basho-history";
import { getLiveContext } from "@/lib/live";

export const metadata: Metadata = { title: "Basho history · Sumo Hub" };

export default function Page() {
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading-lg text-brand">Basho</h1>
      <BashoTabs active="history" />
      <Suspense fallback={<p className="text-body-sm">Loading past basho…</p>}>
        <History />
      </Suspense>
    </section>
  );
}

async function History() {
  const ctx = await getLiveContext();
  const first = await getHistoryPage(ctx, 0);
  return (
    <div className="flex flex-col gap-8">
      <BashoPicker groups={bashoByYear(ctx)} />
      <HistoryList initial={first} />
    </div>
  );
}
