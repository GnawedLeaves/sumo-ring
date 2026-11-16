"use client";

import { Check, ImageUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { createClipUpload, savePortrait } from "@/lib/actions";
import { sendToStorage, waitUntilProcessed } from "@/lib/upload-client";

type Phase = { step: "idle" } | { step: "uploading"; pct: number } | { step: "processing" } | { step: "saving" } | { step: "done" };

const MAX_BYTES = 10 * 1024 * 1024;

/** Upload / replace one rikishi's portrait photo: pick an image and it uploads, processes and saves on its own. */
export function PortraitUploader({
  rikishiId,
  name,
  hasPortrait,
  onDark = false,
}: {
  rikishiId: number;
  name: string;
  hasPortrait: boolean;
  /** Light outline for use on a dark background (the rikishi page hero). */
  onDark?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const busy = phase.step === "uploading" || phase.step === "processing" || phase.step === "saving";

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file");
    if (file.size > MAX_BYTES) return setError("Image is over 10 MB");
    try {
      setPhase({ step: "uploading", pct: 0 });
      const target = await createClipUpload(`portrait-${rikishiId}-${file.name}`);
      if (!target) throw new Error("Uploads need Hygraph to be configured");
      await sendToStorage(target, file, (pct) => setPhase({ step: "uploading", pct }));
      setPhase({ step: "processing" });
      await waitUntilProcessed(target.assetId, "image");
      setPhase({ step: "saving" });
      const res = await savePortrait(rikishiId, target.assetId);
      if (!res.ok) throw new Error(res.error);
      setPhase({ step: "done" });
      router.refresh();
      setTimeout(() => setPhase({ step: "idle" }), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase({ step: "idle" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const label =
    phase.step === "uploading"
      ? `Uploading ${phase.pct}%`
      : phase.step === "processing"
        ? "Processing…"
        : phase.step === "saving"
          ? "Saving…"
          : phase.step === "done"
            ? "Saved"
            : hasPortrait
              ? "Replace photo"
              : "Upload photo";

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <label
        htmlFor={inputId}
        aria-label={`${label} for ${name}`}
        className={`inline-flex items-center justify-center gap-1.5 rounded-pill border px-3 py-1.5 text-caption font-bold transition-colors ${
          onDark ? "border-white/50" : "border-line"
        } ${busy ? "pointer-events-none opacity-70" : `cursor-pointer ${onDark ? "hover:bg-white/10" : "hover:bg-hover"}`} ${
          phase.step === "done" ? "border-acid-green" : ""
        }`}
      >
        {busy ? (
          <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        ) : phase.step === "done" ? (
          <Check aria-hidden className="h-3.5 w-3.5" />
        ) : (
          <ImageUp aria-hidden className="h-3.5 w-3.5" />
        )}
        {label}
      </label>
      {error && (
        <p role="alert" className="text-caption text-crimson-spotlight">
          {error}
        </p>
      )}
    </div>
  );
}
