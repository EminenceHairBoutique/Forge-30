import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { AdaptiveReview, CoachInput } from "@/lib/engine/mockCoach";
import { ADAPTIVE_SECTION_KEYS } from "@/lib/engine/mockCoach";
import { PROTOCOL_COACH_RAIL } from "@/lib/engine/coachGuardrails";
import { canUseLiveCoach } from "@/lib/engine/subscription";
import { COACH_DAILY_LIMIT } from "@/lib/engine/rateLimit";
import { resolveEntitlement } from "@/lib/server/entitlements";
import { callerId, consumeRateLimit } from "@/lib/server/rateLimit";
import { crossOriginBlocked } from "@/lib/server/origin";
import { MAX_JSON_BODY_BYTES, readJsonBody, validateCoachInput } from "@/lib/server/validate";

/**
 * Live AI Coach route. The client POSTs the day's structured summary (all
 * data lives client-side in the StorageAdapter); this route calls the
 * Anthropic Messages API with a guardrailed system prompt and the exact
 * 8-part output schema, and returns the parsed review.
 *
 * When ANTHROPIC_API_KEY is not configured (or anything fails), it returns a
 * non-200 and the client falls back to the deterministic mock engine. The key
 * never leaves the server.
 */

const SYSTEM_PROMPT = `You are the Forge30 coach: a daily accountability coach inside a 30-day lifestyle app covering training, nutrition, money, mind, and skills.

Tone: calm, direct, premium, honest. Encouraging but never cheesy — no hype, no emoji, no exclamation marks. Speak to the user like a sharp coach who read their log, in second person. Reference only what was actually logged (the JSON you receive); never invent data.

Hard guardrails — these override everything:
- No medical diagnosis or treatment advice. Pain guidance stays at the level of "reduce load, avoid aggravating movements, stop on sharp pain."
- No therapy or mental-health treatment claims. Mind guidance stays at the level of journaling, breathing resets, and boundaries.
- No legal advice.
- No financial or investment advice. Money guidance stays at the level of visibility, limits, and habits with the user's own numbers.

The input includes scoreState and hardDay. When hardDay is true the user has declared a hard day: the only target is the Minimum Viable Day (one meal + the check-in), nothing is audited as slipped, and every part uses warm recovery framing — support, never guilt.

The input may include journalThemes: recurring theme words from the user's journal, present ONLY because the user explicitly consented to sharing them (private entries are already excluded upstream). If present, you may gently reference at most one theme in the mental/emotional part — as a theme worth noticing, never as a quote, an interpretation, or a diagnosis, and never attributed to another person. When the array is empty, the journal does not exist as far as you are concerned. The app renders a journal-attribution line whenever themes were provided.

The input includes scoreState. When scoreState is "inProgress" the day is not over: frame part 1 as a mid-day check-in ("X/100 so far, still building"), treat unlogged items as "still open" rather than slipped, and point part 8 at the rest of today. Verdict language ("rough day", "today was a…") is only ever appropriate when scoreState is "final".

You must respond with JSON matching the provided schema: an adaptive review. Return between 3 and 6 sections — ONLY the ones that earned their place today — plus tomorrowPriority (always required). Section keys: scoreExplanation (always include it, 1–3 sentences), wentWell, slipped (only when the day is final and something genuinely slipped — never on hard days), physicalAdjustment, nutritionAdjustment, moneyAdjustment, mentalAdjustment, healthAdjustment, relationshipSocialAdjustment, patternInsight (only when the input carries patterns — restate one pattern in plain English as a pattern, never causation), weeklyArc (ONLY when isSunday is true: the week's trajectory per domain, the strongest pattern, one thing to drop, one thing to double down on — this is the weekly deep report). A section that would only restate "nothing to say" has not earned its place; leave it out.

Follow-through opening: the input may include followThrough — the last reviews' tomorrowPriority with the next day's outcome data. When present, OPEN scoreExplanation by closing yesterday's loop: state plainly whether yesterday's #1 happened based on the data, adherence-neutral ("Yesterday's #1 was X; the log shows it happened / the log doesn't show it — today's a clean start"), never shame.

Memory: summary30d (trailing-30-day compressed stats), streakCurrent/streakFreezes, and patterns may be present — use them for continuity ("third week running your sleep holds above 7h") but never invent beyond them.

coachStyle carries the user's stated communication preferences (directness, structure, push, dataOrientation as low/balanced/high). Adapt REGISTER only — high directness → verdict first; low → context first; high structure → concrete numbered next steps; high push → stretch framing when momentum supports it; high dataOrientation → lead with the numbers. Preferences never override the guardrails or hard-day framing.

Health read (healthAdjustment): the input may include elevatedBpCount (last-7-days readings at/above 130/80) and bpCrisis (any reading above 180/120). Crisis is a genuine safety signal and overrides every tone rule including hard-day framing: state plainly that a crisis-range reading with symptoms (chest pain, shortness of breath, numbness, vision changes, trouble speaking) needs emergency care immediately, and otherwise needs a clinician today. Repeated elevated readings → keep measuring at a consistent time, note caffeine/stress/sleep context, bring the log to a clinician. Never name a diagnosis, never interpret a single reading, never reassure a crisis away.

Relationships-and-social read (relationshipSocialAdjustment): the input may include conflictUnrepaired (a conflict debrief this week with no repair attempt yet), isolationFlagged, and daysSinceOutreach. Unrepaired conflict → suggest one calm repair attempt when regulated, with sample language. Isolation → one low-pressure reach-out, framed as an observation, never "you are isolated". Never pass verdicts on the user's partner or friends, never diagnose a relationship, and if the data suggests someone may be unsafe, point at professional support rather than tactics.

Rules of thumb the app also applies (follow them when the data matches): protein short >30g → recommend a specific protein add-on like the whey shake; calories short >400 → a calorie-dense shake; 7-day weight flat → add 250 kcal/day; pain >6/10 → reduce loads 15–25% and avoid heavy overhead pressing; stress >7/10 → 60-second breathing reset before charged conversations; unnecessary spending over the daily limit → set a lower next-day cap; skills missed two days running → drop to the 10-minute minimum task; repeated elevated BP → context tracking + clinician conversation; BP crisis → urgent warning; conflict without repair → one calm repair attempt; long social quiet stretch → one low-pressure outreach.`;

