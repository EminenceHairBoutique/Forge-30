"use client";

import { useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";
import { apiUrl, authHeaders } from "@/lib/api";
import { useStorage } from "@/lib/storage/provider";
import {
  DOWNGRADE_TRUST_LINE,
  FEATURE_ROWS,
  PLAN_COLUMNS,
  type PlanColumn,
} from "@/lib/data/pricing";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/**
 * The paywall sheet (v3.3 Phase 5). Contextual only — opened from a quota hit
 * or a locked-feature tap, never an interstitial. Shows the Free/Pro/Elite
 * feature table (safety + habit rows checked across all three, making the
 * "free forever" promise visible), an annual toggle, and the verbatim trust
 * line. Renders its buy buttons only when billing is configured AND the user
 * is signed in; otherwise it's an honest feature comparison with no dead CTA.
 */
export function PaywallSheet({
  open,
  onOpenChange,
  highlight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional one-line reason the sheet opened, e.g. "You've used your 3 free photos." */
  highlight?: string;
}) {
  const { auth } = useStorage();
  const [annual, setAnnual] = useState(false);
  const [billing, setBilling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await fetch(apiUrl("/api/entitlements"), { headers: await authHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as { billingConfigured?: boolean };
        setBilling(!!data.billingConfigured && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      } catch {
        // Unconfigured → comparison only, no buy buttons.
      }
    })();
  }, [open]);

  const canBuy = billing && !!auth.userId;

  const checkout = async (col: PlanColumn) => {
    const env = annual ? col.yearlyPriceEnv : col.monthlyPriceEnv;
    // NEXT_PUBLIC_* must be referenced as static literals for Next to inline.
    const priceId =
      env === "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY"
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY
        : env === "NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY"
          ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY
          : env === "NEXT_PUBLIC_STRIPE_PRICE_ELITE_MONTHLY"
            ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE_MONTHLY
            : env === "NEXT_PUBLIC_STRIPE_PRICE_ELITE_YEARLY"
              ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE_YEARLY
              : undefined;
    if (!priceId) {
      setError("That plan isn't available right now.");
      return;
    }
    setBusy(col.key);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ priceId, origin: window.location.origin }),
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

  const cell = (v: boolean | string) =>
    typeof v === "string" ? (
      <span className="tabular text-xs text-ivory">{v}</span>
    ) : v ? (
      <Check className="mx-auto size-4 text-success" aria-label="included" />
    ) : (
      <Minus className="mx-auto size-4 text-muted" aria-label="not included" />
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Plans">
        <div className="flex flex-col gap-4">
          {highlight && (
            <p className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-ivory">
              {highlight}
            </p>
          )}

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold ${!annual ? "bg-gold/20 text-gold" : "text-muted"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold ${annual ? "bg-gold/20 text-gold" : "text-muted"}`}
            >
              Annual · save ~2 months
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="py-2 pr-2" />
                  {PLAN_COLUMNS.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-center">
                      <span className="block text-sm font-bold text-ivory">{c.name}</span>
                      <span className="block text-[11px] text-muted">
                        {c.key === "free" ? "Free" : annual ? c.yearly : c.monthly}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="py-2 pr-2 text-xs text-muted">{row.label}</td>
                    <td className="px-2 py-2 text-center">{cell(row.free)}</td>
                    <td className="px-2 py-2 text-center">{cell(row.pro)}</td>
                    <td className="px-2 py-2 text-center">{cell(row.elite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canBuy ? (
            <div className="flex gap-2">
              {PLAN_COLUMNS.filter((c) => c.key !== "free").map((c) => (
                <Button
                  key={c.key}
                  variant={c.key === "pro" ? "default" : "secondary"}
                  className="flex-1"
                  disabled={busy !== null}
                  onClick={() => void checkout(c)}
                >
                  {busy === c.key ? "Opening…" : `${c.name} — ${annual ? c.yearly : c.monthly}`}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted">
              {auth.configured
                ? "Sign in from Settings to upgrade — everything above works free without an account."
                : "This build has no billing — every free feature above is already unlocked."}
            </p>
          )}
          {error && <p className="text-center text-sm text-muted">{error}</p>}

          <p className="text-xs leading-relaxed text-muted">
            7-day Pro trial on your first live coach review. {DOWNGRADE_TRUST_LINE} Safety
            features are free at every tier, permanently.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
