import { registerPlugin } from "@capacitor/core";
import type { ISODate } from "@/lib/types";
import type { DetectedWorkout, HealthProvider, WeightSample } from "./provider";

/**
 * HealthKit provider (v3 Phase 3) — loaded only in the Capacitor shell via
 * dynamic import (see provider.ts). Talks to the native side through a
 * registerPlugin bridge, so no plugin npm dependency is required at compile
 * time; the concrete plugin is pinned when the iOS project is generated
 * (candidate: @perfood/capacitor-healthkit — re-verify maintenance then; see
 * docs/NATIVE_BUILD.md). Every failure returns the empty/manual answer —
 * permission denial simply means the user types numbers like before.
 */

interface QueryArgs {
  sampleName: string;
  startDate: string;
  endDate: string;
  limit: number;
}

interface HealthKitBridge {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(options: { read: string[]; write: string[]; all: string[] }): Promise<void>;
  queryHKitSampleType(options: QueryArgs): Promise<{
    countReturn: number;
    resultData: Array<Record<string, unknown>>;
  }>;
}

const HealthKit = registerPlugin<HealthKitBridge>("CapacitorHealthkit");

const dayRange = (date: ISODate) => ({
  startDate: `${date}T00:00:00.000Z`,
  endDate: `${date}T23:59:59.999Z`,
});

export class HealthKitProvider implements HealthProvider {
  isAvailable(): boolean {
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      await HealthKit.requestAuthorization({
        read: ["steps", "sleepAnalysis", "workoutType", "weight"],
        write: [],
        all: [],
      });
      return true;
    } catch {
      return false;
    }
  }

  async getSteps(date: ISODate): Promise<number | null> {
    try {
      const { resultData } = await HealthKit.queryHKitSampleType({
        sampleName: "stepCount",
        ...dayRange(date),
        limit: 0,
      });
      if (resultData.length === 0) return null;
      const total = resultData.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      return Math.round(total);
    } catch {
      return null;
    }
  }

  async getSleep(date: ISODate): Promise<number | null> {
    try {
      const { resultData } = await HealthKit.queryHKitSampleType({
        sampleName: "sleepAnalysis",
        ...dayRange(date),
        limit: 0,
      });
      if (resultData.length === 0) return null;
      const totalMinutes = resultData.reduce(
        (sum, s) => sum + (Number(s.duration) || 0) / 60,
        0
      );
      return Math.round((totalMinutes / 60) * 2) / 2; // nearest half hour
    } catch {
      return null;
    }
  }

  async getWorkouts(date: ISODate): Promise<DetectedWorkout[]> {
    try {
      const { resultData } = await HealthKit.queryHKitSampleType({
        sampleName: "workoutType",
        ...dayRange(date),
        limit: 0,
      });
      return resultData.map((w) => ({
        start: String(w.startDate ?? `${date}T00:00:00Z`),
        minutes: Math.round((Number(w.duration) || 0) / 60),
        kind: String(w.workoutActivityName ?? "Workout"),
      }));
    } catch {
      return [];
    }
  }

  async getWeight(fromDate: ISODate, toDate: ISODate): Promise<WeightSample[]> {
    try {
      const { resultData } = await HealthKit.queryHKitSampleType({
        sampleName: "weight",
        startDate: `${fromDate}T00:00:00.000Z`,
        endDate: `${toDate}T23:59:59.999Z`,
        limit: 0,
      });
      return resultData
        .map((s) => ({
          date: String(s.startDate ?? "").slice(0, 10) as ISODate,
          kg: Number(s.value) || 0,
        }))
        .filter((s) => s.kg > 0 && s.date.length === 10);
    } catch {
      return [];
    }
  }
}