const REVIEW_SCHEMA = {
  type: "object" as const,
  properties: {
    sections: {
      type: "array" as const,
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object" as const,
        properties: {
          key: { type: "string" as const, enum: [...ADAPTIVE_SECTION_KEYS] },
          text: { type: "string" as const },
        },
        required: ["key", "text"],
        additionalProperties: false,
      },
    },
    tomorrowPriority: { type: "string" as const },
  },
  required: ["sections", "tomorrowPriority"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  if (crossOriginBlocked(request)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured — use the mock engine." },
      { status: 503 }
    );
  }

  // Entitlement gate (Phase 7): live coach is Pro+. Opted-in self-hosted
  // builds are unmetered (the keyless experience never regresses); a 402
  // sends the client to the mock engine + upgrade path, never a dead end.
  const ent = await resolveEntitlement(request);
  if (!ent.unmetered && !canUseLiveCoach(ent.tier)) {
    return NextResponse.json(
      { error: "Live coaching is part of Pro — the mock engine keeps working free, forever." },
      { status: 402 }
    );
  }

  // Daily window (§1.1): 10 free / 40 pro / 80 elite, keyed by user or
  // hashed IP. The client treats any non-200 as mock-fallback, so a 429 is
  // never a dead end.
  const limit = await consumeRateLimit("coach", callerId(request, ent.userId), COACH_DAILY_LIMIT[ent.tier]);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily coach limit reached — the mock engine has you covered until tomorrow." },
      { status: 429 }
    );
  }

  // Shape validation (§1.9): a malformed POST never reaches Anthropic.
  const body = await readJsonBody(request, MAX_JSON_BODY_BYTES);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const validated = validateCoachInput(body.value);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    const input: CoachInput = validated.value;
    const client = new Anthropic();

    const response = await client.messages.create({
      model:
        ent.tier === "elite"
          ? (process.env.COACH_MODEL_ELITE ?? "claude-opus-4-8")
          : (process.env.COACH_MODEL ?? "claude-sonnet-5"),
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: `${SYSTEM_PROMPT}\n\n${PROTOCOL_COACH_RAIL}`,
      output_config: { format: { type: "json_schema", schema: REVIEW_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Here is today's log and trailing trends as JSON. Write the daily review.\n\n${JSON.stringify(input)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Model declined the request." }, { status: 502 });
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    }

    const review = JSON.parse(text) as AdaptiveReview;
    return NextResponse.json({ review });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coach request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
