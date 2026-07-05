"use client";

import { useEffect, useState } from "react";
import { BellRing, Share } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  currentPushSubscription,
  needsInstallFirst,
  pushServerConfigured,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";
import { Button } from "@/components/ui/button";

/**
 * Background-push controls (v3 Phase 2) — rendered inside the Settings
 * notifications card. Appears only when the deployed server has VAPID
 * configured AND the user is signed in; on an iOS browser tab it shows the
 * add-to-home-screen instruction instead of ever prompting (16.4+ rule).
 * Delivery discipline lives server-side: ≤2/day, zero on fully-logged days,
 * quiet hours respected.
 */
export function PushCard() {
  const { auth } = useStorage();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void pushServerConfigured().then(setPublicKey);
    void currentPushSubscription().then(setSubscribed);
  }, []);

  if (!publicKey || !auth.userId) return null;

  if (needsInstallFirst()) {
    return (
      <div className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
        <p className="microlabel flex items-center gap-1.5 text-muted">
          <Share className="size-3.5" /> Install first for background push
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          On iPhone, background notifications need the installed app: open the share menu,
          choose &ldquo;Add to Home Screen,&rdquo; then come back here from the installed app.
        </p>
      </div>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setError(null);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
    } else {
      const err = await subscribeToPush(publicKey);
      if (err) setError(err);
      else setSubscribed(true);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" disabled={busy} onClick={() => void toggle()}>
        <BellRing className="size-4" />
        {subscribed ? "Turn off background push on this device" : "Enable background push"}
      </Button>
      {subscribed && (
        <p className="text-xs text-muted">
          Delivery stays quiet: at most two a day, none on fully-logged days, silent during
          quiet hours.
        </p>
      )}
      {error && <p className="text-sm text-muted">{error}</p>}
    </div>
  );
}
