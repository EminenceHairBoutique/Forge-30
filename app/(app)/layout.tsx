import { BottomNav } from "@/components/shell/BottomNav";
import { OnboardingGate } from "@/components/shell/OnboardingGate";
import { NotificationScheduler } from "@/components/shell/NotificationScheduler";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
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
