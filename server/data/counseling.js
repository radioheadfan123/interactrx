// DEA schedules and pharmacy counseling flags, keyed by lowercase ingredient name.
// Reflects real pharmacy workflow: schedule badges, REMS, narrow therapeutic index,
// administration counseling points a pharmacist would verify at the counter.

const CONTROLLED = {
  // Schedule II
  oxycodone: 2, hydrocodone: 2, morphine: 2, fentanyl: 2, hydromorphone: 2,
  methadone: 2, tapentadol: 2, amphetamine: 2, dextroamphetamine: 2,
  methylphenidate: 2, lisdexamfetamine: 2, codeine: 2, meperidine: 2,
  // Schedule III
  buprenorphine: 3, ketamine: 3, testosterone: 3,
  // Schedule IV
  alprazolam: 4, lorazepam: 4, diazepam: 4, clonazepam: 4, temazepam: 4,
  midazolam: 4, zolpidem: 4, eszopiclone: 4, zaleplon: 4, tramadol: 4,
  carisoprodol: 4, phentermine: 4,
  // Schedule V
  pregabalin: 5, "diphenoxylate": 5,
};

const SCHEDULE_NOTES = {
  2: "Schedule II: highest-control prescription category. No refills allowed; a new prescription is required each fill. Many states limit day supply for acute use. Secure storage away from others is important, and unused doses should go to a takeback program.",
  3: "Schedule III: refills limited to 5 within 6 months of the prescription date. Store securely.",
  4: "Schedule IV: refills limited to 5 within 6 months. Dependence can develop with long-term use; don't stop abruptly without prescriber guidance.",
  5: "Schedule V: lowest-control scheduled category, but still tracked. Follow directions exactly.",
};

const NTI = new Set(["warfarin", "lithium", "digoxin", "levothyroxine", "phenytoin", "carbamazepine", "theophylline", "tacrolimus", "cyclosporine", "valproic acid", "valproate"]);

const REMS = {
  isotretinoin: "iPLEDGE REMS: monthly pregnancy testing and two forms of contraception required for patients who can become pregnant. Only a 30-day supply can be dispensed at a time.",
  clozapine: "Clozapine REMS: regular absolute neutrophil count (ANC) labs are required before dispensing due to agranulocytosis risk.",
  thalidomide: "REMS program with strict pregnancy prevention requirements.",
  buprenorphine: "When used for opioid use disorder, dispensing follows specific federal requirements; take exactly as directed and never share.",
};

const COUNSELING = {
  warfarin: ["Keep vitamin K intake (leafy greens) consistent rather than avoiding it entirely.", "Regular INR blood checks are essential.", "Report any unusual bleeding, bruising, or black stools."],
  levothyroxine: ["Take on an empty stomach, 30-60 min before breakfast, with water only.", "Separate from calcium, iron, and antacids by 4 hours.", "Stick with the same manufacturer when possible."],
  metformin: ["Take with food to reduce stomach upset.", "Hold around imaging scans that use contrast dye.", "Long-term use can lower B12; periodic checks are reasonable."],
  lithium: ["Stay consistently hydrated; dehydration raises lithium levels.", "Avoid starting NSAIDs without checking first.", "Regular blood level checks are required."],
  digoxin: ["Report nausea, visual halos or yellow-tinted vision, or a very slow pulse.", "Levels and kidney function need periodic checks."],
  amiodarone: ["Regular thyroid, liver, and lung monitoring is standard.", "Use sun protection; photosensitivity is common.", "Interacts with many drugs, including warfarin and digoxin. Any new med should be screened."],
  isotretinoin: ["Take with a fatty meal for absorption.", "Do not donate blood during and 1 month after treatment.", "Avoid vitamin A supplements."],
  alendronate: ["Take first thing in the morning with a full glass of plain water.", "Stay upright and don't eat for at least 30 minutes to protect the esophagus."],
  nitrofurantoin: ["Take with food.", "Urine may turn brown; harmless.", "Not effective if kidney function is significantly reduced."],
  fluoxetine: ["May take 4-6 weeks for full effect.", "Very long half-life matters when switching antidepressants."],
  prednisone: ["Take with food, in the morning.", "Do not stop abruptly after more than ~2 weeks of use; tapering is needed."],
  spironolactone: ["Avoid potassium-based salt substitutes.", "Periodic potassium and kidney labs are standard."],
  ciprofloxacin: ["Separate from dairy, antacids, calcium, iron by 2+ hours.", "Stop and call the prescriber if tendon pain develops.", "Use sun protection."],
  tamsulosin: ["Take 30 minutes after the same meal each day.", "Rise slowly; dizziness on standing is common at first.", "Tell your eye surgeon before cataract surgery (floppy iris syndrome)."],
  clozapine: ["Never skip required blood count labs.", "Significant drowsiness and drooling are common early; report fever or sore throat immediately."],
};

function annotate(ingredients) {
  const flags = { schedule: null, scheduleNote: null, nti: false, rems: null, counseling: [] };
  for (const raw of ingredients) {
    const name = raw.toLowerCase();
    if (CONTROLLED[name] && (!flags.schedule || CONTROLLED[name] < flags.schedule)) {
      flags.schedule = CONTROLLED[name];
      flags.scheduleNote = SCHEDULE_NOTES[CONTROLLED[name]];
    }
    if (NTI.has(name)) flags.nti = true;
    if (REMS[name]) flags.rems = REMS[name];
    if (COUNSELING[name]) flags.counseling.push(...COUNSELING[name]);
  }
  return flags;
}

module.exports = { annotate };
