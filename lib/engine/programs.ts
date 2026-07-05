import { programById } from "@/lib/data/programs";
import type { BuilderInputs } from "./workoutBuilder";
import type { PainFlags, ProgramId, UserProfile } from "@/lib/types";

/**
 * Program assembly logic (v3.3 §3.2) — pure. The onboarding answers (§3.1)
 * pick a suggested program; the chosen program biases the workout builder's
 * defaults. Nothing here writes: pages pass the result into BuilderSheet /
 * buildWorkoutWeek, and switching programs only shapes plans generated from
 * then on — history is never rewritten.
 */

function hasPainFlags(painFlags: PainFlags | undefined): boolean {
  return !!painFlags && Object.values(painFlags).some(Boolean);
}

/** Suggested program from the §3.1 onboarding answers — always overridable. */
export function suggestProgram(profile: {
  trainingExperience?: UserProfile["trainingExperience"];
  trainingDaysPerWeek?: UserProfile["trainingDaysPerWeek"];
  sessionMinutes?: UserProfile["sessionMinutes"];
  painFlags?: PainFlags;
  injuriesCount?: number;
}): ProgramId {
  // Pain first: training around a body that has opinions beats any split.
  if (hasPainFlags(profile.painFlags) || (profile.injuriesCount ?? 0) > 0) return "comeback30";
  // A genuinely tight schedule beats experience level.
  if ((profile.sessionMinutes ?? 60) <= 30 || (profile.trainingDaysPerWeek ?? 4) <= 2) {
    return "busy30";
  }
  if (profile.trainingExperience === "beginner" || profile.trainingExperience === undefined) {
    return "first30";
  }
  return "custom";
}

/**
 * Builder defaults for a program + profile. "custom" (or unknown) returns
 * the profile's own schedule untouched — exactly the pre-program behavior.
 */
export function programBuilderDefaults(
  program: ProgramId | undefined,
  profile: {
    trainingDaysPerWeek?: UserProfile["trainingDaysPerWeek"];
    sessionMinutes?: UserProfile["sessionMinutes"];
    trainingExperience?: UserProfile["trainingExperience"];
  }
): Pick<BuilderInputs, "daysPerWeek" | "sessionMinutes" | "experience"> {
  const days = profile.trainingDaysPerWeek ?? 4;
  const minutes = profile.sessionMinutes ?? 60;
  const experience = profile.trainingExperience ?? "beginner";
  const def = program ? programById(program) : null;
  if (!def) return { daysPerWeek: days, sessionMinutes: minutes, experience };
  return {
    daysPerWeek: (days > def.maxDaysPerWeek ? def.maxDaysPerWeek : days) as BuilderInputs["daysPerWeek"],
    sessionMinutes: (minutes > def.maxSessionMinutes
      ? def.maxSessionMinutes
      : minutes) as BuilderInputs["sessionMinutes"],
    // Comeback biases guidance conservative regardless of history.
    experience: def.painAware ? "beginner" : experience,
  };
}

/** Whether meal logging should lead with quick-adds for this program. */
export function quickAddFirst(program: ProgramId | undefined): boolean {
  return program ? (programById(program)?.quickAddFirst ?? false) : false;
}
