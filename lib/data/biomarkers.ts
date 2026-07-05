/**
 * Biomarker seed dictionary (E7, spec §Health §Bloodwork). Typical adult
 * reference ranges — used ONLY as a fallback when the lab didn't supply its
 * own range (the lab's range always wins), and for the educational
 * "generally relates to" blurbs. Never diagnostic.
 */

export interface BiomarkerDef {
  /** Canonical display name. */
  name: string;
  /** Lowercase match aliases (paste parser). */
  aliases: string[];
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  /** What this marker generally relates to — educational, never diagnostic. */
  relatesTo: string;
}

export const BIOMARKER_DICTIONARY: BiomarkerDef[] = [
  // CBC
  { name: "WBC", aliases: ["wbc", "white blood cells", "white blood cell count", "leukocytes"], unit: "K/uL", refLow: 4.0, refHigh: 11.0, relatesTo: "immune system activity" },
  { name: "RBC", aliases: ["rbc", "red blood cells", "red blood cell count"], unit: "M/uL", refLow: 4.2, refHigh: 5.9, relatesTo: "oxygen-carrying capacity" },
  { name: "Hemoglobin", aliases: ["hemoglobin", "hgb", "hb"], unit: "g/dL", refLow: 13.0, refHigh: 17.5, relatesTo: "oxygen transport and iron status" },
  { name: "Hematocrit", aliases: ["hematocrit", "hct"], unit: "%", refLow: 38, refHigh: 50, relatesTo: "blood concentration and hydration" },
  { name: "Platelets", aliases: ["platelets", "plt", "platelet count"], unit: "K/uL", refLow: 150, refHigh: 400, relatesTo: "clotting" },
  { name: "Neutrophils", aliases: ["neutrophils", "neutrophil"], unit: "%", refLow: 40, refHigh: 70, relatesTo: "bacterial immune response" },
  { name: "Lymphocytes", aliases: ["lymphocytes", "lymphocyte"], unit: "%", refLow: 20, refHigh: 45, relatesTo: "viral immune response" },
  // CMP
  { name: "Glucose", aliases: ["glucose", "fasting glucose", "blood sugar"], unit: "mg/dL", refLow: 70, refHigh: 99, relatesTo: "blood-sugar regulation" },
  { name: "BUN", aliases: ["bun", "blood urea nitrogen"], unit: "mg/dL", refLow: 7, refHigh: 20, relatesTo: "kidney function and protein turnover" },
  { name: "Creatinine", aliases: ["creatinine"], unit: "mg/dL", refLow: 0.7, refHigh: 1.3, relatesTo: "kidney function and muscle mass" },
  { name: "eGFR", aliases: ["egfr", "gfr"], unit: "mL/min", refLow: 90, refHigh: null, relatesTo: "kidney filtration" },
  { name: "Sodium", aliases: ["sodium", "na"], unit: "mmol/L", refLow: 136, refHigh: 145, relatesTo: "fluid and electrolyte balance" },
  { name: "Potassium", aliases: ["potassium", "k"], unit: "mmol/L", refLow: 3.5, refHigh: 5.1, relatesTo: "electrolyte balance and muscle function" },
  { name: "Chloride", aliases: ["chloride", "cl"], unit: "mmol/L", refLow: 98, refHigh: 107, relatesTo: "electrolyte balance" },
  { name: "CO2", aliases: ["co2", "carbon dioxide", "bicarbonate"], unit: "mmol/L", refLow: 22, refHigh: 29, relatesTo: "acid-base balance" },
  { name: "Calcium", aliases: ["calcium", "ca"], unit: "mg/dL", refLow: 8.6, refHigh: 10.2, relatesTo: "bone and nerve function" },
  { name: "Albumin", aliases: ["albumin"], unit: "g/dL", refLow: 3.5, refHigh: 5.0, relatesTo: "protein status and liver function" },
  { name: "Total Protein", aliases: ["total protein", "protein total"], unit: "g/dL", refLow: 6.0, refHigh: 8.3, relatesTo: "overall protein status" },
  { name: "Bilirubin", aliases: ["bilirubin", "total bilirubin"], unit: "mg/dL", refLow: 0.1, refHigh: 1.2, relatesTo: "liver processing" },
  { name: "AST", aliases: ["ast", "sgot"], unit: "U/L", refLow: 10, refHigh: 40, relatesTo: "liver and muscle stress" },
  { name: "ALT", aliases: ["alt", "sgpt"], unit: "U/L", refLow: 7, refHigh: 56, relatesTo: "liver stress" },
  { name: "ALP", aliases: ["alp", "alkaline phosphatase"], unit: "U/L", refLow: 44, refHigh: 147, relatesTo: "liver and bone turnover" },
  // Lipids
  { name: "Total Cholesterol", aliases: ["total cholesterol", "cholesterol", "cholesterol total"], unit: "mg/dL", refLow: null, refHigh: 200, relatesTo: "cardiovascular risk context" },
  { name: "LDL", aliases: ["ldl", "ldl-c", "ldl cholesterol"], unit: "mg/dL", refLow: null, refHigh: 100, relatesTo: "cardiovascular risk context" },
  { name: "HDL", aliases: ["hdl", "hdl-c", "hdl cholesterol"], unit: "mg/dL", refLow: 40, refHigh: null, relatesTo: "cardiovascular risk context" },
  { name: "Triglycerides", aliases: ["triglycerides", "trig", "tg"], unit: "mg/dL", refLow: null, refHigh: 150, relatesTo: "fat metabolism and carbohydrate handling" },
  { name: "ApoB", aliases: ["apob", "apo b", "apolipoprotein b"], unit: "mg/dL", refLow: null, refHigh: 90, relatesTo: "atherogenic particle count" },
  { name: "Lp(a)", aliases: ["lp(a)", "lipoprotein(a)", "lipoprotein (a)", "lpa"], unit: "nmol/L", refLow: null, refHigh: 75, relatesTo: "inherited cardiovascular risk context" },
  // Glucose metabolism
  { name: "A1c", aliases: ["a1c", "hba1c", "hemoglobin a1c"], unit: "%", refLow: 4.0, refHigh: 5.6, relatesTo: "three-month average blood sugar" },
  { name: "Fasting Insulin", aliases: ["fasting insulin", "insulin"], unit: "uIU/mL", refLow: 2, refHigh: 20, relatesTo: "insulin sensitivity" },
  // Thyroid
  { name: "TSH", aliases: ["tsh", "thyroid stimulating hormone"], unit: "mIU/L", refLow: 0.4, refHigh: 4.5, relatesTo: "thyroid regulation" },
  { name: "Free T4", aliases: ["free t4", "ft4", "t4 free"], unit: "ng/dL", refLow: 0.8, refHigh: 1.8, relatesTo: "thyroid hormone availability" },
  { name: "Free T3", aliases: ["free t3", "ft3", "t3 free"], unit: "pg/mL", refLow: 2.3, refHigh: 4.2, relatesTo: "active thyroid hormone" },
  { name: "TPO Antibodies", aliases: ["tpo", "tpo antibodies", "thyroid antibodies", "anti-tpo"], unit: "IU/mL", refLow: null, refHigh: 35, relatesTo: "thyroid immune activity" },
  // Iron
  { name: "Ferritin", aliases: ["ferritin"], unit: "ng/mL", refLow: 30, refHigh: 400, relatesTo: "iron stores" },
  { name: "Iron", aliases: ["iron", "serum iron"], unit: "ug/dL", refLow: 60, refHigh: 170, relatesTo: "circulating iron" },
  { name: "TIBC", aliases: ["tibc", "total iron binding capacity"], unit: "ug/dL", refLow: 250, refHigh: 450, relatesTo: "iron transport capacity" },
  { name: "Transferrin Saturation", aliases: ["transferrin saturation", "tsat", "iron saturation"], unit: "%", refLow: 20, refHigh: 50, relatesTo: "iron transport usage" },
  // Vitamins
  { name: "Vitamin D", aliases: ["vitamin d", "25-oh vitamin d", "vitamin d 25-hydroxy", "25(oh)d"], unit: "ng/mL", refLow: 30, refHigh: 100, relatesTo: "bone health, immunity, and mood context" },
  { name: "Vitamin B12", aliases: ["vitamin b12", "b12", "cobalamin"], unit: "pg/mL", refLow: 300, refHigh: 900, relatesTo: "nerve function and energy metabolism" },
  { name: "Folate", aliases: ["folate", "folic acid"], unit: "ng/mL", refLow: 3, refHigh: 20, relatesTo: "cell division and red-cell production" },
  // Inflammation
  { name: "hs-CRP", aliases: ["hs-crp", "hscrp", "crp", "c-reactive protein"], unit: "mg/L", refLow: null, refHigh: 3.0, relatesTo: "systemic inflammation" },
  { name: "ESR", aliases: ["esr", "sed rate", "sedimentation rate"], unit: "mm/hr", refLow: null, refHigh: 20, relatesTo: "systemic inflammation" },
  // Hormones
  { name: "Total Testosterone", aliases: ["total testosterone", "testosterone total", "testosterone"], unit: "ng/dL", refLow: 300, refHigh: 1000, relatesTo: "hormonal status, energy, and recovery" },
  { name: "Free Testosterone", aliases: ["free testosterone", "testosterone free"], unit: "pg/mL", refLow: 9, refHigh: 26, relatesTo: "bioavailable hormonal status" },
  { name: "SHBG", aliases: ["shbg", "sex hormone binding globulin"], unit: "nmol/L", refLow: 16, refHigh: 55, relatesTo: "hormone transport" },
  { name: "Estradiol", aliases: ["estradiol", "e2"], unit: "pg/mL", refLow: 10, refHigh: 40, relatesTo: "hormonal balance" },
  { name: "DHEA-S", aliases: ["dhea-s", "dhea sulfate", "dheas"], unit: "ug/dL", refLow: 100, refHigh: 500, relatesTo: "adrenal hormone production" },
  { name: "Cortisol", aliases: ["cortisol", "am cortisol"], unit: "ug/dL", refLow: 6, refHigh: 23, relatesTo: "stress-hormone regulation" },
];

/** Case-insensitive alias lookup. */
export function findBiomarker(name: string): BiomarkerDef | undefined {
  const q = name.trim().toLowerCase();
  return BIOMARKER_DICTIONARY.find((d) => d.name.toLowerCase() === q || d.aliases.includes(q));
}
