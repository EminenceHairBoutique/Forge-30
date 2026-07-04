import type { ISODate } from "@/lib/types";
import { getJurisdiction } from "@/lib/data/recordingLaw";

/**
 * Recording-consent engine (Phase NEXT C) — pure. Maps a jurisdiction
 * selection to the consent flow the app enforces.
 *
 * THE LOAD-BEARING DESIGN DECISION: the default is protective. If the
 * jurisdiction is unset, unknown, mixed, or the user is traveling, the app
 * behaves as if all-party consent is required. One-party behavior is only
 * ever unlocked by an affirmative, informed selection of a one-party
 * jurisdiction with traveling off. Nothing in this module is legal advice,
 * and the dataset it reads is seed data pending counsel review.
 */

export type ConsentRegime = "one-party" | "all-party" | "mixed" | "unknown";

export interface JurisdictionEntry {
  code: string;
  name: string;
  regime: ConsentRegime;
  /** Plain-language note — always framed as general info, not legal advice. */
  note: string;
  /** When this entry was last reviewed (seed date until counsel review). */
  lastReviewed: ISODate;
}

export type ConsentStep = "confirm-jurisdiction" | "acknowledge" | "spoken-notice" | "record";

export interface RecordingRequirement {
  jurisdiction: JurisdictionEntry | null;
  /** Regime on file for the selection ("unknown" when unset/unrecognized). */
  regime: ConsentRegime;
  /** What the app enforces — never looser than the regime on file. */
  effectiveRegime: "one-party" | "all-party";
  /** The consent flow, in order. Recording is always last. */
  steps: ConsentStep[];
  /** Plain-language explanation for the UI (not legal advice). */
  note: string;
}

/** The spoken notice the app displays for reading aloud at the start, so
 *  consent lands on the recording itself. */
export const SPOKEN_NOTICE = "This conversation is being recorded with everyone's consent.";

export const NOT_LEGAL_ADVICE =
  "This is general information to support a consent-first flow, not legal advice — laws change and vary by situation.";

export function getRecordingRequirement(
  jurisdictionCode: string | undefined,
  opts: { traveling?: boolean } = {}
): RecordingRequirement {
  const jurisdiction = getJurisdiction(jurisdictionCode);
  const regime: ConsentRegime = jurisdiction?.regime ?? "unknown";

  // Protective default: only an affirmative, non-traveling, known one-party
  // selection relaxes anything — and even then the spoken notice is offered.
  const effectiveRegime: "one-party" | "all-party" =
    regime === "one-party" && !opts.traveling ? "one-party" : "all-party";

  const steps: ConsentStep[] =
    effectiveRegime === "all-party"
      ? ["confirm-jurisdiction", "acknowledge", "spoken-notice", "record"]
      : ["confirm-jurisdiction", "acknowledge", "record"];

  const note =
    effectiveRegime === "all-party"
      ? opts.traveling && regime === "one-party"
        ? `You're marked as traveling, so the app uses the most protective flow: everyone's consent, stated on the recording. ${NOT_LEGAL_ADVICE}`
        : `Where you've set your location, recording generally requires everyone's consent — the app builds that consent into the flow. ${NOT_LEGAL_ADVICE}`
      : `Where you've set your location, a participant can generally record — but consent from everyone is still the respectful default, and the safest one across state lines. ${NOT_LEGAL_ADVICE}`;

  return { jurisdiction, regime, effectiveRegime, steps, note };
}
