/**
 * Deterministic AI Coach mock engine (Section 5.8).
 *
 * Runs whenever no ANTHROPIC_API_KEY is configured (or the live route fails).
 * Pure function of its inputs — same day, same feedback. It produces the exact
 * 8-part structure the live engine produces, with the same guardrails: no
 * medical diagnosis, no therapy claims, no legal advice, no financial advice.
 */

export interface CoachInput {
  name: string;
  dayNumber: number;
  forgeScore: number;
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  waterMl: number;
  waterTarget: number;
  workoutStatus: string;
  splitLabel: string;
  sessionPainScore: number;
  sleepHours: number;
  mobilityDone: boolean;
  mood: number;
  stress: number;
  journalDone: boolean;
  spendingChecked: boolean;
  totalSpend: number;
  unnecessarySpend: number;
  dailySpendingLimit: number;
  skillMinutes: number;
  /** True when skill tasks were missed both yesterday and the day before. */
  skillMissedTwoDays: boolean;
  /** lb change across the trailing 7 days; null = not enough weigh-ins. */
  weightTrend7d: number | null;
  /**
   * "inProgress" before the user's evening boundary: the review is a mid-day
   * check-in, never a verdict on the day. "final" after it.
   */
  scoreState: "inProgress" | "final";
  /** Hard Day mode: targets collapsed to the MVD; tone is recovery, not audit. */
  hardDay: boolean;
  /**
   * Top journal themes — present ONLY when journal consent for the coach is
   * on, and only from non-private entries (E6). Empty = no journal signal.
   * Referenced gently as themes, never quoted, never diagnosed.
   */
  journalThemes: string[];
  // --- E15 signals (optional/additive so older callers keep compiling) ------
  /** BP readings in the last 7 days at/above 130 systolic or 80 diastolic. */
  elevatedBpCount?: number;
  /** Any last-7-days reading above 180/120 — crisis copy, never gated. */
  bpCrisis?: boolean;
  /** A conflict debrief this week has no repair attempt or calm message yet. */
  conflictUnrepaired?: boolean;
  /** Social isolation signal flagged (long quiet stretch; see socialRules). */
  isolationFlagged?: boolean;
  /** Days since the last logged reach-out; null = none logged yet. */
  daysSinceOutreach?: number | null;  // --- Coach 2.0 memory (v3 Phase 5) — all optional/additive ---------------
  /** Trailing-30-day compressed summary (~1KB, computed locally). */
  summary30d?: Summary30d;
  /** Last 7 reviews' #1 priorities with the following day's outcome data. */
  followThrough?: FollowThroughEntry[];
  streakCurrent?: number;
  streakFreezes?: number;
  /** Current LifeGraph pattern lines (max 2, plain English). */
  patterns?: string[];
  /** Coaching Style & Values preferences — tone dials, never scores. */
  coachStyle?: CoachStylePrefs | null;
  /** Sunday: the review becomes the weekly arc. */
  isSunday?: boolean;
  /** Protocols (v3 Phase 6) — behavioral only: adherence over 7 days and
   *  missed scheduled items. The §6.0.3 rail governs everything the coach
   *  may say about them. */
  protocolAdherence7d?: number | null;
  protocolMissedCount7d?: number;
}

export interface CoachReview {
  scoreExplanation: string;
  wentWell: string;
  slipped: string;
  physicalAdjustment: string;
  nutritionAdjustment: string;
  moneyAdjustment: string;
  mentalAdjustment: string;
  tomorrowPriority: string;
  /** Health read (E15): BP context/crisis — appended, never replaces the 8. */
  healthAdjustment: string;
  /** Relationships & social read (E15): repair + connection nudges. */
  relationshipSocialAdjustment: string;
}

// ---------------------------------------------------------------------------
// Coach 2.0 (v3 Phase 5): memory types + the adaptive review shape.
// ---------------------------------------------------------------------------

export interface Summary30d {
  daysLogged: number;
  avgScore: number | null;
  workoutDays: number;
  proteinHitRate: number | null;
  avgSleep: number | null;
  avgStress: number | null;
  journalDays: number;
  skillMinutes: number;
  overspendDays: number;
}

