"use client";

import { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { useTier } from "@/lib/hooks/useTier";
import { TIER_PRICING } from "@/lib/engine/entitlements";
import { apiUrl, authHeaders } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Subscription surface (v3 Phase 7). Renders ONLY when a billing backend is
 * configured AND the user is signed in — unconfigured builds show no
 * purchase UI anywhere. Downgrade is non-destructive and the copy says so,
 * because it's true: nothing is ever deleted or locked; features just stop
 * generating new AI output.
 */
export function SubscriptionCard() {
  const { auth } = useStorage();
  const { tier } = useTier();
  const [billing, setBilling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(apiUrl("/api/entitlements"), { headers: await authHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as { billingConfigured?: boolean };
        setBilling(!!data.billingConfigured && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      } catch {
        // Unconfigured/offline → no purchase UI.
      }
    })();
  }, []);

  if (!billing || !auth.userId) return null;

  const checkout = async (priceEnv: string | undefined, planKey: string) => {
    if (!priceEnv) return;
    setBusy(planKey);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ priceId: priceEnv, origin: window.location.origin }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Checkout unavailable right now.");
    } catch {
      setError("Checkout unavailable right now.");
    } finally {
      setBusy(null);
    }
  };

  const isPaid = tier === "pro" || tier === "max";
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Gem className="size-4 text-gold" />
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Current plan:{" "}
          <span className="font-semibold text-ivory">
            {tier === "max" ? "Elite" : tier === "pro" ? "Pro" : "Forge (free)"}
          </span>
          {isPaid ? " — thank you." : ""}
        </p>
        {!isPaid && (
          <>
            <p className="text-sm leading-relaxed text-muted">
              Everything that builds the habit stays free forever: logging, streaks, sync,
              notifications, HealthKit, food search, the mock coach. {TIER_PRICING.pro.label} (
              {TIER_PRICING.pro.monthly}) adds the live AI coach with 30-day memory, unlimited
              photo nutrition, adaptive targets, LifeGraph, and the weekly deep report — with a
              7-day trial.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy !== null}
                onClick={() =>
                  void checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY, "pro")
                }
              >
                {busy === "pro" ? "Opening…" : `Start Pro — ${TIER_PRICING.pro.monthly}`}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busy !== null}
                onClick={() =>
                  void checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE_MONTHLY, "elite")
                }
              >
                {busy === "elite" ? "Opening…" : `Elite — ${TIER_PRICING.elite.monthly}`}
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-muted">{error}</p>}
        <p className="text-xs leading-relaxed text-muted">
          Downgrading never deletes or locks your data — features just stop generating new AI
          output. Safety features are free at every tier, permanently.
        </p>
      </CardContent>
    </Card>
  );
}
