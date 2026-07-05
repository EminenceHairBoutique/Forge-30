import { BottomNav } from "@/components/shell/BottomNav";
import { OnboardingGate } from "@/components/shell/OnboardingGate";
import { NotificationScheduler } from "@/components/shell/NotificationScheduler";
import { BootSequence } from "@/components/shell/BootSequence";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <BootSequence />
      {/* Status-bar scrim (v3.3 §1.3): a fixed strip exactly the height of
          the iOS safe-area inset so scrolled content never collides with the
          clock. Theme-aware hull tint; pointer-events none; fades at its
          bottom edge so it never reads as a bar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 backdrop-blur-md"
        style={{
          height: "env(safe-area-inset-top, 0px)",
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--bg-base) 82%, transparent), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
          maskImage: "linear-gradient(to bottom, black 55%, transparent)",
        }}
      />
      {/* Atmosphere lives on the shell only: twin nebula wash + hull grid,
          diagonal hull panel-lines, and a drifting cyan telemetry scan —
          never inside cards. Mobile layout centers in a ~480px column; pages
          with a [data-wide] root (Progress, Money) expand at lg:. */}
      <div className="solar-wash grid-texture relative min-h-dvh">
        <div aria-hidden className="hull-lines" />
        <div aria-hidden className="ambient-scan" />
        <div className="relative z-10 mx-auto w-full max-w-lg px-4 pt-safe px-safe pb-safe-nav has-[[data-wide]]:lg:max-w-4xl">
          {children}
        </div>
      </div>
      <BottomNav />
      <NotificationScheduler />
    </OnboardingGate>
  );
}
