"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** Small icon button that copies `text` to the clipboard and briefly confirms with a tick. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      // Some embedded browsers leave writeText pending on a permission prompt; don't wait on it forever.
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error("clipboard timeout")), 1000)),
      ]);
    } catch {
      // Clipboard API unavailable, refused or stuck (e.g. plain http on a phone): fall back to a temporary selection.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `${label}: ${text}`}
      title={copied ? "Copied!" : `${label}: “${text}”`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-hover hover:text-ink"
    >
      {copied ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
