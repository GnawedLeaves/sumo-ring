"use client";

import { Check, LoaderCircle, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { setTelegramWhitelist } from "@/lib/actions";

/** On/off chip for one wrestler on the Telegram auto-post whitelist. Saves immediately; reverts if saving fails. */
export function WhitelistToggle({ rikishiId, name, initial }: { rikishiId: number; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const res = await setTelegramWhitelist(rikishiId, next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Auto-post ${name}'s bouts`}
        disabled={pending}
        onClick={toggle}
        className={`inline-flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-body-sm font-bold transition-colors ${
          on ? "border-brand bg-indigo-frame text-white" : "border-line bg-surface hover:bg-hover"
        }`}
      >
        <span className="min-w-0 truncate">{name}</span>
        {pending ? (
          <LoaderCircle aria-hidden className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
        ) : on ? (
          <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        ) : (
          <Plus aria-hidden className="h-4 w-4 shrink-0 text-ink-soft" />
        )}
      </button>
      {error && (
        <p role="alert" className="text-caption text-crimson-spotlight">
          {error}
        </p>
      )}
    </div>
  );
}
