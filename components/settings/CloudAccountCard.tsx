"use client";

import { useState } from "react";
import { CloudOff } from "lucide-react";
import { apiUrl, authHeaders } from "@/lib/api";
import { useStorage } from "@/lib/storage/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Cloud account deletion (v3.3 §1.6) — clearly distinct from the local
 * "Danger zone" reset: this removes the server-side account and synced
 * copy; everything on this device stays. Typed confirmation, no accidental
 * taps. Renders only when signed in on a configured build.
 */
export function CloudAccountCard() {
  const { auth } = useStorage();
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!auth.configured || !auth.userId) return null;

  const run = async () => {
    setState("working");
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/account/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ confirm: confirm.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Deletion didn't complete.");
      await auth.signOut();
      setState("done");
      setMessage("Cloud account deleted. Everything on this device is untouched.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Deletion didn't complete — try again.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <CloudOff className="size-4 text-muted" />
        <CardTitle>Cloud account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Deletes your cloud account and every synced copy of your data — sign-in, backups,
          subscriptions, push registrations. Data on this device stays exactly as it is, and the
          app keeps working signed-out. This is separate from the local reset below.
        </p>
        {state === "done" ? (
          <p className="text-sm text-success">{message}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cloud-delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="cloud-delete-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                placeholder="DELETE"
              />
            </div>
            {message && <p className="text-sm text-muted">{message}</p>}
            <Button
              variant="destructive"
              disabled={confirm.trim() !== "DELETE" || state === "working"}
              onClick={() => void run()}
            >
              {state === "working" ? "Deleting…" : "Delete cloud account"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
