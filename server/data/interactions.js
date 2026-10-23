// Curated clinically significant interaction pairs.
// RxNav's interaction API was discontinued (Jan 2024), so this serves as the
// primary dataset. Matching is done on normalized ingredient names (lowercase).
// Severity tiers: "contraindicated" | "major" | "moderate"
// Class members are expanded so brand->ingredient normalization via RxNorm hits them.

const CLASSES = {
  nsaid: ["ibuprofen", "naproxen", "diclofenac", "meloxicam", "ketorolac", "indomethacin", "celecoxib", "aspirin"],
  ssri: ["sertraline", "fluoxetine", "paroxetine", "citalopram", "escitalopram", "fluvoxamine"],
  snri: ["venlafaxine", "duloxetine", "desvenlafaxine", "levomilnacipran"],
  maoi: ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline", "rasagiline", "linezolid"],
  statin_cyp3a4: ["simvastatin", "lovastatin", "atorvastatin"],
  strong_3a4_inhibitor: ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "ritonavir", "posaconazole", "voriconazole"],
  opioid: ["oxycodone", "hydrocodone", "morphine", "fentanyl", "tramadol", "codeine", "hydromorphone", "methadone", "buprenorphine", "tapentadol"],
  benzo: ["alprazolam", "lorazepam", "diazepam", "clonazepam", "temazepam", "midazolam"],
  z_drug: ["zolpidem", "eszopiclone", "zaleplon"],
  anticoag: ["warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "enoxaparin", "heparin"],
  antiplatelet: ["clopidogrel", "prasugrel", "ticagrelor", "aspirin"],
  ace_arb: ["lisinopril", "enalapril", "ramipril", "benazepril", "losartan", "valsartan", "olmesartan", "irbesartan", "candesartan"],
  k_sparing: ["spironolactone", "eplerenone", "amiloride", "triamterene"],
  triptan: ["sumatriptan", "rizatriptan", "eletriptan", "zolmitriptan", "naratriptan"],
  qt_drugs: ["amiodarone", "sotalol", "ondansetron", "haloperidol", "ziprasidone", "citalopram", "escitalopram", "azithromycin", "levofloxacin", "moxifloxacin", "methadone", "hydroxyzine"],
  fluoroquinolone: ["ciprofloxacin", "levofloxacin", "moxifloxacin"],
  tetracycline: ["doxycycline", "minocycline", "tetracycline"],
  polyvalent_cation: ["calcium carbonate", "calcium citrate", "magnesium oxide", "magnesium hydroxide", "aluminum hydroxide", "ferrous sulfate", "iron", "sucralfate"],
  pde5: ["sildenafil", "tadalafil", "vardenafil"],
  nitrate: ["nitroglycerin", "isosorbide mononitrate", "isosorbide dinitrate"],
  sulfonylurea: ["glipizide", "glyburide", "glimepiride"],
  strong_inducer: ["carbamazepine", "rifampin", "phenytoin", "phenobarbital", "st. john's wort", "st johns wort", "hypericum perforatum"],
  grapefruit_sensitive: ["simvastatin", "lovastatin", "atorvastatin", "felodipine", "nifedipine", "amiodarone", "buspirone", "tacrolimus", "cyclosporine"],
  doac: ["apixaban", "rivaroxaban", "dabigatran", "edoxaban"],
  serotonergic_all: ["sertraline", "fluoxetine", "paroxetine", "citalopram", "escitalopram", "fluvoxamine", "venlafaxine", "duloxetine", "desvenlafaxine", "trazodone", "tramadol", "buspirone"],
  oral_contraceptive: ["ethinyl estradiol", "norethindrone", "levonorgestrel", "drospirenone", "norgestimate"],
  decongestant: ["pseudoephedrine", "phenylephrine"],
  gabapentinoid: ["gabapentin", "pregabalin"],
  sedating_antihistamine: ["diphenhydramine", "doxylamine", "chlorpheniramine", "promethazine", "hydroxyzine"],
};