export interface FollowThroughEntry {
  date: string;
  priority: string;
  /** The next day's data — the coach states the outcome, adherence-neutral. */
  nextDayLogged: boolean;
  nextDayScore: number | null;
}

export interface CoachStylePrefs {
  directness: "low" | "balanced" | "high";
  structure: "low" | "balanced" | "high";
  push: "low" | "balanced" | "high";
  dataOrientation: "low" | "balanced" | "high";
}

/** Every legal adaptive section key: the classic eight + the two new reads. */
export const ADAPTIVE_SECTION_KEYS = [
  "scoreExplanation",
  "wentWell",
  "slipped",
  "physicalAdjustment",
  "nutritionAdjustment",
  "moneyAdjustment",
  "mentalAdjustment",
  "healthAdjustment",
  "relationshipSocialAdjustment",
  "patternInsight",
  "weeklyArc",
] as const;

export type AdaptiveSectionKey = (typeof ADAPTIVE_SECTION_KEYS)[number];

export interface AdaptiveReview {
  sections: { key: AdaptiveSectionKey; text: string }[];
  tomorrowPriority: string;
}

export const MIN_ADAPTIVE_SECTIONS = 3;
export const MAX_ADAPTIVE_SECTIONS = 6;

/**
 * Deterministic adaptive selection over a full legacy review: only the
 * sections that earned their place today, 3–6 of them, in a stable order.
 * The mock path and the live-fallback path both use this, so old and new
 * engines emit the same shape.
 */
export function adaptiveFromLegacy(review: CoachReview, input: CoachInput): AdaptiveReview {
  const sections: { key: AdaptiveSectionKey; text: string }[] = [];
  const push = (key: AdaptiveSectionKey, text: string | undefined, earned: boolean) => {
    if (earned && text && text.trim() !== "" && sections.length < MAX_ADAPTIVE_SECTIONS) {
      sections.push({ key, text });
    }
  };

  // The score read always earns its place; it opens with follow-through when
  // yesterday's priority is known (the live prompt does the same).
  push("scoreExplanation", review.scoreExplanation, true);
  // Weekly arc owns Sunday; pattern insight rides any day a pattern exists.
  push("weeklyArc", weeklyArcText(input), input.isSunday === true && !!input.summary30d);
  push("patternInsight", input.patterns?.[0], (input.patterns?.length ?? 0) > 0);
  push("wentWell", review.wentWell, input.forgeScore > 0 || input.hardDay);
  push("slipped", review.slipped, input.scoreState === "final" && !input.hardDay);

  // One or two domain adjustments, picked by the day's largest gaps.
  const gaps: Array<{ key: AdaptiveSectionKey; text: string; weight: number }> = [
    { key: "healthAdjustment", text: review.healthAdjustment, weight: input.bpCrisis ? 100 : (input.elevatedBpCount ?? 0) > 1 ? 40 : 0 },
    { key: "nutritionAdjustment", text: review.nutritionAdjustment, weight: Math.max(0, input.proteinTarget - input.protein) / 10 + Math.max(0, input.calorieTarget - input.calories) / 200 },
    { key: "physicalAdjustment", text: review.physicalAdjustment, weight: input.sessionPainScore > 4 ? 30 : input.workoutStatus === "none" ? 8 : 2 },
    { key: "moneyAdjustment", text: review.moneyAdjustment, weight: input.unnecessarySpend > input.dailySpendingLimit ? 25 : 1 },
    { key: "mentalAdjustment", text: review.mentalAdjustment, weight: input.stress >= 7 ? 20 : input.mood > 0 && input.mood <= 3 ? 15 : 1 },
    { key: "relationshipSocialAdjustment", text: review.relationshipSocialAdjustment, weight: input.conflictUnrepaired ? 22 : input.isolationFlagged ? 12 : 0 },
  ];
  for (const g of gaps.sort((a, b) => b.weight - a.weight)) {
    if (sections.length >= MAX_ADAPTIVE_SECTIONS) break;
    push(g.key, g.text, g.weight >= 5);
  }
  // Floor: never fewer than three sections — fill with the strongest leftovers.
  for (const g of gaps.sort((a, b) => b.weight - a.weight)) {
    if (sections.length >= MIN_ADAPTIVE_SECTIONS) break;
    if (!sections.some((x) => x.key === g.key)) push(g.key, g.text, true);
  }

  return { sections, tomorrowPriority: review.tomorrowPriority };
}

