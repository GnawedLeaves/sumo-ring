"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Shares a deep link to this site. Uses the phone's native share sheet when there is one; otherwise copies the
 * link and confirms. `path` is site-relative (e.g. "/basho/202611?day=6&div=Makuuchi&bout=…").
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy(url: string) {
    try {
      await Promise.race([navigator.clipboard.writeText(url), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000))]);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
  }

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    // Native share sheet on phones/tablets (touch devices); desktop browsers just copy the link.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // user closed the sheet
      }
    }
    await copy(url);
  }

  return (
    <button
      type="button"
      onClick={share}
      title={copied ? "Link copied!" : "Share a link to this bout"}
      className="inline-flex items-center gap-1.5 text-body-sm text-ink-soft transition-colors hover:text-brand"
    >
      {copied ? <Check aria-hidden className="h-4 w-4" /> : <Share2 aria-hidden className="h-4 w-4" />}
      <span>{copied ? "Link copied" : "Share"}</span>
      <span className="sr-only" role="status">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </button>
  );
}