// Each rule: a (list or class ref), b, severity, mechanism, plain, advice
const RULES = [
  { a: "anticoag", b: "nsaid", severity: "major",
    mechanism: "Additive bleeding risk; NSAIDs impair platelet function and can cause GI erosion while anticoagulants prevent clotting.",
    plain: "Taking these together significantly raises the risk of serious bleeding, especially in the stomach or intestines.",
    advice: "Avoid the combination when possible. If pain relief is needed, acetaminophen is usually the safer choice. Watch for black stools, unusual bruising, or blood in urine." },
  { a: "anticoag", b: "antiplatelet", severity: "major",
    mechanism: "Combined anticoagulant and antiplatelet effect.",
    plain: "Both medicines make it harder for blood to clot, so bleeding risk is much higher together.",
    advice: "Sometimes this combination is intentional after a stent or heart attack, but it needs to be a deliberate prescriber decision with monitoring." },
  { a: ["warfarin"], b: ["fluconazole", "metronidazole", "trimethoprim", "sulfamethoxazole", "amiodarone"], severity: "major",
    mechanism: "CYP2C9 inhibition raises warfarin levels and INR.",
    plain: "These medicines slow the breakdown of warfarin, which can push blood thinning into dangerous territory.",
    advice: "INR should be checked more often and the warfarin dose may need a temporary reduction." },
  { a: "maoi", b: "ssri", severity: "contraindicated",
    mechanism: "Excess serotonin accumulation.",
    plain: "This combination can trigger serotonin syndrome, a potentially life-threatening reaction with fever, agitation, rapid heart rate, and muscle rigidity.",
    advice: "Do not combine. A washout period (usually 14 days, 5 weeks after fluoxetine) is required when switching between these drug types." },
  { a: "maoi", b: "snri", severity: "contraindicated",
    mechanism: "Excess serotonin accumulation.",
    plain: "Same serotonin syndrome risk as with SSRIs. This pairing should not happen.",
    advice: "Do not combine. Contact the prescriber immediately if both are on the med list." },
  { a: "maoi", b: ["tramadol", "meperidine", "dextromethorphan"], severity: "contraindicated",
    mechanism: "Serotonergic opioid/antitussive plus MAOI.",
    plain: "Risk of severe serotonin syndrome and dangerous blood pressure changes.",
    advice: "Do not combine." },
  { a: "ssri", b: "triptan", severity: "moderate",
    mechanism: "Additive serotonergic activity.",
    plain: "Small but real chance of serotonin syndrome when a migraine medicine is added to an antidepressant.",
    advice: "Usually manageable. Know the warning signs: agitation, sweating, tremor, fast heartbeat. Seek care if they appear after a triptan dose." },
  { a: "ssri", b: ["tramadol"], severity: "major",
    mechanism: "Serotonergic additivity plus seizure threshold lowering.",
    plain: "Raises the risk of both serotonin syndrome and seizures.",
    advice: "Prefer a non-serotonergic pain option; if combined, use the lowest tramadol dose and watch closely." },
  { a: "ssri", b: "nsaid", severity: "moderate",
    mechanism: "SSRIs impair platelet serotonin uptake; additive GI bleed risk with NSAIDs.",
    plain: "Together these roughly triple the chance of stomach bleeding compared with an NSAID alone.",
    advice: "Occasional use is usually fine. For regular use, ask about adding a stomach protectant or switching pain relievers." },
  { a: "statin_cyp3a4", b: "strong_3a4_inhibitor", severity: "major",
    mechanism: "CYP3A4 inhibition raises statin exposure.",
    plain: "The antibiotic or antifungal blocks the statin's breakdown, which can lead to severe muscle damage (rhabdomyolysis).",
    advice: "For a short antibiotic course, the statin is often paused. Report unexplained muscle pain, weakness, or dark urine right away." },
  { a: ["simvastatin", "lovastatin", "atorvastatin"], b: ["gemfibrozil"], severity: "major",
    mechanism: "Gemfibrozil inhibits statin glucuronidation and OATP1B1 uptake.",
    plain: "High risk of muscle breakdown when these cholesterol medicines are combined.",
    advice: "Fenofibrate is the preferred fibrate with statins. Flag for prescriber review." },
  { a: "opioid", b: "benzo", severity: "major",
    mechanism: "Additive CNS and respiratory depression. FDA boxed warning.",
    plain: "Both slow breathing. Together they can cause profound sedation, overdose, and death. This combination carries an FDA boxed warning.",
    advice: "Avoid when possible. If both are truly needed, use lowest doses, and naloxone should be on hand at home." },
  { a: "opioid", b: "z_drug", severity: "major",
    mechanism: "Additive CNS depression.",
    plain: "Sleep medicines plus opioids increase the chance of dangerously slowed breathing overnight.",
    advice: "Discuss alternatives for sleep. Never take extra doses of either." },
  { a: "ace_arb", b: "k_sparing", severity: "moderate",
    mechanism: "Both raise potassium.",
    plain: "Both medicines raise potassium levels, which can affect heart rhythm if it climbs too high.",
    advice: "Common intentional combo in heart failure, but it requires periodic potassium and kidney lab checks. Avoid salt substitutes (they're potassium)." },
  { a: "ace_arb", b: "nsaid", severity: "moderate",
    mechanism: "NSAIDs blunt renal prostaglandins; reduced kidney perfusion and BP control.",
    plain: "Regular NSAID use can weaken the blood pressure medicine and stress the kidneys, especially when dehydrated.",
    advice: "Occasional doses are usually fine. Avoid daily NSAID use without prescriber input; stay hydrated." },
  { a: ["lisinopril", "enalapril", "ramipril", "benazepril"], b: ["potassium chloride"], severity: "moderate",
    mechanism: "Additive hyperkalemia risk.",
    plain: "Potassium supplements plus an ACE inhibitor can push potassium too high.",
    advice: "Only combine under prescriber direction with lab monitoring." },
  { a: "pde5", b: "nitrate", severity: "contraindicated",
    mechanism: "Profound additive vasodilation.",
    plain: "Combining these can drop blood pressure to life-threatening levels.",
    advice: "Never combine. ED medicines must be separated from nitrates by at least 24 hours (48 for tadalafil). ER staff must know if both were taken." },
  { a: "fluoroquinolone", b: "polyvalent_cation", severity: "moderate",
    mechanism: "Chelation in the gut prevents antibiotic absorption.",
    plain: "Calcium, magnesium, iron, or antacids can bind this antibiotic in the stomach so little of it gets absorbed.",
    advice: "Timing fixes this: take the antibiotic 2 hours before or 6 hours after the mineral/antacid." },
  { a: "tetracycline", b: "polyvalent_cation", severity: "moderate",
    mechanism: "Chelation reduces absorption.",
    plain: "Minerals and antacids can block absorption of this antibiotic.",
    advice: "Separate doses by at least 2 hours before or 4 hours after." },
  { a: ["levothyroxine"], b: ["calcium carbonate", "calcium citrate", "ferrous sulfate", "iron", "omeprazole", "pantoprazole", "sucralfate"], severity: "moderate",
    mechanism: "Reduced levothyroxine absorption.",
    plain: "These can keep thyroid medicine from absorbing properly, leading to low thyroid levels over time.",
    advice: "Take levothyroxine alone on an empty stomach and separate from calcium or iron by at least 4 hours." },
  { a: ["methotrexate"], b: "nsaid", severity: "major",
    mechanism: "NSAIDs reduce renal clearance of methotrexate.",
    plain: "Pain relievers can cause methotrexate to build up to toxic levels.",
    advice: "Risk is highest with high-dose methotrexate. Even with weekly low doses, check with the prescriber before regular NSAID use." },
  { a: ["lithium"], b: "nsaid", severity: "major",
    mechanism: "Reduced renal lithium clearance.",
    plain: "NSAIDs can raise lithium levels enough to cause toxicity: tremor, confusion, nausea.",
    advice: "Avoid regular NSAID use; acetaminophen is safer. Lithium levels should be checked if an NSAID is started." },
  { a: ["lithium"], b: "ace_arb", severity: "major",
    mechanism: "Reduced lithium clearance.",
    plain: "Blood pressure medicines in this class can push lithium into the toxic range.",
    advice: "Combination needs close lithium level monitoring; report tremor or confusion." },
  { a: ["digoxin"], b: ["amiodarone", "verapamil", "clarithromycin", "spironolactone"], severity: "major",
    mechanism: "P-gp inhibition or reduced clearance raises digoxin levels.",
    plain: "These medicines raise digoxin levels, and digoxin has a very narrow safety margin.",
    advice: "Digoxin dose often needs cutting when these are added. Watch for nausea, visual changes, or slow pulse." },
  { a: "qt_drugs", b: "qt_drugs", severity: "major",
    mechanism: "Additive QT prolongation.",
    plain: "Both medicines can affect the heart's electrical rhythm; together the risk of a dangerous arrhythmia goes up.",
    advice: "Prescriber may want a baseline EKG or an alternative. Report fainting or palpitations immediately." },
  { a: ["metformin"], b: ["iodinated contrast"], severity: "major",
    mechanism: "Contrast-induced kidney injury can cause metformin accumulation and lactic acidosis.",
    plain: "Around imaging scans with contrast dye, metformin may need to be held to protect the kidneys.",
    advice: "Tell imaging staff about metformin; it is typically held at the time of contrast and restarted 48 hours later once kidney function is confirmed." },
  { a: "sulfonylurea", b: ["fluconazole", "trimethoprim", "sulfamethoxazole"], severity: "moderate",
    mechanism: "CYP2C9 inhibition raises sulfonylurea levels.",
    plain: "These can intensify the diabetes medicine and cause low blood sugar.",
    advice: "Check blood sugar more often during the antibiotic/antifungal course; keep fast-acting sugar handy." },
  { a: ["clopidogrel"], b: ["omeprazole", "esomeprazole"], severity: "moderate",
    mechanism: "CYP2C19 inhibition reduces clopidogrel activation.",
    plain: "These heartburn medicines can make clopidogrel less effective at preventing clots.",
    advice: "Pantoprazole or famotidine are alternatives that don't interfere. Worth a prescriber conversation, not an emergency." },
  { a: ["theophylline"], b: ["ciprofloxacin", "fluvoxamine"], severity: "major",
    mechanism: "CYP1A2 inhibition raises theophylline levels.",
    plain: "Theophylline can climb to toxic levels, causing nausea, rapid heartbeat, or seizures.",
    advice: "Levels should be monitored and the dose adjusted; report jitteriness or racing heart." },
  { a: ["allopurinol"], b: ["azathioprine", "mercaptopurine"], severity: "contraindicated",
    mechanism: "Xanthine oxidase inhibition blocks thiopurine metabolism.",
    plain: "Allopurinol blocks the breakdown of these immune medicines, which can cause severe bone marrow suppression.",
    advice: "If combined at all, the thiopurine dose must be cut to roughly a quarter with close blood count monitoring. Flag for immediate prescriber review." },
  { a: ["colchicine"], b: "strong_3a4_inhibitor", severity: "major",
    mechanism: "CYP3A4/P-gp inhibition; colchicine toxicity can be fatal.",
    plain: "Colchicine can accumulate to dangerous levels, and colchicine overdose has no antidote.",
    advice: "Dose must be reduced or the combination avoided, especially with kidney or liver problems." },
  { a: "benzo", b: ["alcohol"], severity: "major",
    mechanism: "Additive CNS depression.",
    plain: "Alcohol plus these medicines heavily amplifies sedation and breathing suppression.",
    advice: "Avoid alcohol while taking this medicine." },
  { a: ["warfarin"], b: ["levothyroxine"], severity: "moderate",
    mechanism: "Thyroid hormone increases clotting factor catabolism, potentiating warfarin.",
    plain: "Starting or changing thyroid medicine can strengthen warfarin's effect.",
    advice: "INR should be rechecked after any thyroid dose change." },
  { a: "strong_inducer", b: "oral_contraceptive", severity: "major",
    mechanism: "CYP3A4 induction accelerates hormone metabolism.",
    plain: "These medicines speed up the breakdown of birth control hormones, which can cause contraceptive failure.",
    advice: "A backup or non-hormonal method is recommended while taking the inducer and for about a month after stopping." },
  { a: "strong_inducer", b: "doac", severity: "major",
    mechanism: "P-gp/CYP3A4 induction lowers anticoagulant levels.",
    plain: "The blood thinner can be cleared so fast it stops protecting against clots, without any warning symptoms.",
    advice: "This combination is generally avoided. Flag for prescriber review; warfarin with INR monitoring may be the safer route." },
  { a: "strong_inducer", b: ["apixaban", "rivaroxaban", "tacrolimus", "cyclosporine", "voriconazole"], severity: "major",
    mechanism: "Induction reduces exposure of narrow-margin drugs.",
    plain: "Levels of the second medicine can drop enough to cause treatment failure.",
    advice: "Needs prescriber review and possibly drug level monitoring or an alternative." },
  { a: ["st. john's wort", "st johns wort", "hypericum perforatum"], b: "serotonergic_all", severity: "major",
    mechanism: "Additive serotonergic activity from hypericum.",
    plain: "St. John's Wort acts like an antidepressant itself; combining it with one raises serotonin syndrome risk.",
    advice: "Avoid the combination. Tell every prescriber about herbal supplements; this one interacts with more drugs than almost any other supplement." },
  { a: ["grapefruit", "grapefruit juice"], b: "grapefruit_sensitive", severity: "moderate",
    mechanism: "Furanocoumarins in grapefruit inhibit intestinal CYP3A4.",
    plain: "Grapefruit blocks the gut enzyme that limits how much of this medicine gets absorbed, so blood levels can climb well above intended.",
    advice: "The effect lasts up to 3 days per glass, so separating doses doesn't help. Best to avoid grapefruit entirely with this medicine; other citrus is fine." },
  { a: ["carbamazepine"], b: ["clarithromycin", "erythromycin", "fluconazole", "verapamil", "diltiazem"], severity: "major",
    mechanism: "CYP3A4 inhibition raises carbamazepine to toxic levels.",
    plain: "Carbamazepine can build up and cause dizziness, double vision, unsteadiness, and confusion.",
    advice: "Levels should be checked and the dose may need a temporary cut; report coordination or vision changes." },
  { a: ["phenytoin"], b: ["fluconazole", "trimethoprim", "sulfamethoxazole", "amiodarone", "fluoxetine"], severity: "major",
    mechanism: "CYP2C9/2C19 inhibition raises phenytoin levels.",
    plain: "Phenytoin has a narrow safety margin; these medicines can push it into toxicity.",
    advice: "Watch for unsteady walking, slurred speech, or nystagmus; levels should be monitored." },
  { a: ["potassium chloride"], b: "k_sparing", severity: "major",
    mechanism: "Additive hyperkalemia.",
    plain: "Potassium supplements plus a potassium-keeping diuretic can raise potassium to heart-rhythm-threatening levels.",
    advice: "Only combine with deliberate prescriber direction and lab monitoring." },
  { a: ["trimethoprim", "sulfamethoxazole"], b: "ace_arb", severity: "moderate",
    mechanism: "Trimethoprim acts like a potassium-sparing diuretic.",
    plain: "This common antibiotic quietly raises potassium, and stacking it on blood pressure medicines that do the same has caused hospitalizations, mostly in older adults.",
    advice: "Short courses are usually fine in healthy kidneys; for older patients or kidney disease, a potassium check or a different antibiotic is reasonable." },
  { a: ["metronidazole", "tinidazole"], b: ["alcohol"], severity: "major",
    mechanism: "Disulfiram-like reaction.",
    plain: "Alcohol during and shortly after this antibiotic can cause intense flushing, vomiting, and pounding heartbeat.",
    advice: "Avoid alcohol during treatment and for 3 days after the last dose." },
  { a: "opioid", b: ["alcohol"], severity: "major",
    mechanism: "Additive CNS and respiratory depression.",
    plain: "Alcohol stacks on top of an opioid's effect on breathing. This combination shows up in a lot of accidental overdose deaths.",
    advice: "Avoid alcohol completely while taking this medicine. If both happen anyway, no driving, and someone should know to call 911 for slow or shallow breathing." },
  { a: "z_drug", b: ["alcohol"], severity: "major",
    mechanism: "Additive CNS depression; raises risk of complex sleep behaviors.",
    plain: "Alcohol makes these sleep medicines much stronger and raises the chance of sleepwalking, sleep-driving, and next-morning impairment.",
    advice: "Don't take the sleep medicine on a night you've been drinking." },
  { a: ["acetaminophen"], b: ["alcohol"], severity: "moderate",
    mechanism: "Chronic alcohol use induces CYP2E1 and depletes glutathione, increasing the toxic acetaminophen metabolite (NAPQI).",
    plain: "Regular drinking makes the liver more vulnerable to acetaminophen damage. The OTC label warns about this at 3 or more drinks a day.",
    advice: "An occasional drink with a normal dose is generally fine. For daily drinkers, keep total acetaminophen under 2,000 mg a day and check with a pharmacist." },
  { a: "nsaid", b: ["alcohol"], severity: "moderate",
    mechanism: "Both irritate the gastric mucosa; additive GI bleed risk.",
    plain: "Alcohol and NSAID pain relievers each irritate the stomach lining, so together they raise the chance of stomach bleeding.",
    advice: "The OTC label warning kicks in at 3 or more drinks a day. Take the NSAID with food and watch for black or tarry stools." },
  { a: ["ginkgo", "ginkgo biloba"], b: ["warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "clopidogrel", "prasugrel", "ticagrelor", "aspirin"], severity: "moderate",
    mechanism: "Ginkgolide B inhibits platelet-activating factor; case reports of bleeding with anticoagulants and antiplatelets.",
    plain: "Ginkgo may thin the blood a little on its own. There are case reports of serious bleeding when it's combined with a blood thinner, although the trial data is mixed.",
    advice: "Safest to skip ginkgo on a blood thinner. Always stop it before surgery and tell every prescriber you take it." },
  { a: ["nitrofurantoin", "metformin", "gabapentin"], b: ["magnesium hydroxide", "aluminum hydroxide"], severity: "moderate",
    mechanism: "Antacid reduces absorption.",
    plain: "Antacids can meaningfully cut how much of this medicine absorbs.",
    advice: "Separate by 2 hours." },
  // Counter catches: OTC cough/cold/sleep products people don't think of as "real" meds.
  { a: "maoi", b: "decongestant", severity: "contraindicated",
    mechanism: "MAOIs block breakdown of the norepinephrine that sympathomimetic decongestants release.",
    plain: "A regular cold medicine like Sudafed or DayQuil can spike blood pressure dangerously on an MAOI.",
    advice: "Do not combine. For congestion, saline spray or a plain antihistamine is safer; check with the pharmacist before any cold product." },
  { a: [...CLASSES.ssri, ...CLASSES.snri], b: ["dextromethorphan"], severity: "moderate",
    mechanism: "Dextromethorphan has serotonergic activity; fluoxetine and paroxetine also block its CYP2D6 metabolism.",
    plain: "The cough suppressant in Delsym, NyQuil and Robitussin DM adds serotonin on top of an antidepressant. Normal doses are usually okay, but it adds up.",
    advice: "Stick to the labeled dose and don't stack multiple DM products. Stop and get help for agitation, sweating, tremor or a racing heart." },
  { a: "gabapentinoid", b: "opioid", severity: "major",
    mechanism: "Additive CNS and respiratory depression (FDA warning, 2019).",
    plain: "Gabapentin or pregabalin with an opioid can slow breathing more than either alone, especially in older adults or people with lung problems.",
    advice: "Use the lowest effective doses and avoid alcohol. Family should know the signs of oversedation: very sleepy, hard to wake, slow or shallow breathing." },
  { a: ["bupropion"], b: ["tramadol"], severity: "major",
    mechanism: "Both lower the seizure threshold; bupropion also inhibits CYP2D6 and changes tramadol's activation.",
    plain: "Together these raise the risk of a seizure, and the pain relief from tramadol can be less predictable.",
    advice: "Prefer a different pain option. If combined, keep tramadol at the lowest dose and avoid it entirely with any seizure history." },
  { a: "sedating_antihistamine", b: [...CLASSES.opioid, ...CLASSES.benzo, ...CLASSES.z_drug, "alcohol"], severity: "moderate",
    mechanism: "Additive CNS depression and anticholinergic effects.",
    plain: "Benadryl, ZzzQuil, Unisom and similar sleep or allergy products stack drowsiness on top of pain or sleep medicines and alcohol.",
    advice: "Avoid doubling up on sleep aids. Older adults especially should skip diphenhydramine (fall and confusion risk). Don't drive until you know how it hits you." },
  { a: ["methotrexate"], b: ["trimethoprim", "sulfamethoxazole"], severity: "major",
    mechanism: "Both are antifolates; trimethoprim also reduces methotrexate renal clearance.",
    plain: "Bactrim on top of methotrexate can crash blood counts, even at the low weekly methotrexate doses used for arthritis.",
    advice: "Usually avoided. If an antibiotic is needed, ask the prescriber for a different one and mention the methotrexate." },
];

function expand(x) {
  if (Array.isArray(x)) return x;
  return CLASSES[x] || [x];
}

// Given two normalized ingredient name arrays (one per drug), find matching rules.
function checkPair(ingredientsA, ingredientsB) {
  const found = [];
  const la = ingredientsA.map((s) => s.toLowerCase());
  const lb = ingredientsB.map((s) => s.toLowerCase());
  for (const rule of RULES) {
    const setA = expand(rule.a);
    const setB = expand(rule.b);
    const hitAB = la.some((i) => setA.includes(i)) && lb.some((i) => setB.includes(i));
    const hitBA = lb.some((i) => setA.includes(i)) && la.some((i) => setB.includes(i));
    // For self-referential class rules (QT + QT), require the two drugs be different ingredients
    if (rule.a === rule.b) {
      const aHits = la.filter((i) => setA.includes(i));
      const bHits = lb.filter((i) => setA.includes(i));
      if (aHits.length && bHits.length && !(aHits.length === 1 && bHits.length === 1 && aHits[0] === bHits[0])) {
        found.push(rule);
      }
      continue;
    }
    if (hitAB || hitBA) found.push(rule);
  }
  // Dedupe by severity+plain
  const seen = new Set();
  return found.filter((r) => {
    const k = r.severity + r.plain;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Therapeutic duplication: the same ingredient in two products (Tylenol + Norco),
// or two different drugs from a class where doubling up is rarely intended.
// Aspirin is left out of the NSAID duplicate check since low-dose aspirin next to
// another NSAID is common and has its own nuance.
const DUP_CLASSES = [
  { cls: "nsaid", exclude: ["aspirin"], severity: "moderate", label: "two NSAID pain relievers",
    advice: "Pick one NSAID unless a prescriber told you to take both. Stacking them raises stomach bleeding and kidney risk without much extra pain relief." },
  { cls: "ssri", severity: "major", label: "two SSRI antidepressants",
    advice: "Ask the prescriber if one is meant to replace the other. Two SSRIs together raise the risk of serotonin syndrome." },
  { cls: "snri", severity: "major", label: "two SNRI antidepressants",
    advice: "Ask the prescriber if one is meant to replace the other. Two SNRIs together raise the risk of serotonin syndrome." },
  { cls: "benzo", severity: "moderate", label: "two benzodiazepines",
    advice: "Check that both are intended. Two benzos add up to more sedation and more fall risk." },
  { cls: "z_drug", severity: "moderate", label: "two sleep medicines",
    advice: "Take only one sleep medicine a night unless a prescriber says otherwise." },
  { cls: "anticoag", severity: "major", label: "two blood thinners",
    advice: "This is sometimes intentional for a few days while switching (bridging), but confirm it with the prescriber. Two anticoagulants long term is a serious bleeding risk." },
  { cls: "ace_arb", severity: "major", label: "an ACE inhibitor and/or ARB twice",
    advice: "Doubling up on these (called dual RAAS blockade) is generally avoided because it raises potassium and strains the kidneys. Ask the prescriber if both are meant." },
];

const DUP_INGREDIENT_ADVICE = {
  acetaminophen: "Keep total acetaminophen from all products under 3,000 to 4,000 mg a day (less if you drink or have liver problems). Count cold and flu products and combo painkillers like Norco too.",
};

function checkDuplication(ingredientsA, ingredientsB) {
  const la = ingredientsA.map((s) => s.toLowerCase());
  const lb = ingredientsB.map((s) => s.toLowerCase());
  const found = [];
  const shared = la.filter((i) => lb.includes(i));
  for (const ing of shared) {
    found.push({
      type: "duplication",
      severity: ing === "acetaminophen" ? "major" : "moderate",
      mechanism: `Both products contain ${ing}, so doses add together.`,
      plain: `Both of these contain ${ing}. Taking them together doubles up on the same medicine.`,
      advice: DUP_INGREDIENT_ADVICE[ing] || "Make sure doubling up is intended, and count the total daily dose from both products.",
    });
  }
  for (const d of DUP_CLASSES) {
    const members = CLASSES[d.cls].filter((m) => !(d.exclude || []).includes(m));
    const inA = la.filter((i) => members.includes(i) && !shared.includes(i));
    const inB = lb.filter((i) => members.includes(i) && !shared.includes(i));
    if (inA.length && inB.length) {
      found.push({
        type: "duplication",
        severity: d.severity,
        mechanism: `Therapeutic duplication: ${inA[0]} and ${inB[0]} are in the same drug class.`,
        plain: `This looks like ${d.label}: ${inA[0]} and ${inB[0]} do the same job.`,
        advice: d.advice,
      });
    }
  }
  return found;
}

module.exports = { checkPair, checkDuplication };
