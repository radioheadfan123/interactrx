// Adult maximum daily dose sanity checks, keyed by lowercase ingredient.
// These are typical adult maximums for common indications, meant for a
// "does this number look wrong" gut check, not dosing guidance. Renal/hepatic
// adjustments and indication-specific dosing are called out in caveats.

const MAX_DAILY = {
  acetaminophen: { max: 4000, unit: "mg", caveat: "3,000 mg/day is the safer ceiling for regular use, and lower with liver disease or regular alcohol use. Watch for hidden acetaminophen in combo cold/pain products." },
  ibuprofen: { max: 3200, unit: "mg", caveat: "OTC self-care ceiling is 1,200 mg/day; 3,200 is the prescription maximum. Lowest effective dose, shortest duration." },
  naproxen: { max: 1500, unit: "mg", caveat: "OTC ceiling is 660 mg/day (naproxen sodium)." },
  metformin: { max: 2550, unit: "mg", caveat: "Often capped at 2,000 mg for extended-release. Reduced or avoided with significant kidney impairment." },
  lisinopril: { max: 80, unit: "mg", caveat: "Most patients are maintained at 10-40 mg." },
  atorvastatin: { max: 80, unit: "mg", caveat: "80 mg is the max; muscle symptoms are more common at higher doses." },
  simvastatin: { max: 40, unit: "mg", caveat: "The 80 mg dose is restricted to patients already tolerating it long-term due to muscle toxicity risk." },
  levothyroxine: { max: 300, unit: "mcg", caveat: "Typical full replacement is roughly 1.6 mcg/kg/day; most adults land between 75-150 mcg. Doses above 200 mcg deserve a second look." },
  sertraline: { max: 200, unit: "mg" },
  fluoxetine: { max: 80, unit: "mg" },
  escitalopram: { max: 20, unit: "mg", caveat: "10 mg is the ceiling for older adults due to QT effects." },
  citalopram: { max: 40, unit: "mg", caveat: "20 mg max in older adults or with CYP2C19 inhibitors (QT risk)." },
  tramadol: { max: 400, unit: "mg", caveat: "300 mg/day for extended-release; lower in older adults and kidney disease." },
  gabapentin: { max: 3600, unit: "mg", caveat: "Requires renal dose adjustment; commonly overdosed in kidney impairment." },
  amlodipine: { max: 10, unit: "mg" },
  metoprolol: { max: 400, unit: "mg", caveat: "Succinate (ER) typically maxes at 200 mg/day for heart failure." },
  omeprazole: { max: 40, unit: "mg", caveat: "OTC self-treatment is 20 mg for 14 days; longer courses should be prescriber-directed." },
  prednisone: { max: 80, unit: "mg", caveat: "Highly indication-dependent; short bursts can exceed this. The bigger flag is long courses without a taper plan." },
  warfarin: { max: 15, unit: "mg", caveat: "Dose is driven entirely by INR, not a fixed max; a stable patient's dose can range 1-15+ mg. Any dose change without an INR plan is the real red flag." },
  furosemide: { max: 600, unit: "mg", caveat: "Typical outpatient dosing is 20-80 mg/day; high doses are specialist territory." },
  alprazolam: { max: 4, unit: "mg", caveat: "Panic disorder dosing can run higher under close supervision, but above 4 mg/day warrants scrutiny." },
  zolpidem: { max: 10, unit: "mg", caveat: "5 mg is the recommended starting and often max dose for women and older adults." },
  hydrocodone: { max: 60, unit: "mg", caveat: "No true ceiling in opioid-tolerant patients, but 60+ mg/day of hydrocodone (90 MME) crosses the CDC high-risk threshold." },
  oxycodone: { max: 60, unit: "mg", caveat: "60 mg oxycodone ≈ 90 MME, the CDC threshold where overdose risk climbs steeply and naloxone co-prescribing is recommended." },
  amoxicillin: { max: 3000, unit: "mg", caveat: "Some indications (like H. pylori) use up to 3 g/day legitimately." },
  ciprofloxacin: { max: 1500, unit: "mg", caveat: "Renal adjustment needed." },
  duloxetine: { max: 120, unit: "mg", caveat: "Benefit above 60 mg is limited for most indications." },
  bupropion: { max: 450, unit: "mg", caveat: "Seizure risk rises with dose; never exceed 450 mg/day, and single doses of the IR form shouldn't exceed 150 mg." },
  lithium: { max: 1800, unit: "mg", caveat: "Dose is level-driven (0.6-1.2 mEq/L); the number matters less than the blood level and hydration status." },
  digoxin: { max: 0.25, unit: "mg", caveat: "0.125 mg/day is typical for older adults; kidney function drives dosing." },
  hydrochlorothiazide: { max: 50, unit: "mg", caveat: "Little added BP benefit above 25 mg, mostly more side effects." },
  losartan: { max: 100, unit: "mg" },
  pantoprazole: { max: 80, unit: "mg" },
  montelukast: { max: 10, unit: "mg" },
  cetirizine: { max: 10, unit: "mg" },
  diphenhydramine: { max: 300, unit: "mg", caveat: "50 mg per dose max; regular use in older adults is discouraged entirely (falls, confusion, anticholinergic load)." },
  meloxicam: { max: 15, unit: "mg" },
  prednisolone: { max: 80, unit: "mg", caveat: "Indication-dependent." },
  clonazepam: { max: 4, unit: "mg", caveat: "Seizure indications can run to 20 mg under specialist care; for anxiety, above 4 mg warrants scrutiny." },
  trazodone: { max: 400, unit: "mg", caveat: "Sleep dosing is typically 25-100 mg; depression dosing runs higher." },
};

function checkDose(ingredient, dailyMg) {
  const entry = MAX_DAILY[ingredient.toLowerCase()];
  if (!entry) return { known: false };
  const ratio = dailyMg / entry.max;
  let verdict, message;
  if (ratio >= 1.5) {
    verdict = "high";
    message = `That's well above the typical adult maximum of ${entry.max} ${entry.unit}/day. Worth double-checking the prescription or the math before taking it.`;
  } else if (ratio > 1.0) {
    verdict = "above-max";
    message = `That exceeds the typical adult maximum of ${entry.max} ${entry.unit}/day. Some indications legitimately go higher, but confirm it's intentional.`;
  } else if (ratio >= 0.8) {
    verdict = "near-max";
    message = `That's at or near the typical adult maximum of ${entry.max} ${entry.unit}/day. Fine if deliberate, but there's no headroom.`;
  } else {
    verdict = "ok";
    message = `Within the typical adult range (max ${entry.max} ${entry.unit}/day).`;
  }
  return { known: true, verdict, message, max: entry.max, unit: entry.unit, caveat: entry.caveat || null };
}

module.exports = { checkDose, MAX_DAILY };
