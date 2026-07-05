/**
 * Protocols reference data (v3 Phase 6).
 *
 * GENERAL EDUCATION ONLY (V3_SPEC §6.0.4): everything here is generic,
 * sourced, published information — marker definitions, standard reference
 * ranges (editable by the user to match their own lab's ranges), anatomical
 * injection sites, and published half-lives. Nothing here is personalized,
 * and nothing anywhere in the app turns this data into dose guidance. The
 * half-life table exists solely to prefill the ESTIMATE level curve, which
 * is labeled as published pharmacokinetics, not a measurement.
 */

export interface InjectionSite {
  id: string;
  label: string;
  /** Broad region for the body-map layout. */
  region: "shoulder" | "hip" | "thigh" | "chest" | "abdomen";
  side: "left" | "right" | "center";
  /** Days of rest generally suggested between uses of the same site — a
   *  rotation-bookkeeping default, not medical advice. */
  restDays: number;
}

/** The 11 standard rotation sites the category tracks. */
export const PROTOCOL_SITES: InjectionSite[] = [
  { id: "deltL", label: "Left deltoid", region: "shoulder", side: "left", restDays: 7 },
  { id: "deltR", label: "Right deltoid", region: "shoulder", side: "right", restDays: 7 },
  { id: "gluteL", label: "Left glute", region: "hip", side: "left", restDays: 7 },
  { id: "gluteR", label: "Right glute", region: "hip", side: "right", restDays: 7 },
  { id: "vgluteL", label: "Left ventrogluteal", region: "hip", side: "left", restDays: 7 },
  { id: "vgluteR", label: "Right ventrogluteal", region: "hip", side: "right", restDays: 7 },
  { id: "quadL", label: "Left quad", region: "thigh", side: "left", restDays: 7 },
  { id: "quadR", label: "Right quad", region: "thigh", side: "right", restDays: 7 },
  { id: "pecL", label: "Left pec", region: "chest", side: "left", restDays: 7 },
  { id: "pecR", label: "Right pec", region: "chest", side: "right", restDays: 7 },
  { id: "abdomen", label: "Abdomen (subQ)", region: "abdomen", side: "center", restDays: 3 },
];

export interface LabMarkerDef {
  name: string;
  unit: string;
  /** Common adult reference range — informational defaults the user edits to
   *  match the ranges printed on their own report. */
  refLow: number | null;
  refHigh: number | null;
  /** One-line generic education: what the marker is, never what to do. */
  about: string;
}

/** 30+ marker catalog. Ranges vary by lab and assay — the printed report wins. */
export const LAB_MARKER_CATALOG: LabMarkerDef[] = [
  { name: "Total Testosterone", unit: "ng/dL", refLow: 300, refHigh: 1000, about: "Total circulating testosterone, bound and free." },
  { name: "Free Testosterone", unit: "pg/mL", refLow: 9, refHigh: 26, about: "The unbound, biologically available fraction." },
  { name: "SHBG", unit: "nmol/L", refLow: 16, refHigh: 55, about: "The carrier protein that binds sex hormones." },
  { name: "Estradiol (sensitive)", unit: "pg/mL", refLow: 8, refHigh: 35, about: "Estrogen measured by the sensitive/LC-MS assay." },
  { name: "Hematocrit", unit: "%", refLow: 38.3, refHigh: 48.6, about: "The red-blood-cell fraction of blood volume." },
  { name: "Hemoglobin", unit: "g/dL", refLow: 13.2, refHigh: 16.6, about: "The oxygen-carrying protein in red cells." },
  { name: "PSA", unit: "ng/mL", refLow: 0, refHigh: 4, about: "Prostate-specific antigen." },
  { name: "IGF-1", unit: "ng/mL", refLow: 88, refHigh: 240, about: "Growth-factor marker commonly monitored on GH therapy." },
  { name: "LH", unit: "IU/L", refLow: 1.7, refHigh: 8.6, about: "Luteinizing hormone, the pituitary signal." },
  { name: "FSH", unit: "IU/L", refLow: 1.5, refHigh: 12.4, about: "Follicle-stimulating hormone." },
  { name: "Prolactin", unit: "ng/mL", refLow: 4, refHigh: 15.2, about: "Pituitary hormone monitored on some protocols." },
  { name: "Total Cholesterol", unit: "mg/dL", refLow: null, refHigh: 200, about: "Total blood cholesterol." },
  { name: "LDL", unit: "mg/dL", refLow: null, refHigh: 100, about: "Low-density lipoprotein." },
  { name: "HDL", unit: "mg/dL", refLow: 40, refHigh: null, about: "High-density lipoprotein." },
  { name: "Triglycerides", unit: "mg/dL", refLow: null, refHigh: 150, about: "Blood fats." },
  { name: "ALT", unit: "U/L", refLow: 7, refHigh: 55, about: "A liver enzyme." },
  { name: "AST", unit: "U/L", refLow: 8, refHigh: 48, about: "A liver enzyme." },
  { name: "Fasting Glucose", unit: "mg/dL", refLow: 70, refHigh: 99, about: "Blood sugar after an overnight fast." },
  { name: "HbA1c", unit: "%", refLow: 4, refHigh: 5.6, about: "Three-month average blood sugar." },
  { name: "Fasting Insulin", unit: "µIU/mL", refLow: 2.6, refHigh: 24.9, about: "Insulin after an overnight fast." },
  { name: "TSH", unit: "mIU/L", refLow: 0.4, refHigh: 4.5, about: "Thyroid-stimulating hormone." },
  { name: "Free T3", unit: "pg/mL", refLow: 2.3, refHigh: 4.1, about: "Active thyroid hormone." },
  { name: "Free T4", unit: "ng/dL", refLow: 0.8, refHigh: 1.8, about: "Thyroid hormone reservoir." },
  { name: "Creatinine", unit: "mg/dL", refLow: 0.74, refHigh: 1.35, about: "Kidney-function marker." },
  { name: "eGFR", unit: "mL/min", refLow: 90, refHigh: null, about: "Estimated kidney filtration rate." },
  { name: "Vitamin D (25-OH)", unit: "ng/mL", refLow: 30, refHigh: 100, about: "Vitamin D status." },
  { name: "Ferritin", unit: "ng/mL", refLow: 24, refHigh: 336, about: "Iron stores." },
  { name: "CRP (hs)", unit: "mg/L", refLow: null, refHigh: 3, about: "A general inflammation marker." },
  { name: "DHEA-S", unit: "µg/dL", refLow: 102, refHigh: 416, about: "Adrenal androgen precursor." },
  { name: "Cortisol (AM)", unit: "µg/dL", refLow: 6, refHigh: 18.4, about: "Morning stress-axis hormone." },
  { name: "WBC", unit: "10³/µL", refLow: 3.4, refHigh: 9.6, about: "White blood cells." },
  { name: "Platelets", unit: "10³/µL", refLow: 135, refHigh: 317, about: "Clotting cells." },
];