/** Deterministic Sunday weekly-arc line from the 30-day summary (mock path). */
export function weeklyArcText(input: CoachInput): string {
  const s = input.summary30d;
  if (!s) return "";
  const scoreTxt = s.avgScore !== null ? `average score ${s.avgScore}` : "score still building";
  const strongest = input.patterns?.[0];
  return (
    `The week in one arc: ${s.daysLogged} days logged, ${s.workoutDays} training days, ` +
    `${scoreTxt}, protein hit ${s.proteinHitRate !== null ? Math.round(s.proteinHitRate * 100) + "%" : "—"} of days. ` +
    (strongest ? `Strongest pattern: ${strongest} ` : "") +
    `One thing to drop: whatever cost the most with the least return this week. ` +
    `One thing to double down on: the single habit that held every hard day.`
  );
}


/**
 * Health part (E15). Crisis copy is a genuine safety signal: it wins over
 * everything, is never softened, and shows even on hard days. Everything
 * below crisis stays context-tracking + "discuss with your clinician" —
 * never a diagnosis.
 */
function healthAdjustmentFor(input: CoachInput): string {
  if (input.bpCrisis) {
    return "A blood-pressure reading this week was above 180/120 — crisis range. If it came with chest pain, shortness of breath, numbness, vision changes, or trouble speaking, that needs emergency care immediately. Otherwise re-measure after 5 quiet minutes, and if it's still that high, contact a clinician now — today, not at the next check-up.";
  }
  const elevated = input.elevatedBpCount ?? 0;
  if (elevated >= 3) {
    return `${elevated} readings this week came in at or above 130/80. That's a pattern worth taking seriously the calm way: keep measuring at the same time each day, note caffeine, stress, and sleep next to each reading, and bring the log to your clinician. Tracking is your job; interpreting it is theirs.`;
  }
  if (elevated > 0) {
    return `${elevated === 1 ? "One reading" : `${elevated} readings`} this week ran at or above 130/80 — context matters (caffeine, stress, a rushed measurement), so keep logging at the same time daily and let the trend, not one number, do the talking.`;
  }
  return "No health flags in the log this week. Keep the basics boring: sleep, water, movement, and the occasional BP reading so the baseline stays current.";
}

/**
 * Relationships & social part (E15). Unrepaired conflict outranks isolation;
 * both stay observation + one small move — no verdicts on anyone.
 */
function relationshipSocialAdjustmentFor(input: CoachInput): string {
  if (input.conflictUnrepaired) {
    return "There's a conflict debrief from this week without a repair attempt yet. When you're at a 4/10 or calmer, one calm line is enough: \"I didn't like how that went, and I don't think you did either — can we take another run at it?\" Repair is a move, not a mood.";
  }
  if (input.isolationFlagged) {
    const days = input.daysSinceOutreach;
    return `${typeof days === "number" ? `It's been ${days} days since a logged reach-out` : "It's been a while since a logged reach-out"} — quiet weeks compound quietly. One low-pressure move counts fully: a two-line text to someone on your reconnect list, no agenda.`;
  }
  return "Nothing flagged on the relationship or social front. Connection is maintained in small units — one reach-out this week keeps it that way.";
}

