"use client";

import { ImageUp, LoaderCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { checkAvatarUpload, createAvatarUpload, removeAvatar, saveAvatar } from "@/lib/account-actions";
import { sendToStorage, waitUntilProcessed } from "@/lib/upload-client";
import { useAuth } from "@/components/account/auth-provider";
import { UserAvatar } from "@/components/account/user-avatar";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

type Phase = "idle" | "uploading" | "processing" | "saving" | "removing";

/** Profile picture: upload / replace / remove. Without a picture, the account's palette colour is shown. */
export function AvatarEditor() {
  const { user, profile, refresh } = useAuth();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  if (!user || !profile) return null;
  const busy = phase !== "idle";
  const name = user.displayName || user.email?.split("@")[0] || "Me";

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) return setError("Choose a JPG, PNG, WebP, GIF or AVIF image");
    if (file.size > MAX_BYTES) return setError("Image must be 5 MB or smaller");
    try {
      setPhase("uploading");
      setPct(0);
      const started = await createAvatarUpload(file.name, file.size, file.type);
      if (!started.ok) throw new Error(started.error);
      const { target } = started;
      await sendToStorage(target, file, setPct);
      setPhase("processing");
      await waitUntilProcessed(target.assetId, "image", checkAvatarUpload);
      setPhase("saving");
      const res = await saveAvatar(target.assetId);
      if (!res.ok) throw new Error(res.error);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setPhase("removing");
    const res = await removeAvatar();
    if (!res.ok) setError(res.error);
    await refresh();
    setPhase("idle");
  }

  const label = { idle: profile.photoURL ? "Change picture" : "Upload picture", uploading: `Uploading ${pct}%`, processing: "Processing…", saving: "Saving…", removing: "Removing…" }[phase];

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} color={profile.color} photoURL={profile.photoURL} size="lg" />
      <div className="flex flex-col items-start gap-2">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-1.5 rounded-pill border border-line px-4 py-2 text-caption font-bold ${
            busy ? "pointer-events-none opacity-70" : "cursor-pointer hover:bg-hover"
          }`}
        >
          {busy ? <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <ImageUp aria-hidden className="h-3.5 w-3.5" />}
          {label}
        </label>
        {profile.photoURL && !busy && (
          <button type="button" onClick={remove} className="text-caption text-ink-soft underline hover:text-ink">
            Remove picture (use my colour)
          </button>
        )}
        {error && (
          <p role="alert" className="text-caption text-crimson-spotlight">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
