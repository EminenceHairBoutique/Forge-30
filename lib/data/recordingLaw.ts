import type { ConsentRegime, JurisdictionEntry } from "@/lib/engine/recordingLaw";

/**
 * ============================================================================
 * SEED DATA — REQUIRES COUNSEL VERIFICATION BEFORE ANY PRODUCTION FLIP.
 *
 * These entries reflect commonly cited positions on recording-consent law,
 * compiled for development of the consent-first flow ONLY. They are NOT
 * verified legal fact, NOT legal advice, and MUST NOT be presented to users
 * as either until counsel has reviewed every entry (see
 * RECORDING_LEGAL_REVIEW.md). Every UI surface rendering this data carries a
 * "general information, not legal advice" line, and the engine treats
 * unknown/mixed/unset/traveling as all-party regardless of what's here.
 * ============================================================================
 */

const LAST_REVIEWED = "2026-07-04"; // seed date — replaced by counsel review date

/** Commonly cited all-party (two-party) consent states. */
const ALL_PARTY: Record<string, string> = {
  CA: "California",
  FL: "Florida",
  IL: "Illinois",
  MD: "Maryland",
  MA: "Massachusetts",
  MT: "Montana",
  NH: "New Hampshire",
  PA: "Pennsylvania",
  WA: "Washington",
};

/** States commonly described as mixed/context-dependent. */
const MIXED: Record<string, string> = {
  CT: "Connecticut",
  DE: "Delaware",
  MI: "Michigan",
  NV: "Nevada",
  OR: "Oregon",
  VT: "Vermont",
};

/** Remaining US states + DC, commonly cited as one-party. */
const ONE_PARTY: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CO: "Colorado",
  DC: "District of Columbia", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  NE: "Nebraska", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function entry(code: string, name: string, regime: ConsentRegime, note: string): JurisdictionEntry {
  return { code, name, regime, note, lastReviewed: LAST_REVIEWED };
}

export const RECORDING_JURISDICTIONS: JurisdictionEntry[] = [
  ...Object.entries(ALL_PARTY).map(([code, name]) =>
    entry(
      code,
      name,
      "all-party",
      "Commonly cited as requiring every participant's consent to record a conversation. General information, not legal advice."
    )
  ),
  ...Object.entries(MIXED).map(([code, name]) =>
    entry(
      code,
      name,
      "mixed",
      "Commonly described as context-dependent (for example, differing by civil vs. criminal context or in-person vs. electronic). The app treats this as all-party. General information, not legal advice."
    )
  ),
  ...Object.entries(ONE_PARTY).map(([code, name]) =>
    entry(
      code,
      name,
      "one-party",
      "Commonly cited as allowing a participant in the conversation to record it. Calls that cross state or national lines can involve stricter rules, which is why the safest practice is everyone's consent. General information, not legal advice."
    )
  ),
  entry(
    "INTL",
    "Outside the United States",
    "unknown",
    "Rules vary widely by country. The app treats this as requiring everyone's consent. General information, not legal advice."
  ),
  entry(
    "UNSET",
    "Prefer not to say",
    "unknown",
    "Without a jurisdiction, the app uses the most protective flow: everyone's consent. General information, not legal advice."
  ),
].sort((a, b) => a.name.localeCompare(b.name));

export function getJurisdiction(code: string | undefined): JurisdictionEntry | null {
  if (!code) return null;
  return RECORDING_JURISDICTIONS.find((j) => j.code === code) ?? null;
}