export interface HalfLifeEntry {
  /** Matched case-insensitively against the compound name the user enters. */
  match: string;
  halfLifeHours: number;
}

/**
 * Published elimination half-lives (approximate, from prescribing
 * information and published pharmacokinetics). Used ONLY to prefill the
 * estimate curve; the user can override with the value from their own
 * pharmacy insert. Estimates, never measurements.
 */
export const PUBLISHED_HALF_LIVES: HalfLifeEntry[] = [
  { match: "testosterone cypionate", halfLifeHours: 192 },
  { match: "testosterone enanthate", halfLifeHours: 108 },
  { match: "testosterone propionate", halfLifeHours: 19 },
  { match: "testosterone undecanoate", halfLifeHours: 500 },
  { match: "somatropin", halfLifeHours: 3.8 },
  { match: "hgh", halfLifeHours: 3.8 },
  { match: "semaglutide", halfLifeHours: 168 },
  { match: "tirzepatide", halfLifeHours: 120 },
  { match: "liraglutide", halfLifeHours: 13 },
  { match: "hcg", halfLifeHours: 33 },
  { match: "anastrozole", halfLifeHours: 46 },
  { match: "enclomiphene", halfLifeHours: 10 },
  { match: "sermorelin", halfLifeHours: 0.2 },
  { match: "tesamorelin", halfLifeHours: 0.5 },
  { match: "bpc-157", halfLifeHours: 4 },
  { match: "cjc-1295", halfLifeHours: 168 },
  { match: "ipamorelin", halfLifeHours: 2 },
];

export function publishedHalfLife(compoundName: string): number | null {
  const lower = compoundName.toLowerCase();
  const hit = PUBLISHED_HALF_LIVES.find((h) => lower.includes(h.match));
  return hit?.halfLifeHours ?? null;
}

export const PROTOCOL_SYMPTOM_TAGS: { tag: string; label: string }[] = [
  { tag: "acne", label: "Acne" },
  { tag: "waterRetention", label: "Water retention" },
  { tag: "nightSweats", label: "Night sweats" },
  { tag: "gi", label: "GI upset" },
  { tag: "injectionSite", label: "Injection-site reaction" },
];

/** Persistent framing lines — patient-record register, safetyCopy-tested. */
export const PROTOCOL_DISCLAIMER =
  "A record of your prescribed protocol, kept for you and your provider. Forge30 never suggests, calculates, or adjusts doses — protocol decisions belong with your prescriber.";

export const CURVE_DISCLAIMER =
  "Estimate from published pharmacokinetics of your entered doses — not a measurement, not guidance. Labs measure; this only sketches.";

export const LAB_RANGE_DISCLAIMER =
  "Reference ranges vary by lab — edit these to match your printed report. Out-of-range values are flagged for visibility only; discuss them with your provider.";
