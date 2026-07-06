import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { LIFEGRAPH_NARRATE_RAIL } from "@/lib/engine/coachGuardrails";
import { canUseLiveCoach } from "@/lib/engine/subscription";
import { RESEARCH_DAILY_LIMIT } from "@/lib/engine/rateLimit";
import { resolveEntitlement } from "@/lib/server/entitlements";
import { callerId, consumeRateLimit } from "@/lib/server/rateLimit";
import { crossOriginBlocked } from "@/lib/server/origin";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "@/lib/server/validate";

/**
 * LifeGraph AI narration (v3.3 Phase 4, Pro; UI behind
 * NEXT_PUBLIC_FLAG_LIFEGRAPH_AI). Micro-copy tier: the model DESCRIBES the
 * deterministic pattern lines it is handed (LIFEGRAPH_NARRATE_RAIL) — it
 * never mines data or invents patterns, and the deterministic patterns stay
 * free-visible with or without this layer. Read-only; never writes.
 */

const NARRATE_MODEL = "claude-haiku-4-5-20251001";

const NARRATE_SCHEMA = {
  type: "object" as const,
  properties: { narrative: { type: "string" as const } },
  required: ["narrative"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  if (crossOriginBlocked(request)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Narration isn't configured — the patterns above are the findings." },
      { status: 503 }
    );
  }
  const ent = await resolveEntitlement(request);
  if (!ent.unmetered && !canUseLiveCoach(ent.tier)) {
    return NextResponse.json(
      { error: "The AI read is part of Pro — the patterns themselves stay free, always." },
      { status: 402 }
    );
  }
  const limit = await consumeRateLimit("lifegraph", callerId(request, ent.userId), RESEARCH_DAILY_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily narration limit reached — the patterns stay right there." },
      { status: 429 }
    );
  }

  const body = await readJsonBody(request, MAX_JSON_BODY_BYTES);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const patterns = (body.value as { patterns?: unknown } | null)?.patterns;
  if (
    !Array.isArray(patterns) ||
    patterns.length === 0 ||
    patterns.length > 4 ||
    !patterns.every((p) => typeof p === "string" && p.length > 0 && p.length <= 400)
  ) {
    return NextResponse.json({ error: "Send 1–4 pattern lines." }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.MICROCOPY_MODEL ?? NARRATE_MODEL,
      max_tokens: 300,
      system: LIFEGRAPH_NARRATE_RAIL,
      output_config: { format: { type: "json_schema", schema: NARRATE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Narrate these deterministic findings:\n${patterns.map((p) => `- ${p}`).join("\n")}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The model declined." }, { status: 502 });
    }
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    const { narrative } = JSON.parse(text) as { narrative: string };
    return NextResponse.json({ narrative });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Narration failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
