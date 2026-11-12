import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline · Sumo Hub" };

/** Served by the service worker when there's no connection and the page isn't cached. */
export default function Page() {
  return (
    <section className="page flex flex-col items-center gap-4 text-center">
      <h1 className="font-display text-heading sm:text-heading-lg text-brand">You&apos;re offline</h1>
      <p className="max-w-md text-body">Pages you&apos;ve visited recently are still available. Live torikumi and streams will come back when you reconnect.</p>
    </section>
  );
}