export function generateMockAIFeedback(input: CoachInput): CoachReview {
  // Hard Day mode: the whole review reframes around the Minimum Viable Day.
  // No slip audit, no target math — recovery is the assignment (spec: never
  // punish hard days; warm recovery language always).
  if (input.hardDay) {
    return generateHardDayReview(input);
  }

  const proteinShort = Math.max(0, Math.round(input.proteinTarget - input.protein));
  const caloriesShort = Math.max(0, input.calorieTarget - input.calories);
  const weightFlat = input.weightTrend7d !== null && Math.abs(input.weightTrend7d) < 0.5;
  const highPain = input.sessionPainScore > 6;
  const highStress = input.stress > 7;
  const overspent = input.unnecessarySpend > input.dailySpendingLimit;
  const workoutDone = input.workoutStatus === "complete" || input.workoutStatus === "rest";

  // 1. Score explanation — verdict language only for a completed day.
  const scoreExplanation =
    input.scoreState === "inProgress"
      ? `Day ${input.dayNumber} is still in progress — ${input.forgeScore}/100 so far, and every point below is still open. This is a snapshot to steer the rest of today, not a verdict.`
      : `Today was a ${input.forgeScore}/100 on day ${input.dayNumber}. ` +
        (input.forgeScore >= 80
          ? "That's a winning day — the loop held."
          : input.forgeScore >= 50
            ? "A partial day: some pillars held, some didn't. The gaps below are fixable tomorrow."
            : "A rough day on paper. One bad day doesn't break 30 — but tomorrow needs a plan, not momentum.");

  // 2. What went well
  const wins: string[] = [];
  if (workoutDone)
    wins.push(input.workoutStatus === "rest" ? "you took the rest day properly" : `you finished ${input.splitLabel || "the workout"}`);
  if (proteinShort <= 10 && input.protein > 0) wins.push("protein landed on target");
  if (caloriesShort <= 200 && input.calories > 0) wins.push("calories were right where they should be");
  if (input.waterMl >= input.waterTarget && input.waterTarget > 0) wins.push("water was handled");
  if (input.sleepHours >= 7) wins.push(`${input.sleepHours}h of sleep is real recovery`);
  if (input.journalDone) wins.push("you did the mind check-in");
  if (input.spendingChecked && !overspent) wins.push("spending stayed visible and inside the limit");
  if (input.skillMinutes >= 10) wins.push(`${input.skillMinutes} minutes of skill work went in`);
  const inProgress = input.scoreState === "inProgress";
  const wentWell =
    wins.length > 0
      ? `${wins[0]!.charAt(0).toUpperCase()}${wins[0]!.slice(1)}${wins.slice(1).length ? ", and " + wins.slice(1).join(", ") : ""}.`
      : inProgress
        ? "Nothing on the board yet — the day's still open, and the first log starts the loop."
        : "Nothing logged as a win today — that itself is the finding. Log first, judge later.";

  // 3. What slipped — mid-day, an unlogged item is "still open", not a slip.
  const slips: string[] = [];
  if (input.calories === 0 && input.protein === 0)
    slips.push(inProgress ? "no meals logged yet" : "no meals were logged");
  else {
    if (caloriesShort > 400) slips.push(`calories are ${caloriesShort} short${inProgress ? " so far" : ""}`);
    if (proteinShort > 30) slips.push(`protein is ${proteinShort}g behind${inProgress ? " so far" : ""}`);
  }
  if (!workoutDone && input.workoutStatus !== "inProgress")
    slips.push(inProgress ? "the workout is still open" : "the workout didn't happen");
  if (highPain) slips.push(`pain hit ${input.sessionPainScore}/10 in training`);
  if (input.sleepHours > 0 && input.sleepHours < 6) slips.push(`sleep was only ${input.sleepHours}h`);
  if (highStress) slips.push(`stress ran at ${input.stress}/10`);
  if (overspent) slips.push(`unnecessary spending hit $${input.unnecessarySpend.toFixed(0)} against a $${input.dailySpendingLimit.toFixed(0)} limit`);
  if (!input.journalDone) slips.push(inProgress ? "the mind check-in is still open" : "no mind check-in");
  if (input.skillMinutes < 10)
    slips.push(inProgress ? "skill practice hasn't had its 10 minutes yet" : "skill practice didn't get its 10 minutes");
  const slipped =
    slips.length > 0
      ? `${slips[0]!.charAt(0).toUpperCase()}${slips[0]!.slice(1)}${slips.slice(1).length ? "; " + slips.slice(1).join("; ") : ""}.`
      : "Nothing meaningfully slipped. Protect that.";

  // 4. Physical adjustment — pain rules dominate
  const physicalAdjustment = highPain
    ? `Pain was ${input.sessionPainScore}/10: cut loads 15–25% tomorrow, skip heavy overhead pressing, and keep pulls chest-supported. Serratus slides, dead bugs, and breathing drills before bed.`
    : !workoutDone
      ? inProgress
        ? "Today's session is still open. When you get to it, the warm-up checklist comes first — it's the gate, not a suggestion."
        : "Tomorrow's session is the anchor. Do the warm-up checklist first — it's the gate, not a suggestion."
      : input.mobilityDone
        ? "Training and mobility both landed. Keep loads where they are and add a rep before you add weight."
        : "Training happened but mobility didn't. Ten minutes of the prehab circuit tonight or tomorrow morning.";

  // 5. Nutrition adjustment — spec rules: protein short >30g → named quick-add;
  // calories short >400 → calorie-dense shake; weight flat 7d → +250 kcal.
  let nutritionAdjustment: string;
  if (proteinShort > 30 && caloriesShort > 400) {
    nutritionAdjustment = `You're ${proteinShort}g of protein and ${caloriesShort} kcal behind target days like today. The whey shake (whey, banana, peanut butter, milk) closes both in one glass — schedule it, don't leave it to memory.`;
  } else if (proteinShort > 30) {
    nutritionAdjustment = `Protein is the gap: ${proteinShort}g short. Add the whey shake as a fixed add-on — it's ~46g without thinking.`;
  } else if (caloriesShort > 400) {
    nutritionAdjustment = `Calories ran ${caloriesShort} short. Add a calorie-dense shake or the rice + olive oil booster to the last meal.`;
  } else if (weightFlat) {
    nutritionAdjustment = "The scale has been flat for a week while you're eating to plan — add 250 calories per day and hold it for the next 7 days.";
  } else {
    nutritionAdjustment = "Intake is on plan. Keep the meal rotation boring and repeatable — boring is what works.";
  }

  // 6. Money adjustment — overspend → next-day cap.
  const moneyAdjustment = overspent
    ? `Unnecessary spending went $${(input.unnecessarySpend - input.dailySpendingLimit).toFixed(0)} over the limit. Set tomorrow's cap at $${Math.max(0, Math.round(input.dailySpendingLimit / 2))} and log before you buy, not after.`
    : !input.spendingChecked
      ? "The spending check didn't happen. It takes 30 seconds — do it before the day ends, even if the answer is zero."
      : "Money stayed visible and inside the line. That's the whole system working.";

  // 7. Mental adjustment — stress >7 → breathing reset + journal-before-conversations.
  // With journal consent on, the top recurring theme is named gently (a theme,
  // never a quote, never an interpretation) — the UI adds the attribution line.
  const topTheme = input.journalThemes[0];
  const mentalAdjustment = highStress
    ? `Stress was ${input.stress}/10. Do the 60-second breathing reset before any emotionally charged conversation, and journal the trigger before you respond to it.`
    : topTheme
      ? `"${topTheme}" keeps showing up in your journal this week. No verdict there — just worth a two-minute look at what's underneath it, on paper or with someone you trust.`
      : !input.journalDone
        ? "No check-in today. Two minutes tonight: mood, stress, one trigger. The pattern only shows up if you log it."
        : input.mood > 0 && input.mood <= 4
          ? "Mood ran low today. Keep the wind-down honest tonight and let sleep do the heavy lifting."
          : "Head was steady today. Bank it — do the reset once tomorrow anyway, before you need it.";

  // 8. #1 priority — highest-impact single item. Mid-day it points at the
  // rest of today; after the boundary it points at tomorrow.
  const lead = inProgress ? "Rest of today's #1" : "Tomorrow's #1";
  let tomorrowPriority: string;
  if (highPain) {
    tomorrowPriority = `${lead}: train pain-first — reduced loads, no overhead pressing, log every set's pain score.`;
  } else if (input.calories === 0) {
    tomorrowPriority = `${lead}: log every meal. The system can't coach what it can't see.`;
  } else if (caloriesShort > 400 || proteinShort > 30) {
    tomorrowPriority = `${lead}: hit the food targets — shake before bed if the numbers aren't in by dinner.`;
  } else if (weightFlat) {
    tomorrowPriority = `${lead}: add the extra 250 calories. Flat scale, flat progress.`;
  } else if (highStress) {
    tomorrowPriority = `${lead}: the breathing reset before your hardest conversation, not after it.`;
  } else if (overspent) {
    tomorrowPriority = `${lead}: spend nothing unnecessary. One clean day resets the pattern.`;
  } else if (input.skillMissedTwoDays) {
    tomorrowPriority = `${lead}: skills dropped two days running — do the 10-minute minimum task, nothing bigger.`;
  } else if (!workoutDone) {
    tomorrowPriority = `${lead}: the workout, warm-up first. Everything else follows a training day.`;
  } else {
    tomorrowPriority = inProgress
      ? `${lead}: keep doing exactly this. Close the day the way you started it.`
      : `${lead}: repeat today. Consistency is the whole game now.`;
  }

  return {
    scoreExplanation,
    wentWell,
    slipped,
    physicalAdjustment,
    nutritionAdjustment,
    moneyAdjustment,
    mentalAdjustment,
    tomorrowPriority,
    healthAdjustment: healthAdjustmentFor(input),
    relationshipSocialAdjustment: relationshipSocialAdjustmentFor(input),
  };
}

