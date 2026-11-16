"use client";
// Browser-side auth state, shared by the header avatar, comments and profile page: one Firebase listener and one
// profile read for the whole app. For DISPLAY only — every server action re-checks the session itself.
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { clientAuth, firebaseConfigured } from "@/lib/auth/firebase-client";
import { cachedProfile, fallbackColor, loadProfiles, type PublicProfile } from "@/lib/profile-client";

type AuthState = {
  /** False until Firebase has restored (or ruled out) a signed-in user. */
  ready: boolean;
  user: User | null;
  isAdmin: boolean;
  /** The user's colour and picture (colour falls back to one derived from the uid). */
  profile: PublicProfile | null;
  /** Re-read the user's profile and token (after changing the picture or name, or signing in). */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({ ready: false, user: null, isAdmin: false, profile: null, refresh: async () => {} });

export function useAuth() {
  return use(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!firebaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  // Bumped on refresh so a changed displayName (same User object) re-renders consumers.
  const [version, setVersion] = useState(0);

  const loadFor = useCallback(async (u: User | null, force = false) => {
    if (!u) {
      setIsAdmin(false);
      setProfile(null);
      return;
    }
    const [token] = await Promise.all([u.getIdTokenResult(force).catch(() => null), loadProfiles([u.uid], force)]);
    setIsAdmin(token?.claims.admin === true);
    setProfile(cachedProfile(u.uid) ?? { color: fallbackColor(u.uid) });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), async (u) => {
      setUser(u);
      setProfile(u ? { color: fallbackColor(u.uid) } : null); // instant colour, real one follows
      setReady(true);
      await loadFor(u);
    });
  }, [loadFor]);

  const refresh = useCallback(async () => {
    const u = clientAuth().currentUser;
    if (u) await u.reload().catch(() => {});
    await loadFor(u, true);
    setVersion((v) => v + 1);
  }, [loadFor]);

  const value = useMemo(
    () => ({ ready, user, isAdmin, profile, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` forces a new value after refresh()
    [ready, user, isAdmin, profile, refresh, version],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
