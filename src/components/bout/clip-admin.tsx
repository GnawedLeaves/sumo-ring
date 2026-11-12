import { isAdmin } from "@/lib/auth/session";
import { store } from "@/lib/content";
import { ClipForm } from "./clip-form";

/** Admin-only clip controls. Reads the session, so render it inside <Suspense>. */
export async function ClipAdmin(props: { boutId: string; eastShikona: string; westShikona: string; clips: { id: string; title: string }[] }) {
  if (!(await isAdmin())) return null;
  return <ClipForm {...props} uploadsEnabled={store.kind === "hygraph"} />;
}
