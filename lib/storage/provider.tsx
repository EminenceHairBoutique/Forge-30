"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { UserProfile } from "@/lib/types";
import { getSupabase, syncConfigured } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { isTier, tierFromSubscription } from "@/lib/engine/entitlements";
import type { StorageAdapter } from "./adapter";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { SyncedAdapter } from "./syncedAdapter";

interface AuthState {
  /** False when this build has no Supabase env — auth UI stays hidden. */
  configured: boolean;
  userId: string | null;
  email: string | null;
  /** Magic-link sign-in; resolves to an error message or null on success. */
  signInWithEmail: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** True once the one-time full local push finished ("data is backed up"). */
  backedUp: boolean;
}

interface StorageContextValue {
  adapter: StorageAdapter;
  /** Bumped on every write so views can re-read; subscribe via useStorage(). */
  revision: number;
  /** Call after any adapter write to refresh subscribed views. */
  touch: () => void;
  /** Profile is preloaded here because nearly every screen needs it. */
  profile: UserProfile | null;
  profileLoaded: boolean;
  saveProfile: (p: UserProfile) => Promise<void>;
  auth: AuthState;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const syncedRef = useRef<SyncedAdapter | null>(null);

  // Signed-out → plain LocalStorageAdapter (the pre-sync experience,
  // unchanged). Signed-in → SyncedAdapter (same local reads + background
  // cloud sync). Selection happens here; components never know.
  const adapter = useMemo<StorageAdapter>(() => {
    syncedRef.current?.dispose();
    syncedRef.current = null;
    const supabase = getSupabase();
    if (supabase && userId) {
      const synced = new SyncedAdapter(supabase, userId);
      syncedRef.current = synced;
      synced.start();
      return synced;
    }
    return new LocalStorageAdapter();
  }, [userId]);

  useEffect(() => () => syncedRef.current?.dispose(), []);

  // v3 Phase 7: when a billing backend exists, the server's entitlement
  // drives the stored client tier (UX gating only — AI routes re-check).
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch(apiUrl("/api/entitlements"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const ent = (await res.json()) as { tier?: string; billingConfigured?: boolean };
        if (ent.billingConfigured && (ent.tier === "free" || ent.tier === "pro" || ent.tier === "elite")) {
          const mapped = tierFromSubscription(ent.tier);
          if (isTier(mapped)) await adapter.saveTier(mapped);
        }
      } catch {
        // Offline/unconfigured: the stored tier stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, adapter]);

  // Track the Supabase session (no-op when the build isn't configured).
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const [revision, setRevision] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const touch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    adapter.getProfile().then((p) => {
      if (cancelled) return;
      setProfile(p);
      setProfileLoaded(true);
    });
    setBackedUp(syncedRef.current?.backedUp ?? false);
    return () => {
      cancelled = true;
    };
  }, [adapter, revision]);

  const saveProfile = useCallback(
    async (p: UserProfile) => {
      await adapter.saveProfile(p);
      setProfile(p);
      touch();
    },
    [adapter, touch]
  );

  const signInWithEmail = useCallback(async (address: string): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) return "Sync isn't configured in this build.";
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const auth = useMemo<AuthState>(
    () => ({ configured: syncConfigured(), userId, email, signInWithEmail, signOut, backedUp }),
    [userId, email, signInWithEmail, signOut, backedUp]
  );

  const value = useMemo(
    () => ({ adapter, revision, touch, profile, profileLoaded, saveProfile, auth }),
    [adapter, revision, touch, profile, profileLoaded, saveProfile, auth]
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used inside <StorageProvider>");
  return ctx;
}
