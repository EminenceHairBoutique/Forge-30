import type { SkillTrackDef } from "@/lib/types";

/** Three seeded skill tracks (Section 5.7): 10–20 min daily tasks. */
export const SKILL_TRACKS: SkillTrackDef[] = [
  {
    id: "finance",
    name: "Personal finance & accounting",
    description: "Make every dollar visible and give it a job.",
    dailyTasks: [
      "Track every dollar you spent today",
      "Separate business vs personal for today's spending",
      "Review one subscription — keep or kill",
      "Add one debt to the debt list (balance, rate, minimum)",
      "Draft this week's budget in 10 minutes",
      "Kill one recurring expense",
    ],
    weeklyMilestones: [
      "Every dollar tracked all week",
      "Business and personal fully separated",
      "Debt list complete and current",
      "One recurring expense killed",
    ],
  },
  {
    id: "regulation",
    name: "Emotional regulation & boundaries",
    description: "Respond on purpose instead of reacting on reflex.",
    dailyTasks: [
      "Write down one trigger from today",
      "Write one boundary you need",
      "Practice the 60-second pause once",
      "Write a 'not my responsibility' list",
      "Draft one calm message you need to send",
      "Identify one repeated pattern",
    ],
    weeklyMilestones: [
      "Pause practiced every day",
      "One boundary held all week",
      "A repeated pattern named and tracked",
      "One hard conversation done calmly",
    ],
  },
  {
    id: "movement",
    name: "Functional movement & body mechanics",
    description: "Own the positions your training depends on.",
    dailyTasks: [
      "Serratus wall slides 2×12",
      "Dead bug 2×10",
      "Side plank 2×30s/side",
      "Hip flexor mobility 60s/side",
      "Scapular control drill 2×10",
      "Thoracic breathing drill 3 min",
    ],
    weeklyMilestones: [
      "All six drills hit at least once",
      "A zero-pain warm-up week",
      "10-minute daily mobility habit locked",
      "Breathing drill before bed ×4",
    ],
  },
];

export function getSkillTrack(id: string): SkillTrackDef | undefined {
  return SKILL_TRACKS.find((t) => t.id === id);
}

/** Today's rotating task for a track, by 1-based program day number. */
export function getDailySkillTask(track: SkillTrackDef, dayNumber: number): string {
  return track.dailyTasks[(Math.max(1, dayNumber) - 1) % track.dailyTasks.length]!;
}
