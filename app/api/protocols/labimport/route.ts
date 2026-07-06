import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveEntitlement } from "@/lib/server/entitlements";
import { canUseLiveCoach } from "@/lib/engine/subscription";
import { PHOTO_DAILY_BURST } from "@/lib/engine/rateLimit";
import { callerId, consumeRateLimit } from "@/lib/server/rateLimit";
import { crossOriginBlocked } from "@/lib/server/origin";
import { readJsonBody, validateImagePayload } from "@/lib/server/validate";

/**
 * AI lab import (v3 Phase 6.2, Pro) — a photo of a lab report in, extracted
 * marker rows out. Reuses the Phase 4 vision pipeline. Pure transcription:
 * the model copies names/values/units/ranges from the page; the user
 * reviews and edits EVERY value before anything saves (enforced in the UI —
 * this route never writes). No interpretation, ever.
 */

const VISION_MODEL = "claude-sonnet-5";
const MAX_IMAGE_BYTES = 1_500_000;

const LAB_SCHEMA = {
  type: "object" as const,
  properties: {
    markers: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          value: { type: "number" as const },
          unit: { type: "string" as const },
          refLow: { type: ["number", "null"] as const },
          refHigh: { type: ["number", "null"] as const },
        },
        required: ["name", "value", "unit", "refLow", "refHigh"],
        additionalProperties: false,
      },
    },
    drawDate: { type: ["string", "null"] as const, description: "YYYY-MM-DD if printed" },
    source: { type: ["string", "null"] as const, description: "lab name if printed" },
  },
  required: ["markers", "drawDate", "source"],
  additionalProperties: false,
};

export interface LabImportResult {
  markers: Array<{ name: string; value: number; unit: string; refLow: number | null; refHigh: number | null }>;
  drawDate: string | null;
  source: string | null;
}

const SYSTEM_PROMPT = `You transcribe lab-report images for a personal health record.
Rules:
- Copy marker names, numeric values, units, and the printed reference ranges exactly as shown. Use null for a missing range bound.
- Copy the draw/collection date and lab name if printed; otherwise null.
- Transcription only: never interpret results, never comment on values, never add markers that aren't printed.`;

export async function POST(request: Request) {
  if (crossOriginBlocked(request)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Lab import isn't configured — manual entry works the same." },
      { status: 503 }
    );
  }
  const ent = await resolveEntitlement(request);
  if (!ent.unmetered && !canUseLiveCoach(ent.tier)) {
    return NextResponse.json(
      { error: "AI lab import is part of Pro — manual entry stays free, always." },
      { status: 402 }
    );
  }
  const burst = await consumeRateLimit("labimport", callerId(request, ent.userId), PHOTO_DAILY_BURST);
  if (!burst.allowed) {
    return NextResponse.json(
      { error: "That's a lot of imports for one day — manual entry keeps working; the counter resets tomorrow." },
      { status: 429 }
    );
  }
  const body = await readJsonBody(request, MAX_IMAGE_BYTES + 4096);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const payload = validateImagePayload(body.value, MAX_IMAGE_BYTES);
  if (!payload.ok) {
    return NextResponse.json({ error: "Send one downscaled image." }, { status: 400 });
  }
  const { image, mediaType } = payload.value;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.VISION_MODEL ?? VISION_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: LAB_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: "Transcribe the lab markers per the schema." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The model declined this image." }, { status: 502 });
    }
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    const result = JSON.parse(text) as LabImportResult;
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lab import failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
