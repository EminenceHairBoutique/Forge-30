"use client";

import { useState } from "react";
import { CloudUpload, CheckCircle2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Quiet backup prompt (v3 Phase 1). Signed-out: a low-pressure sign-in card —
 * the app is fully usable without an account, and this card never nags.
 * Signed-in: sync status. Renders nothing when the build has no Supabase env,
 * so unconfigured builds look exactly like pre-sync builds.
 */
export function BackupCard({ compact = false }: { compact?: boolean }) {
  const { auth } = useStorage();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!auth.configured) return null;

  if (auth.userId) {
    if (compact) return null;
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <CheckCircle2 className="size-4 text-success" />
          <CardTitle>Backed up</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Signed in as {auth.email ?? "your account"} — your data syncs to your private,
            encrypted-in-transit backup and follows you to any device you sign in on.
          </p>
          <Button variant="ghost" size="sm" className="self-start" onClick={() => void auth.signOut()}>
            Sign out (keeps everything on this device)
          </Button>
        </CardContent>
      </Card>
    );
  }

  const send = async () => {
    setState("sending");
    const err = await auth.signInWithEmail(email.trim());
    if (err) {
      setError(err);
      setState("error");
    } else {
      setState("sent");
    }
  };

  if (compact) {
    // The quiet Progress-page variant: one line, one action, zero pressure.
    return (
      <p className="px-2 text-center text-xs leading-relaxed text-muted">
        This device holds your only copy. Back it up any time from Settings.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <CloudUpload className="size-4 text-gold" />
        <CardTitle>Back up your data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Right now this device holds the only copy of your 30 days. Sign in with a magic link
          to back it up and sync across devices — or keep going without an account; everything
          works either way.
        </p>
        {state === "sent" ? (
          <p className="text-sm text-success">
            Link sent — open the email on this device to finish signing in.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-email">Email</Label>
              <Input
                id="backup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-muted">{error}</p>}
            <Button
              size="lg"
              variant="secondary"
              disabled={state === "sending" || !email.includes("@")}
              onClick={() => void send()}
            >
              {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
