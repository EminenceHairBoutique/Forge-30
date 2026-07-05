import { LifeBuoy } from "lucide-react";

/**
 * Inline support resources (B-3). Rendered the moment a self-harm-adjacent
 * item gets an elevated answer — free at every tier, independent of the
 * paywall, independent of finishing anything. Crisis copy is never gated
 * and never softened.
 */
export function SupportResourcesCard() {
  return (
    <div
      role="status"
      className="rounded-(--radius-control) border border-gold/50 bg-gold/10 px-3.5 py-3"
    >
      <p className="flex items-center gap-1.5 microlabel text-gold">
        <LifeBuoy className="size-3.5" /> Support, right now if you need it
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ivory">
        That answer matters more than any score. If you’re having thoughts of hurting yourself,
        you deserve support today: in the US, call or text <strong>988</strong> (Suicide &amp;
        Crisis Lifeline, 24/7); elsewhere, <strong>findahelpline.com</strong> lists free lines by
        country. If you’re in immediate danger, contact emergency services now.
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        These resources are always free in this app and never depend on finishing anything.
        You can stop the screening here — nothing is lost, and stopping is a fine choice.
      </p>
    </div>
  );
}
