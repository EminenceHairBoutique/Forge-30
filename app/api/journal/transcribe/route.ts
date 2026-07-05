import { NextResponse } from "next/server";
import { canUseLiveCoach } from "@/lib/engine/subscription";
import { PHOTO_DAILY_BURST } from "@/lib/engine/rateLimit";
import { resolveEntitlement } from "@/lib/server/entitlements";
import { callerId, consumeRateLimit } from "@/lib/server/rateLimit";
import { crossOriginBlocked } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/validate";

/**
 * Voice-journal transcription (v3.3 Phase 4, Pro; ships dark behind
 * NEXT_PUBLIC_FLAG_TRANSCRIPTION).
 *
 * FAIL-CLOSED BY DESIGN (DECISIONS §14): the Anthropic Messages API takes
 * no audio input, so there is no honest way to transcribe with the models
 * this app uses. The full pipeline ships now — entitlement gate, rate
 * limit, validation, and the client's review-before-save flow — and this
 * route answers 501 until the operator provisions a speech-to-text
 * provider (TRANSCRIBE_PROVIDER env selects it; none are wired yet).
 * The transcript, when one exists, is ALWAYS returned for user review and
 * editing before anything saves; this route never writes.
 */

const MAX_AUDIO_BASE64 = 6 * 1024 * 1024; // ~4.5 MB audio — beyond a 3:00 opus note

export async function POST(request: Request) {
  if (crossOriginBlocked(request)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }

  const ent = await resolveEntitlement(request);
  if (!ent.unmetered && !canUseLiveCoach(ent.tier)) {
    return NextResponse.json(
      { error: "Transcription is part of Pro — voice notes themselves stay free, always." },
      { status: 402 }
    );
  }
  const limit = await consumeRateLimit("transcribe", callerId(request, ent.userId), PHOTO_DAILY_BURST);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That's a lot of transcriptions for one day — the counter resets tomorrow." },
      { status: 429 }
    );
  }

  const body = await readJsonBody(request, MAX_AUDIO_BASE64 + 4096);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const audio = (body.value as { audio?: unknown } | null)?.audio;
  if (typeof audio !== "string" || audio.length === 0 || audio.length > MAX_AUDIO_BASE64) {
    return NextResponse.json({ error: "Send one voice note as base64 audio." }, { status: 400 });
  }

  // No STT provider is wired yet — decline cleanly; the note saves fine
  // without a transcript and can be transcribed later.
  return NextResponse.json(
    {
      error:
        "Transcription isn't available on this build yet — your voice note saves and plays back either way.",
    },
    { status: 501 }
  );
}
