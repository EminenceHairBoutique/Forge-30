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
}

export function generateMockAIFeedback(input: CoachInput): CoachReview {
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
  const mentalAdjustment = highStress
    ? `Stress was ${input.stress}/10. Do the 60-second breathing reset before any emotionally charged conversation, and journal the trigger before you respond to it.`
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
  };
}
