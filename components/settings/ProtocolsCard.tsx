"use client";

import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import type { ProtocolSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckItem } from "@/components/ui/checkbox";

/**
 * Protocols opt-in (v3 Phase 6, §6.0.1/§6.0.5/§6.0.6). Off by default and
 * invisible everywhere until enabled here; enabling requires the
 * prescribed-and-supervised confirmation. Disabling hides every surface and
 * deletes nothing — re-enabling restores the record intact.
 */
export function ProtocolsCard() {
  const { adapter, touch, revision } = useStorage();
  const [settings, setSettings] = useState<ProtocolSettings | null>(null);
  const [lockSupported, setLockSupported] = useState(false);

  useEffect(() => {
    void adapter.getProtocolSettings().then(setSettings);
    setLockSupported(
      typeof window !== "undefined" && "credentials" in navigator && "PublicKeyCredential" in window
    );
  }, [adapter, revision]);

  if (!settings) return null;

  const save = async (patch: Partial<ProtocolSettings>) => {
    const next = { ...settings, ...patch };
    await adapter.saveProtocolSettings(next);
    setSettings(next);
    touch();
  };

  const enableLock = async (on: boolean) => {
    if (!on) {
      await save({ lockEnabled: false, lockCredentialId: null });
      return;
    }
    try {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Forge30" },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "forge30-protocols",
            displayName: "Forge30 Protocols",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (cred) await save({ lockEnabled: true, lockCredentialId: cred.id });
    } catch {
      // User cancelled or unsupported — the toggle simply stays off.
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Pill className="size-4 text-gold" />
        <CardTitle>Protocols (prescribed therapy)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm leading-relaxed text-muted">
          An optional patient record for physician-prescribed hormone, peptide, or GLP-1
          therapy: schedules, dose log, site rotation, labs, and a doctor report. Forge30
          never suggests, calculates, or adjusts doses — protocol decisions stay with your
          prescriber. Hidden everywhere unless enabled; disabling hides it again and deletes
          nothing.
        </p>
        <CheckItem
          variant="toggle"
          label="My protocol is prescribed and supervised by a licensed provider"
          sublabel="Required to enable — this is a record-keeping tool for prescribed therapy."
          checked={settings.prescribedConfirmed}
          onCheckedChange={(v) =>
            void save({ prescribedConfirmed: v, enabled: v ? settings.enabled : false })
          }
        />
        <CheckItem
          variant="toggle"
          label="Enable the Protocols tab"
          checked={settings.enabled}
          onCheckedChange={(v) => void save({ enabled: v && settings.prescribedConfirmed })}
        />
        {settings.enabled && (
          <>
            <CheckItem
              variant="toggle"
              label="Local-only mode"
              sublabel="Keeps every protocol collection out of cloud sync entirely — this device only."
              checked={settings.localOnly}
              onCheckedChange={(v) => void save({ localOnly: v })}
            />
            {lockSupported && (
              <CheckItem
                variant="toggle"
                label="Require unlock to open Protocols"
                sublabel="Uses this device's screen lock (Face ID / fingerprint / PIN)."
                checked={settings.lockEnabled}
                onCheckedChange={(v) => void enableLock(v)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
