"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/lib/types";
import type { StorageAdapter } from "./adapter";
import { LocalStorageAdapter } from "./localStorageAdapter";

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
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: { children: React.ReactNode }) {
  // The adapter is created once on the client. Swap LocalStorageAdapter for a
  // SupabaseAdapter here when the remote backend lands.
  const adapter = useMemo<StorageAdapter>(() => new LocalStorageAdapter(), []);
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

  const value = useMemo(
    () => ({ adapter, revision, touch, profile, profileLoaded, saveProfile }),
    [adapter, revision, touch, profile, profileLoaded, saveProfile]
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used inside <StorageProvider>");
  return ctx;
}