/** Recovery-framed review for Hard Day mode — deterministic like everything else. */
function generateHardDayReview(input: CoachInput): CoachReview {
  const mealLogged = input.calories > 0 || input.protein > 0;
  const mvdDone = mealLogged && input.journalDone;
  const open = mvdDone ? "" : mealLogged ? "the 2-minute check-in" : input.journalDone ? "one logged meal" : "one meal and the check-in";

  return {
    scoreExplanation:
      input.scoreState === "inProgress"
        ? `You called a hard day, and calling it is the right move. Today's whole assignment is the Minimum Viable Day — one meal and the check-in. The score is paused as a verdict; showing up at all is the win today.`
        : `Hard day, day ${input.dayNumber}. ${mvdDone ? "You still landed the Minimum Viable Day — that's the streak protected and the loop intact." : "The day is closed; whatever got logged, got logged. Tomorrow starts clean."}`,
    wentWell: mvdDone
      ? "You kept the minimum alive on a day that didn't want to cooperate. That's the skill this app exists to build."
      : mealLogged
        ? "A meal made it into the log even on a hard day — that's not nothing, that's the habit holding."
        : input.journalDone
          ? "You did the check-in on a hard day. Naming it is most of the work."
          : "You told the app it's a hard day instead of disappearing. That's the honest version of consistency.",
    slipped: "Nothing on the usual list counts against you today. Hard days don't get audited.",
    physicalAdjustment:
      "No training required. If moving would help, a short walk or five minutes of easy mobility counts — and stopping counts too.",
    nutritionAdjustment: mealLogged
      ? "Food's handled at the minimum level. Don't chase the targets tonight — normal service resumes tomorrow."
      : "One easy meal is the whole nutrition goal. Something simple you don't have to think about.",
    moneyAdjustment:
      "If stress wants to spend, give it the 60-second pause first. No budget review needed today.",
    mentalAdjustment:
      "Do the 60-second breathing reset once, and keep the wind-down gentle. If today keeps being heavy, talking to someone you trust — or a professional — is a strong move.",
    tomorrowPriority: mvdDone
      ? "Tomorrow's #1: nothing carried over. Start it as a normal day and see how it feels."
      : `Rest of today's #1: ${open || "the Minimum Viable Day"} — then you're done, guilt-free.`,
    // Crisis copy is never gated — a hard day doesn't soften a 180/120 reading.
    healthAdjustment: input.bpCrisis
      ? healthAdjustmentFor(input)
      : "No health homework today. Rest is the health move.",
    relationshipSocialAdjustment:
      "No relationship homework today either. If one person feels safe to be around, being around them counts.",
  };
}
