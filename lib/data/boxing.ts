import type { BoxingSessionType } from "@/lib/types";

/**
 * Boxing performance module (HT Phase 12) — the four session types and round
 * presets. Timers live in the UI; this is pure seeded content.
 */

export interface BoxingSessionDef {
  id: BoxingSessionType;
  name: string;
  intent: string;
  blocks: string[];
  defaultRounds: number;
  defaultWorkSeconds: number;
  defaultRestSeconds: number;
  guidance: string;
}

export const BOXING_SESSIONS: BoxingSessionDef[] = [
  {
    id: "technical",
    name: "Technical",
    intent: "Skill practice at low fatigue — mechanics over everything.",
    blocks: [
      "Shadowboxing (technique focus)",
      "Footwork patterns",
      "Slip rope / defensive movement",
      "Light bag work",
    ],
    defaultRounds: 5,
    defaultWorkSeconds: 180,
    defaultRestSeconds: 60,
    guidance:
      "Low-to-moderate intensity throughout. Pick one theme per round (jab, distance, head movement). If form degrades, slow down — never push through sloppy rounds.",
  },
  {
    id: "speed",
    name: "Speed",
    intent: "Fast hands on full recovery — short rounds, maximum crispness.",
    blocks: [
      "Fast combinations (shadow or bag)",
      "Reaction drills",
      "Double-end bag / reflex drills",
      "Short rounds, full rest",
    ],
    defaultRounds: 6,
    defaultWorkSeconds: 120,
    defaultRestSeconds: 60,
    guidance:
      "Speed lives on freshness: shorter rounds, complete recovery between them. The set ends when hand speed visibly drops — this is never conditioning.",
  },
  {
    id: "power",
    name: "Power",
    intent: "Maximal-intent shots at low volume — mechanics deliver the power.",
    blocks: [
      "Rotational medicine-ball work",
      "Heavy-bag power rounds",
      "Full recovery between efforts",
      "Low total punch volume",
    ],
    defaultRounds: 4,
    defaultWorkSeconds: 120,
    defaultRestSeconds: 90,
    guidance:
      "Every shot thrown with full hip rotation and full rest behind it. Quality collapses quietly under fatigue — keep volume low and intent maximal.",
  },
  {
    id: "conditioning",
    name: "Conditioning",
    intent: "Boxing-specific energy systems — longer rounds, controlled fatigue.",
    blocks: [
      "Longer bag rounds",
      "Jump rope intervals",
      "Sled or bike intervals",
      "Work-to-rest interval play",
    ],
    defaultRounds: 6,
    defaultWorkSeconds: 180,
    defaultRestSeconds: 60,
    guidance:
      "The one session where fatigue is the point — but controlled: hold output across rounds rather than emptying the tank in round one.",
  },
];

export function boxingSessionById(id: BoxingSessionType): BoxingSessionDef {
  return BOXING_SESSIONS.find((s) => s.id === id) ?? BOXING_SESSIONS[0]!;
}

export interface RoundPreset {
  id: string;
  label: string;
  workSeconds: number;
  restSeconds: number;
}

export const ROUND_PRESETS: RoundPreset[] = [
  { id: "2-1", label: "2 min / 1 min", workSeconds: 120, restSeconds: 60 },
  { id: "3-1", label: "3 min / 1 min", workSeconds: 180, restSeconds: 60 },
  { id: "30-30", label: "30 s / 30 s", workSeconds: 30, restSeconds: 30 },
];
