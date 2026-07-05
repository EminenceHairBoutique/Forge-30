"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { DEFAULT_TIER, hasFeature, type Feature, type Tier } from "@/lib/engine/entitlements";

/** Current tier + the gate every surface calls: `can("lifeGraph")`. */
export function useTier() {
  const { adapter, revision } = useStorage();
  const [tier, setTier] = useState<Tier>(DEFAULT_TIER);

  useEffect(() => {
    let cancelled = false;
    adapter.getTier().then((t) => {
      if (!cancelled) setTier(t);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, revision]);

  return { tier, can: (feature: Feature) => hasFeature(tier, feature) };
}
