"use client";

import { useEffect, useState } from "react";
import { Gem, RotateCw } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { useTier } from "@/lib/hooks/useTier";
import { apiUrl, authHeaders } from "@/lib/api";
import { DOWNGRADE_TRUST_LINE } from "@/lib/data/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaywallSheet } from "@/components/cards/PaywallSheet";

/**
 * Subscription surface (v3 Phase 7 + v3.3 Phase 5). Renders ONLY when a
 * billing backend is configured AND the user is signed in — unconfigured
 * builds show no purchase UI anywhere. Paid users get the Stripe customer
 * portal + a refresh-entitlement button; free users get the "See plans"
 * sheet. Downgrade is non-destructive and the copy says so.
 */
export function SubscriptionCard() {
  const { auth, adapter, touch } = useStorage();
  const { tier } = useTier();
  const [billing, setBilling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshed, setRefreshed] = useState<string | null>(null);

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

  const isPaid = tier === "pro" || tier === "max";

  const openPortal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/portal"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "The billing portal isn't available right now.");
    } catch {
      setError("The billing portal isn't available right now.");
    } finally {
      setBusy(null);
    }
  };

  // Pull the server's current tier and cache it locally (the webhook is the
  // source of truth; this reconciles after a checkout returns).
  const refresh = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/entitlements"), { headers: await authHeaders() });
      const data = (await res.json()) as { tier?: "free" | "pro" | "elite" };
      if (data.tier) {
        await adapter.saveTier(data.tier === "elite" ? "max" : data.tier);
        touch();
        setRefreshed("Plan refreshed.");
      }
    } catch {
      setError("Couldn't refresh right now.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
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

          {!isPaid ? (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Everything that builds the habit stays free forever: logging, streaks, sync,
                notifications, HealthKit, food search, the mock coach. Pro adds the live AI coach
                with 30-day memory, unlimited photo nutrition, adaptive targets, LifeGraph, and the
                weekly deep report — with a 7-day trial on your first live review.
              </p>
              <Button onClick={() => setSheetOpen(true)}>See plans</Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy !== null} onClick={() => void openPortal()}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void refresh()}
                aria-label="Refresh plan"
              >
                <RotateCw className="size-4" />
                {busy === "refresh" ? "…" : "Refresh"}
              </Button>
            </div>
          )}

          {refreshed && <p className="text-sm text-success">{refreshed}</p>}
          {error && <p className="text-sm text-muted">{error}</p>}
          <p className="text-xs leading-relaxed text-muted">
            {DOWNGRADE_TRUST_LINE} Safety features are free at every tier, permanently.
          </p>
        </CardContent>
      </Card>
      <PaywallSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
