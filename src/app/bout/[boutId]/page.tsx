import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoutDetail } from "@/components/bout/bout-detail";
import { bashoName } from "@/lib/basho";
import { parseBoutId } from "@/lib/format";
import { getLiveContext } from "@/lib/live";
import { Spinner } from "@/components/spinner";

export default function Page({ params }: PageProps<"/bout/[boutId]">) {
  return (
    <section className="page">
      <Suspense fallback={<Spinner label="Loading bout" />}>
        <Bout params={params} />
      </Suspense>
    </section>
  );
}

async function Bout({ params }: Pick<PageProps<"/bout/[boutId]">, "params">) {
  const { boutId } = await params;
  const b = parseBoutId(boutId);
  if (!b) notFound();
  const ctx = await getLiveContext();
  const live = ctx.active && ctx.bashoId === b.bashoId;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/basho/${b.bashoId}?day=${b.day}&bout=${boutId}`} className="link-accent self-start border-electric-teal text-body-sm">
        ← {bashoName(b.bashoId)}, day {b.day}
      </Link>
      <BoutDetail boutId={boutId} live={live} compact={false} />
    </div>
  );
}
