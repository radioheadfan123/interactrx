const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { checkPair } = require("./data/interactions");
const { annotate } = require("./data/counseling");
const { checkDose } = require("./data/dosage");

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "10kb" }));
app.set("trust proxy", 1);
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

const RXNORM = "https://rxnav.nlm.nih.gov/REST";
const OPENFDA = "https://api.fda.gov/drug/label.json";

const cache = new Map();
async function cachedFetch(url, ttlMs = 1000 * 60 * 60) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const v = await res.json();
  if (cache.size > 2000) cache.clear();
  cache.set(url, { v, t: Date.now() });
  return v;
}

// Non-drug interactors people should be able to add. Matched on the query text.
const PSEUDO = [
  { match: /grapefruit/i, rxcui: "custom:grapefruit", name: "Grapefruit / grapefruit juice", ingredients: ["grapefruit"] },
  { match: /alcohol|ethanol|beer|wine|liquor/i, rxcui: "custom:alcohol", name: "Alcohol", ingredients: ["alcohol"] },
  { match: /john'?s?\s*wort|hypericum/i, rxcui: "custom:sjw", name: "St. John's Wort", ingredients: ["st. john's wort"] },
];
const PSEUDO_BY_ID = Object.fromEntries(PSEUDO.map((p) => [p.rxcui, p]));

const TERM_OK = new Set(["IN", "PIN", "MIN", "BN"]); // ingredient, precise ingredient, multi-ingredient, brand

// GET /api/search?q=lipitor
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 80);
  if (q.length < 2) return res.json({ results: [] });
  const pseudo = PSEUDO.filter((p) => p.match.test(q)).map((p) => ({ rxcui: p.rxcui, name: p.name }));
  try {
    const data = await cachedFetch(`${RXNORM}/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=15`);
    const candidates = data?.approximateGroup?.candidate || [];
    const seen = new Set();
    const results = [...pseudo];
    for (const c of candidates) {
      if (seen.has(c.rxcui) || results.length >= 7) continue;
      seen.add(c.rxcui);
      // filter to clean term types so dose-form entries don't clutter the dropdown
      try {
        const props = await cachedFetch(`${RXNORM}/rxcui/${c.rxcui}/properties.json`);
        const p = props?.properties;
        if (p && TERM_OK.has(p.tty)) results.push({ rxcui: c.rxcui, name: p.name });
      } catch { /* skip candidate on lookup failure */ }
    }
    // fallback: if the tty filter ate everything, return raw top candidates
    if (results.length === pseudo.length && candidates.length) {
      for (const c of candidates.slice(0, 5)) {
        if (!seen.has(c.rxcui + "raw")) results.push({ rxcui: c.rxcui, name: c.name || q });
        seen.add(c.rxcui + "raw");
      }
    }
    res.json({ results });
  } catch {
    if (pseudo.length) return res.json({ results: pseudo });
    res.status(502).json({ error: "Drug search is unavailable right now. Try again shortly." });
  }
});

async function getIngredients(rxcui) {
  if (PSEUDO_BY_ID[rxcui]) return PSEUDO_BY_ID[rxcui].ingredients;
  const data = await cachedFetch(`${RXNORM}/rxcui/${rxcui}/related.json?tty=IN`);
  const groups = data?.relatedGroup?.conceptGroup || [];
  const ins = groups.flatMap((g) => g.conceptProperties || []).map((p) => p.name);
  if (ins.length) return ins;
  const props = await cachedFetch(`${RXNORM}/rxcui/${rxcui}/properties.json`);
  return props?.properties?.name ? [props.properties.name] : [];
}

function validDrugList(drugs) {
  return (
    Array.isArray(drugs) &&
    drugs.length >= 1 &&
    drugs.length <= 20 &&
    drugs.every(
      (d) =>
        d && typeof d.rxcui === "string" && d.rxcui.length <= 40 &&
        /^(custom:[a-z]+|\d+)$/.test(d.rxcui) &&
        typeof d.name === "string" && d.name.length <= 120
    )
  );
}

// POST /api/interactions
app.post("/api/interactions", async (req, res) => {
  const drugs = req.body?.drugs;
  if (!validDrugList(drugs)) return res.status(400).json({ error: "Invalid drug list." });
  try {
    const enriched = await Promise.all(
      drugs.map(async (d) => ({ ...d, ingredients: await getIngredients(d.rxcui) }))
    );
    const drugFlags = enriched.map((d) => ({
      rxcui: d.rxcui,
      name: d.name,
      ingredients: d.ingredients,
      flags: annotate(d.ingredients),
    }));
    const interactions = [];
    for (let i = 0; i < enriched.length; i++) {
      for (let j = i + 1; j < enriched.length; j++) {
        for (const h of checkPair(enriched[i].ingredients, enriched[j].ingredients)) {
          interactions.push({
            drugA: enriched[i].name, drugB: enriched[j].name,
            severity: h.severity, plain: h.plain, mechanism: h.mechanism, advice: h.advice,
          });
        }
      }
    }
    const order = { contraindicated: 0, major: 1, moderate: 2 };
    interactions.sort((a, b) => order[a.severity] - order[b.severity]);
    res.json({ drugs: drugFlags, interactions, source: "curated" });
  } catch {
    res.status(502).json({ error: "Could not resolve drug ingredients. Try again." });
  }
});

// GET /api/dose?name=ibuprofen&daily=4800
app.get("/api/dose", (req, res) => {
  const name = String(req.query.name || "").trim().slice(0, 80);
  const daily = Number(req.query.daily);
  if (!name || !Number.isFinite(daily) || daily <= 0 || daily > 1_000_000) {
    return res.status(400).json({ error: "Provide name and a positive daily amount." });
  }
  res.json(checkDose(name, daily));
});

// Parse openFDA adverse reactions prose into a short list of common effects
const SIDE_EFFECT_TERMS = [
  "nausea","vomiting","diarrhea","constipation","headache","dizziness","drowsiness","somnolence",
  "insomnia","fatigue","dry mouth","rash","pruritus","itching","abdominal pain","dyspepsia",
  "heartburn","decreased appetite","increased appetite","weight gain","weight loss","tremor",
  "sweating","blurred vision","cough","edema","swelling","muscle pain","myalgia","arthralgia",
  "joint pain","back pain","anxiety","nervousness","palpitations","hypotension","hypertension",
  "flushing","sexual dysfunction","hair loss","bruising","bleeding",
];
app.get("/api/label", async (req, res) => {
  const name = String(req.query.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const url = `${OPENFDA}?search=openfda.generic_name:%22${encodeURIComponent(name)}%22&limit=1`;
    const data = await cachedFetch(url);
    const r = data?.results?.[0];
    if (!r) return res.json({ found: false });
    const arText = (r.adverse_reactions || [""])[0].toLowerCase();
    const common = SIDE_EFFECT_TERMS.filter((t) => arText.includes(t))
      .filter((t, _, arr) => !arr.some((o) => o !== t && o.includes(t) && arText.includes(o))) // drop subsumed terms
      .slice(0, 10);
    const trim = (arr, n) => (arr && arr[0] ? arr[0].slice(0, n) + (arr[0].length > n ? "…" : "") : null);
    res.json({
      found: true,
      boxedWarning: trim(r.boxed_warning, 600),
      commonSideEffects: common,
      adverseExcerpt: common.length ? null : trim(r.adverse_reactions, 700),
      brand: r.openfda?.brand_name?.slice(0, 3) || [],
    });
  } catch {
    res.json({ found: false });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`InteractRx API on :${PORT}`));
}
module.exports = app;
