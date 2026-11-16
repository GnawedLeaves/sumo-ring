"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { clientAuth, clientDb, firebaseConfigured } from "@/lib/auth/firebase-client";
import { Spinner } from "@/components/spinner";

type Comment = { id: string; uid: string; name: string; text: string; createdAt: Timestamp | null };

const MAX_LEN = 500;
const SHOW = 100;

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Live comment thread for one bout, stored in Firestore at /bouts/{boutId}/comments.
 * Anyone can read; signed-in users can post; the author or the admin can delete (enforced by firestore.rules).
 */
export function BoutComments({ boutId, title }: { boutId: string; title: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), async (u) => {
      setUser(u);
      setIsAdmin(u ? (await u.getIdTokenResult()).claims.admin === true : false);
    });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const q = query(collection(clientDb(), "bouts", boutId, "comments"), orderBy("createdAt", "desc"), limit(SHOW));
    return onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, "id">) })));
        setLoadError(null);
      },
      (err) => setLoadError(err.code === "permission-denied" ? "Comments aren't set up yet (Firestore rules)." : "Couldn't load comments."),
    );
  }, [boutId]);

  if (!firebaseConfigured) return null;

  async function post(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = text.trim();
    if (!user || !body) return;
    setPosting(true);
    setPostError(null);
    try {
      await addDoc(collection(clientDb(), "bouts", boutId, "comments"), {
        uid: user.uid,
        name: (user.displayName || user.email?.split("@")[0] || "Sumo fan").slice(0, 60),
        text: body.slice(0, MAX_LEN),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch {
      setPostError("Couldn't post your comment. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(c: Comment) {
    if (!confirm("Delete this comment?")) return;
    await deleteDoc(doc(clientDb(), "bouts", boutId, "comments", c.id)).catch(() => alert("Couldn't delete that comment."));
  }

  // Come back to this bout after signing in. Built on click, since window isn't available during render.
  const goToLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  };

  return (
    <section className="flex flex-col gap-4" aria-label={`Comments on ${title}`}>
      <h3 className="font-display text-subheading text-brand">
        Comments{comments && comments.length > 0 ? ` (${comments.length}${comments.length === SHOW ? "+" : ""})` : ""}
      </h3>

      {user ? (
        <form onSubmit={post} className="flex flex-col gap-2">
          <label htmlFor={`comment-${boutId}`} className="sr-only">
            Add a comment
          </label>
          <textarea
            id={`comment-${boutId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LEN}
            rows={3}
            placeholder={`What did you think of ${title}?`}
            className="w-full resize-y border border-line bg-surface px-3 py-2 text-body"
          />
          <div className="flex items-center justify-between gap-3 text-caption text-ink-soft">
            <span>
              Posting as <strong>{user.displayName || user.email?.split("@")[0]}</strong> · {text.length}/{MAX_LEN}
            </span>
            <button type="submit" disabled={posting || !text.trim()} className="btn-pill bg-cobalt-stage disabled:opacity-50">
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
          {postError && <p className="text-body-sm text-crimson-spotlight">{postError}</p>}
        </form>
      ) : (
        <p className="border border-dashed border-line p-4 text-body-sm">
          <Link href="/login" onClick={goToLogin} className="link-accent border-tangerine-pop">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      {loadError ? (
        <p className="text-body-sm text-ink-soft">{loadError}</p>
      ) : comments === null ? (
        <Spinner label="Loading comments" size="sm" />
      ) : comments.length === 0 ? (
        <p className="text-body-sm text-ink-soft">No comments yet — be the first.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-baseline justify-between gap-3 text-caption text-ink-soft">
                <span>
                  <strong className="text-body-sm text-ink">{c.name}</strong>
                  {c.createdAt && <> · {when.format(c.createdAt.toDate())}</>}
                </span>
                {user && (user.uid === c.uid || isAdmin) && (
                  <button type="button" onClick={() => remove(c)} className="text-crimson-spotlight underline">
                    Delete
                  </button>
                )}
              </div>
              <p className="whitespace-pre-line break-words text-body-sm">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
