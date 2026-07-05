import { BottomNav } from "@/components/shell/BottomNav";
import { OnboardingGate } from "@/components/shell/OnboardingGate";
import { NotificationScheduler } from "@/components/shell/NotificationScheduler";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      {/* Status-bar scrim (v3.3 §1.3): a fixed strip exactly the height of
          the iOS safe-area inset so scrolled content never collides with the
          clock. Zero height on browsers without an inset; pointer-events
          none; fades out at its bottom edge so it never reads as a bar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 backdrop-blur-md"
        style={{
          height: "env(safe-area-inset-top, 0px)",
          background: "linear-gradient(to bottom, rgba(11,8,6,0.82), rgba(11,8,6,0))",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
          maskImage: "linear-gradient(to bottom, black 55%, transparent)",
        }}
      />
      {/* Atmosphere lives on the shell only: one radial solar wash + the
          instrument grid — never inside cards. Mobile layout centers in a
          ~480px column. Pages that render a [data-wide] root (Progress,
          Money) expand to a two-column desktop layout at lg:. */}
      <div className="solar-wash grid-texture min-h-dvh">
        <div className="mx-auto w-full max-w-lg px-4 pt-safe px-safe pb-safe-nav has-[[data-wide]]:lg:max-w-4xl">
          {children}
        </div>
      </div>
      <BottomNav />
      <NotificationScheduler />
    </OnboardingGate>
  );
}
