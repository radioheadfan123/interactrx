import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

const SEV_LABEL = { contraindicated: "Contraindicated", major: "Major", moderate: "Moderate" };
const ROMAN = ["", "I", "II", "III", "IV", "V"];

// One-click demo lists. Same {rxcui, name} entries the search returns, so the server
// resolves brands to ingredients exactly like a hand-built list.
export const EXAMPLES = [
  { label: "Tylenol + Norco", meds: [{ rxcui: "202433", name: "acetaminophen (Tylenol)" }, { rxcui: "218772", name: "acetaminophen / hydrocodone (Norco)" }] },
  { label: "Warfarin + Advil", meds: [{ rxcui: "11289", name: "warfarin (Coumadin, Jantoven)" }, { rxcui: "153010", name: "ibuprofen (Advil)" }] },
  { label: "Nardil + Sudafed", meds: [{ rxcui: "8123", name: "phenelzine (Nardil)" }, { rxcui: "203302", name: "pseudoephedrine (Sudafed)" }] },
  { label: "Zoloft + tramadol", meds: [{ rxcui: "36437", name: "sertraline (Zoloft)" }, { rxcui: "10689", name: "tramadol (ConZip, Ultram)" }] },
];

// Share links carry the list in the URL hash, which browsers never send to a server.
// Same shape rules the API enforces, so a hand-edited link can't smuggle junk in.
export function encodeShare(meds) {
  return "#meds=" + encodeURIComponent(JSON.stringify(meds.map((m) => [m.rxcui, m.name])));
}
export function decodeShare(hash) {
  const m = /^#meds=(.+)$/.exec(hash || "");
  if (!m) return null;
  try {
    const list = JSON.parse(decodeURIComponent(m[1]));
    if (!Array.isArray(list) || !list.length || list.length > 20) return null;
    const meds = list.map(([rxcui, name]) => ({ rxcui, name }));
    const ok = meds.every((d) => typeof d.rxcui === "string" && /^(custom:[a-z]+|\d+)$/.test(d.rxcui) &&
      typeof d.name === "string" && d.name.length > 0 && d.name.length <= 120);
    return ok ? meds : null;
  } catch { return null; }
}

