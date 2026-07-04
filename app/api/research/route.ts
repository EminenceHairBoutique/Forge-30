import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/flags";

/**
 * Research mode route (E15) — fail-closed by design.
 *
 * Research answers must come from credible sources with citations and stated
 * uncertainty, and must never read as diagnosis or a treatment plan. There is
 * no deterministic mock that can honestly do that, so unlike /api/coach this
 * route has NO fallback: without a server-side ANTHROPIC_API_KEY and the
 * researchLive flag, it declines cleanly and the UI says research is
 * unavailable. It never fabricates sources.
 *
 * Useful behavior lands behind FLAGS.researchLive once a key is provisioned
 * (WAIT(ai-key) in the expansion plan): web-search-grounded answers citing
 * official medical organizations, peer-reviewed research, and clinical
 * guidelines, separating evidence from speculation.
 */
export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Research mode needs the live AI connection, which isn't configured on this server. There is deliberately no offline substitute — research without real sources isn't research.",
      },
      { status: 503 }
    );
  }

  if (!FLAGS.researchLive) {
    return NextResponse.json(
      {
        error:
          "Research mode is not enabled yet on this build (researchLive flag is off).",
      },
      { status: 501 }
    );
  }

  // FLAGS.researchLive is compile-time false until the feature ships; this
  // branch is unreachable today and exists so flipping the flag has one
  // obvious landing spot.
  return NextResponse.json(
    { error: "Research mode implementation pending." },
    { status: 501 }
  );
}
