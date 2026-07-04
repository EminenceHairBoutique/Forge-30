# RECORDING_LEGAL_REVIEW — counsel sign-off scope for `consensualRecording`

The consensual-recording feature (Phase NEXT, workstream C) is **complete and demo-able in
development builds only**. `FLAGS.consensualRecording` evaluates to `false` in every
production build (`process.env.NODE_ENV === "development"` — the `devTierSwitcher`
precedent). **It must not flip to production until counsel has signed off on every item
below.** `realtimeAnalysis` remains fully off and is not part of this review.

## What exists (for counsel's orientation)

- `lib/data/recordingLaw.ts` — jurisdiction → consent-regime dataset (**seed data**, marked
  as requiring verification in the file header). US states + DC, "Outside the United
  States", "Prefer not to say".
- `lib/engine/recordingLaw.ts` — pure engine: `getRecordingRequirement(jurisdiction,
  { traveling })`. **Protective default**: unset, unknown, unrecognized, mixed, or traveling
  ⇒ the app behaves as if all-party consent is required. One-party behavior unlocks only
  via an affirmative selection of a known one-party jurisdiction with traveling off.
  Unit-tested, including the default.
- `components/recording/RecordingSheet.tsx` — the flow: manual jurisdiction picker →
  regime display (always with a "general information, not legal advice" line) → on-screen
  consent acknowledgment (the record button does not exist before it) → a spoken-notice
  script displayed for reading aloud ("This conversation is being recorded with everyone's
  consent.") so consent lands on the recording itself → capture with a persistent REC
  indicator; closing the sheet stops the microphone. Audio is stored on-device only
  (IndexedDB), with the consent metadata stored on the recording record
  (`jurisdiction`, `effectiveRegime`, `consentAcknowledged`, `spokenNoticeShown`).
- Voice journal (self-only, no other party) and transcript paste/import are separate,
  earlier features not gated by this flag.

## What counsel must verify before the production flip

1. **Dataset accuracy** — every entry in `lib/data/recordingLaw.ts`: the all-party list
   (CA, FL, IL, MD, MA, MT, NH, PA, WA), the mixed list (CT, DE, MI, NV, OR, VT), the
   one-party default for the remaining states + DC, and the framing of the international
   and unset entries. Each verified entry should get an updated `lastReviewed` date.
2. **Protective-default sufficiency** — confirm that treating unset/unknown/mixed/traveling
   as all-party, and the cross-border caveat shown to the user, adequately addresses
   conflict-of-laws exposure (callers in different states/countries), or specify stronger
   handling.
3. **Consent-capture sufficiency** — whether an on-screen acknowledgment plus the spoken
   notice on the recording constitutes adequate consent evidence in all-party
   jurisdictions, and whether the stored consent metadata is the right record to keep
   (or whether more/less should be retained).
4. **Spoken-notice wording** — the exact sentence, and whether it should vary by
   jurisdiction.
5. **UI copy** — all regime notes and the "general information, not legal advice" framing;
   confirm no surface reads as legal advice.
6. **Geolocation assist** — currently NOT implemented (manual picker only). If a future
   geolocation suggestion is added it must only ever *suggest* the picker value; counsel
   should confirm that design before it ships.
7. **Retention & export** — recordings ride the standard on-device export/import; confirm
   no additional retention, deletion, or disclosure obligations apply.
8. **Flag-flip conditions** — the mechanism (build-time constant) and the release process
   for flipping it, including which app-store disclosures (microphone usage strings,
   privacy nutrition labels) must accompany the release.

## Standing product rules that survive review

No silent capture states, ever. The REC indicator is persistent and unmistakable. The
safetyCopy no-covert-recording rule is enforced in tests across all recording-adjacent
copy. Real-time analysis stays scaffold-only; post-conversation debrief is the product.