function DoseChecker({ ingredient }) {
  const [daily, setDaily] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    const n = Number(daily);
    if (!n || n <= 0) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dose?name=${encodeURIComponent(ingredient)}&daily=${n}`);
      setRes(await r.json());
    } catch { setRes({ known: false, error: true }); }
    setBusy(false);
  }
  return (
    <div className="dose-check">
      <label>
        Total daily dose (mg{ingredient === "levothyroxine" ? ", enter mcg" : ""}):
        <input
          type="number" min="0" inputMode="decimal" value={daily}
          onChange={(e) => { setDaily(e.target.value); setRes(null); }}
          onKeyDown={(e) => e.key === "Enter" && run()}
          aria-label={`Daily dose of ${ingredient}`}
        />
      </label>
      <button className="label-btn" onClick={run} disabled={busy || !daily}>Sanity check</button>
      {res && !res.known && <div className="note">No reference range on file for {ingredient}.</div>}
      {res?.known && (
        <div className={`dose-verdict ${res.verdict}`}>
          {res.message}
          {res.caveat && <div className="note">{res.caveat}</div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [highlight, setHighlight] = useState(-1);
  const [meds, setMeds] = useState(() => {
    const shared = decodeShare(window.location.hash);
    if (shared) return shared;
    try { return JSON.parse(localStorage.getItem("meds") || "[]"); } catch { return []; }
  });
  const [shareMsg, setShareMsg] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [labels, setLabels] = useState({});
  const debounce = useRef();
  const inputRef = useRef();
  const boxRef = useRef();
  const autoCheck = useRef(false);

  useEffect(() => {
    function onDocDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setSuggestions([]); setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    localStorage.setItem("meds", JSON.stringify(meds));
    setResult(null);
    setShareMsg("");
    if (autoCheck.current) { autoCheck.current = false; check(); }
  }, [meds]);

  function loadExample(list) {
    autoCheck.current = true;
    setMeds(list);
  }

  // Drop the hash once the shared list is loaded, so a reload shows the saved list.
  // Done in an effect, not the state initializer: StrictMode runs initializers twice.
  // hashchange covers a link pasted into a tab that already has the app open.
  useEffect(() => {
    function takeShared() {
      const shared = decodeShare(window.location.hash);
      if (!shared) return;
      setMeds(shared);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    takeShared();
    window.addEventListener("hashchange", takeShared);
    return () => window.removeEventListener("hashchange", takeShared);
  }, []);

  async function share() {
    const url = window.location.origin + window.location.pathname + encodeShare(meds);
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied. Anyone who opens it gets this list.");
    } catch {
      setShareMsg(url); // clipboard blocked: show the link so it can be copied by hand
    }
  }

  useEffect(() => {
    clearTimeout(debounce.current);
    setHighlight(-1);
    if (query.trim().length < 2) { setSuggestions([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setSuggestions(d.results || []);
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [query]);

  function addMed(s) {
    if (!meds.some((m) => m.rxcui === s.rxcui)) setMeds((prev) => [...prev, s]);
    setQuery("");
    setSuggestions([]);
    setHighlight(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); addMed(suggestions[highlight]); }
    else if (e.key === "Escape") { setSuggestions([]); setHighlight(-1); }
  }

  async function check() {
    setLoading(true); setError(""); setResult(null); setLabels({});
    try {
      const r = await fetch(`${API}/api/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drugs: meds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Check failed");
      setResult(d);
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    }
    setLoading(false);
  }

  async function loadLabel(ingredient) {
    if (labels[ingredient]) return;
    setLabels((l) => ({ ...l, [ingredient]: { loading: true } }));
    try {
      const r = await fetch(`${API}/api/label?name=${encodeURIComponent(ingredient)}`);
      setLabels((l) => ({ ...l, [ingredient]: null }));
      const d = await r.json();
      setLabels((l) => ({ ...l, [ingredient]: d }));
    } catch {
      setLabels((l) => ({ ...l, [ingredient]: { found: false } }));
    }
  }

  const flagged = result?.drugs || [];

  return (
    <div className="wrap">
      <header className="rx">
        <div className="brand"><span className="rx-glyph">℞</span> InteractRx</div>
        <div className="tagline">Medication interaction check · RxNorm normalized</div>
      </header>

      <div className="search-box" ref={boxRef}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search a medication (try Lipitor, warfarin, Xanax, grapefruit)"
          aria-label="Search medications"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-activedescendant={highlight >= 0 ? `sug-${highlight}` : undefined}
        />
        {searching && <div className="spin" style={{ marginTop: 6 }}>searching…</div>}
        {suggestions.length > 0 && (
          <div className="suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <button
                key={s.rxcui} id={`sug-${i}`} role="option"
                aria-selected={i === highlight}
                className={i === highlight ? "hl" : ""}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => addMed(s)}
              >
                <span>{s.name}</span>
                <span className="rxcui">{s.rxcui.startsWith("custom") ? "non-drug" : `RXCUI ${s.rxcui}`}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="medlist">
        {meds.length === 0 && (
          <>
            <span className="hint">Add two or more items to run a check. Your list stays on this device.</span>
            <div className="examples">
              <span className="examples-label">Try an example</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.label} className="label-btn" onClick={() => loadExample(ex.meds)}>{ex.label}</button>
              ))}
            </div>
          </>
        )}
        {meds.map((m) => {
          const f = flagged.find((d) => d.rxcui === m.rxcui)?.flags;
          return (
            <span className="chip" key={m.rxcui}>
              {m.name}
              {f?.schedule && <span className="sched-badge">C-{ROMAN[f.schedule]}</span>}
              <button onClick={() => setMeds(meds.filter((x) => x.rxcui !== m.rxcui))} aria-label={`Remove ${m.name}`}>×</button>
            </span>
          );
        })}
      </div>

      <div className="actions">
        <button className="check-btn" disabled={meds.length < 2 || loading} onClick={check}>
          {loading ? "Checking…" : "Check interactions"}
        </button>
        {meds.length === 1 && <span className="hint">Add one more to compare.</span>}
        {meds.length >= 2 && <span className="hint">{(meds.length * (meds.length - 1)) / 2} pair{meds.length > 2 ? "s" : ""} will be screened.</span>}
        {meds.length > 0 && <button className="label-btn" onClick={share}>Copy share link</button>}
        {result && <button className="label-btn" onClick={() => window.print()}>Print summary</button>}
      </div>
      {shareMsg && <div className="note share-msg" role="status">{shareMsg}</div>}
      {error && <div className="err" role="alert">{error}</div>}

      {result && (
        <>
          <div className="print-only print-meta">
            Printed {new Date().toLocaleDateString()} · {meds.map((m) => m.name).join(", ")}
          </div>
          <div className="section-label">Interaction screening</div>
          {result.interactions.length === 0 ? (
            <div className="clear-card">
              No interactions found in the screening dataset for this combination.
              <small>This checks a curated set of clinically significant pairs; it is not exhaustive. A pharmacist review is always the gold standard.</small>
            </div>
          ) : (
            result.interactions.map((ix, i) => (
              <div className={`ix-card ${ix.severity}`} key={i}>
                <div className="ix-top">
                  <span className="ix-pair">{ix.drugA}<span className="x">×</span>{ix.drugB}</span>
                  <span>
                    {ix.type === "duplication" && <span className="dup-tag">Duplicate therapy</span>}
                    <span className={`sev ${ix.severity}`}>{SEV_LABEL[ix.severity]}</span>
                  </span>
                </div>
                <div className="ix-plain">{ix.plain}</div>
                <div className="ix-advice"><strong>What to do:</strong> {ix.advice}</div>
                <details className="mech">
                  <summary>mechanism</summary>
                  {ix.mechanism}
                </details>
              </div>
            ))
          )}

          <div className="section-label">Per-medication flags & counseling</div>
          {flagged.map((d) => {
            const f = d.flags;
            const hasFlags = f.schedule || f.nti || f.rems || f.counseling.length > 0;
            const ing = d.ingredients[0];
            const isCustom = d.rxcui.startsWith("custom");
            const lbl = labels[ing];
            return (
              <div className="drug-card" key={d.rxcui}>
                <div className="drug-head">
                  <h3>{d.name}</h3>
                  {f.schedule && <span className="pill-flag sched">Schedule {ROMAN[f.schedule]}</span>}
                  {f.nti && <span className="pill-flag nti">Narrow therapeutic index</span>}
                  {f.rems && <span className="pill-flag rems">REMS</span>}
                </div>
                {f.scheduleNote && <div className="note">{f.scheduleNote}</div>}
                {f.rems && <div className="note">{f.rems}</div>}
                {f.nti && !f.counseling.length && <div className="note">Small dose changes matter with this medicine; consistent timing and required lab monitoring are important.</div>}
                {f.counseling.length > 0 && <ul>{f.counseling.map((c, i) => <li key={i}>{c}</li>)}</ul>}
                {!hasFlags && !isCustom && <div className="note">No special handling flags for this medication.</div>}
                {ing && !isCustom && (
                  <>
                    <DoseChecker ingredient={ing} />
                    <button className="label-btn" onClick={() => loadLabel(ing)}>
                      Side effects from FDA label
                    </button>
                    {lbl?.loading && <div className="spin" style={{ marginTop: 6 }}>fetching label…</div>}
                    {lbl && !lbl.loading && (
                      <div className="fda-block">
                        {lbl.found === false && "No label found in openFDA for this ingredient."}
                        {lbl.boxedWarning && <div className="bw"><strong>Boxed warning:</strong> {lbl.boxedWarning}</div>}
                        {lbl.commonSideEffects?.length > 0 && (
                          <div>
                            <strong>Common side effects (from the FDA label):</strong>
                            <div className="se-chips">{lbl.commonSideEffects.map((s) => <span key={s}>{s}</span>)}</div>
                          </div>
                        )}
                        {lbl.adverseExcerpt && <div><strong>From the label:</strong> {lbl.adverseExcerpt}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      <details className="why">
        <summary>Why I built this</summary>
        <p>
          I've worked as a pharmacy tech for five years, at CVS, Costco, Walmart and H-E-B. One of the most
          common things we catch at the counter is duplicate therapy, like someone taking Tylenol on top of
          Norco without realizing both are acetaminophen. People also don't mention OTC stuff. Cold medicine
          and sleep aids just don't feel like real meds to them. RxNav's interaction API got shut down in
          January 2024, so I ended up curating the rules myself.
        </p>
      </details>

      <div className="disclaimer">
        Educational tool, not medical advice. Interaction screening uses a curated dataset of clinically
        significant pairs and is not exhaustive. Dose ranges are typical adult values and don't account for
        kidney or liver function, age, or indication. Always confirm with a pharmacist or prescriber.
      </div>
    </div>
  );
}
