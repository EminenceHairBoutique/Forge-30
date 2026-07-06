import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PHOTO_DAILY_BURST } from "@/lib/engine/rateLimit";
import { meterPhotoUse, resolveEntitlement } from "@/lib/server/entitlements";
import { callerId, consumeRateLimit } from "@/lib/server/rateLimit";
import { crossOriginBlocked } from "@/lib/server/origin";
import { readJsonBody, validateImagePayload } from "@/lib/server/validate";

/**
 * Photo meal analysis (v3 Phase 4 — the flagship logging path). The client
 * sends a downscaled JPEG (≤1024px, ~0.8 quality) as base64; the model
 * returns structured line items with per-item confidence and its stated
 * assumptions. Estimates are always labeled estimates in the UI, and any
 * failure here degrades to search/manual with no dead end.
 */

const VISION_MODEL = "claude-sonnet-5";
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB of base64 ≈ a 1024px JPEG with margin

const PHOTO_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          portionEstimate: { type: "string" as const },
          calories: { type: "number" as const },
          protein: { type: "number" as const },
          carbs: { type: "number" as const },
          fat: { type: "number" as const },
          confidence: { type: "number" as const, description: "0–1" },
        },
        required: ["name", "portionEstimate", "calories", "protein", "carbs", "fat", "confidence"],
        additionalProperties: false,
      },
    },
    overallConfidence: { type: "number" as const, description: "0–1" },
    assumptions: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["items", "overallConfidence", "assumptions"],
  additionalProperties: false,
};

export interface PhotoAnalysis {
  items: Array<{
    name: string;
    portionEstimate: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: number;
  }>;
  overallConfidence: number;
  assumptions: string[];
}

const SYSTEM_PROMPT = `You estimate the nutritional content of meals from a single photo for a personal logging app.
Rules:
- Identify each distinct food item with a realistic portion estimate ("about 1.5 cups cooked rice").
- Give calories and macros (g) per item for the estimated portion. Round sensibly.
- State every assumption that moved the numbers (cooking oil, dressing, sweetened vs not).
- confidence per item and overallConfidence are 0–1; be honest — occlusion, ambiguous sauces, and unknown preparation lower confidence.
- These are ESTIMATES for self-tracking, not medical or dietary advice. Never comment on the user's choices, body, or goals — numbers and assumptions only.`;

export async function POST(request: Request) {
  if (crossOriginBlocked(request)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Photo analysis isn't configured — search or manual entry works the same." },
      { status: 503 }
    );
  }
  // Quota gate (Phase 7): Free 3/mo taste, Pro 150/mo fair use, Elite
  // unlimited; opted-in self-hosted builds unmetered. Over-quota is a
  // friendly 402 — search and manual logging stay free forever.
  const ent = await resolveEntitlement(request);

  // Daily burst cap (§1.1) atop the monthly quota, checked BEFORE metering
  // so a burst-refused call never burns monthly quota.
  const burst = await consumeRateLimit("photo", callerId(request, ent.userId), PHOTO_DAILY_BURST);
  if (!burst.allowed) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          "That's a lot of photos for one day — the counter resets tomorrow. Search and manual logging keep working right now.",
      },
      { status: 429 }
    );
  }

  const remaining = await meterPhotoUse(ent);
  if (remaining === -1) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          ent.tier === "free"
            ? "That's the 3 free photo analyses this month — Pro makes it 150. Search and manual logging stay free, always."
            : "That's this month's fair-use limit. Search and manual logging keep working — the counter resets next month.",
      },
      { status: 402 }
    );
  }

  const body = await readJsonBody(request, MAX_IMAGE_BYTES + 4096);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const payload = validateImagePayload(body.value, MAX_IMAGE_BYTES);
  if (!payload.ok) {
    return NextResponse.json(
      { error: "Send one downscaled image (≤1024px JPEG)." },
      { status: 400 }
    );
  }
  const { image, mediaType } = payload.value;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.VISION_MODEL ?? VISION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: PHOTO_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: "Estimate this meal's items and macros per the schema." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The model declined this image." }, { status: 502 });
    }
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    const analysis = JSON.parse(text) as PhotoAnalysis;
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Photo analysis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
