import type { SkillTrackDef } from "@/lib/types";

/** Seeded skill tracks: the original three plus the v2 expansion (E12). */
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
  {
    id: "nutritionBasics",
    name: "Nutrition basics",
    description: "Understand what you eat well enough to stop guessing.",
    dailyTasks: [
      "Read the label of one food you eat often — note protein and calories",
      "Estimate one meal's protein before logging it, then check",
      "Learn one protein source per 100 kcal comparison",
      "Plan tomorrow's meals in under five minutes",
      "Identify the highest-calorie drink you had this week",
      "Build one balanced plate: protein, carb, fat, fiber — name each part",
    ],
    weeklyMilestones: [
      "Every meal logged for a full week",
      "Protein estimated within 15g before checking, three times",
      "A default breakfast and lunch chosen and repeated",
      "One swap made that kept calories flat and raised protein",
    ],
  },
  {
    id: "communication",
    name: "Communication",
    description: "Say what you mean so people can actually hear it.",
    dailyTasks: [
      "Use the when-X-I-felt-Y-I-need-Z frame once today",
      "Reflect someone's point back before answering, once",
      "Ask one genuinely curious question in a conversation",
      "Say no to one small thing, plainly and kindly",
      "Send one message you've been putting off",
      "Validate before problem-solving, once, on purpose",
    ],
    weeklyMilestones: [
      "One hard conversation opened softly",
      "Reflection-before-response used daily",
      "One boundary stated once and held",
      "One repair attempt made or accepted out loud",
    ],
  },
  {
    id: "sleepOptimization",
    name: "Sleep optimization",
    description: "Engineer the night so the day stops fighting you.",
    dailyTasks: [
      "Set a caffeine cutoff 8 hours before bed and keep it today",
      "Screens out of reach 30 minutes before bed tonight",
      "Note tonight's bedroom temperature — cooler usually wins",
      "Keep one consistent wake time, even after a bad night",
      "Get outdoor light within an hour of waking",
      "Write tomorrow's top task before bed to park the mind",
    ],
    weeklyMilestones: [
      "Consistent wake time all seven days",
      "Caffeine cutoff held all week",
      "A wind-down that actually happens four nights",
      "Average sleep up 30 minutes over week one",
    ],
  },
  {
    id: "careerBusiness",
    name: "Career / business",
    description: "Compound your professional value 15 minutes at a time.",
    dailyTasks: [
      "Ship one small thing today and note what it was",
      "Spend 15 minutes on the skill your next role needs",
      "Write down one problem at work worth owning",
      "Reach out to one person in your field — no ask, just contact",
      "Document one thing you did this week that had impact",
      "Read for 15 minutes in your domain",
    ],
    weeklyMilestones: [
      "A brag-document started and updated",
      "One new professional contact made",
      "The next-role skill practiced five days",
      "One process improved and written down",
    ],
  },
  {
    id: "socialConfidence",
    name: "Social confidence",
    description: "Reps, not personality transplants.",
    dailyTasks: [
      "Make eye contact and greet one stranger",
      "Ask one person one question about themselves",
      "Hold one opinion out loud in a group, kindly",
      "Start one small-talk exchange on purpose",
      "Give one genuine, specific compliment",
      "Stay 10 extra minutes somewhere social instead of leaving early",
    ],
    weeklyMilestones: [
      "One conversation with a stranger that outlived hello",
      "One group moment where you spoke first",
      "Discomfort rated before and after five reps — watch it drop",
      "One social plan initiated by you",
    ],
  },
  {
    id: "discipline",
    name: "Discipline",
    description: "Keep promises to yourself until it's just who you are.",
    dailyTasks: [
      "Pick tonight's one non-negotiable for tomorrow morning",
      "Do the hardest task first, before the phone",
      "Set a 25-minute timer and single-task it",
      "Make one tiny promise to yourself and keep it today",
      "Remove one friction from tomorrow (lay out clothes, prep the bag)",
      "Note the exact moment you wanted to quit today — that's the rep",
    ],
    weeklyMilestones: [
      "The morning non-negotiable hit every day",
      "Phone untouched for the first task all week",
      "Five focused 25-minute blocks completed",
      "One week of kept micro-promises logged",
    ],
  },
  {
    id: "metaLearning",
    name: "Learning how to learn",
    description: "Make everything else on this list cheaper to acquire.",
    dailyTasks: [
      "Recall yesterday's lesson from memory before reviewing it",
      "Explain one thing you're learning in one plain paragraph",
      "Space it: review something from three days ago",
      "Swap 10 minutes of re-reading for 10 minutes of self-testing",
      "Identify the 20% of the topic doing 80% of the work",
      "Teach one idea to someone (or a rubber duck) out loud",
    ],
    weeklyMilestones: [
      "Recall-before-review practiced daily",
      "One topic mapped into its vital 20%",
      "A spaced-repetition habit started",
      "One idea taught to a real person",
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
