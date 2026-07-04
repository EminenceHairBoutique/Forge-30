"use client";

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTier } from "@/lib/hooks/useTier";
import { requiredTier, type GatedFeature } from "@/lib/engine/entitlements";

const TIER_LABEL: Record<string, string> = {
  plus: "Plus",
  pro: "Pro",
  max: "Max",
  household: "Household",
};

/**
 * Entitlement gate for premium surfaces: renders children when the user's
 * tier unlocks the feature, otherwise a calm upgrade card (no dark patterns,
 * no countdowns). Safety surfaces never sit behind this component — that
 * invariant lives in lib/engine/entitlements.ts and its tests.
 */
export function PaywallCard({
  feature,
  title,
  description,
  children,
}: {
  feature: GatedFeature;
  /** What the user is looking at, e.g. "LifeGraph patterns". */
  title: string;
  /** One sentence on what it does for them. */
  description: string;
  children: React.ReactNode;
}) {
  const { can } = useTier();
  if (can(feature)) return <>{children}</>;

  const tier = TIER_LABEL[requiredTier(feature)] ?? requiredTier(feature);
  return (
    <Card className="flex flex-col items-center gap-2 border-gold/30 bg-gold/5 p-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <Lock className="size-5 text-gold" />
      </span>
      <p className="text-sm font-bold text-ivory">{title}</p>
      <p className="text-sm text-muted">{description}</p>
      <p className="microlabel text-gold">
        Part of Forge30 {tier}
      </p>
    </Card>
  );
}
