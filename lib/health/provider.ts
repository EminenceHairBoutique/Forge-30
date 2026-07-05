import type { ISODate } from "@/lib/types";

/**
 * Passive health data layer (v3 Phase 3). One interface, two
 * implementations: HealthKit under the Capacitor iOS shell, and the null
 * provider everywhere else (web = manual entry, exactly as before).
 *
 * Merge policy is a hard rule: passive data PRE-FILLS, the user confirms.
 * Detected values render as a distinct chip; one tap accepts; manual entry
 * always overrides; a manual value is never silently overwritten.
 */

export interface DetectedWorkout {
  start: string;
  minutes: number;
  kind: string;
}

export interface WeightSample {
  date: ISODate;
  kg: number;
}

export interface HealthProvider {
  isAvailable(): boolean;
  requestPermissions(): Promise<boolean>;
  getSteps(date: ISODate): Promise<number | null>;
  getSleep(date: ISODate): Promise<number | null>;
  getWorkouts(date: ISODate): Promise<DetectedWorkout[]>;
  getWeight(fromDate: ISODate, toDate: ISODate): Promise<WeightSample[]>;
}

/** Web + unsupported platforms: nothing detected, manual entry everywhere. */
export class NullHealthProvider implements HealthProvider {
  isAvailable(): boolean {
    return false;
  }
  async requestPermissions(): Promise<boolean> {
    return false;
  }
  async getSteps(): Promise<number | null> {
    return null;
  }
  async getSleep(): Promise<number | null> {
    return null;
  }
  async getWorkouts(): Promise<DetectedWorkout[]> {
    return [];
  }
  async getWeight(): Promise<WeightSample[]> {
    return [];
  }
}

let cached: HealthProvider | null = null;

/**
 * Runtime provider selection. HealthKit code loads ONLY inside the native
 * shell (dynamic import gated on the Capacitor bridge), so the web bundle
 * ships zero HealthKit bytes and web behavior is byte-identical.
 */
export async function getHealthProvider(): Promise<HealthProvider> {
  if (cached) return cached;
  const native =
    typeof window !== "undefined" &&
    (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  if (native) {
    try {
      const { HealthKitProvider } = await import("./healthkit");
      cached = new HealthKitProvider();
      return cached;
    } catch {
      // Plugin missing or bridge failure → manual entry, no error states.
    }
  }
  cached = new NullHealthProvider();
  return cached;
}
