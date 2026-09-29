const { checkPair, checkDuplication } = require("../data/interactions");
const { annotate } = require("../data/counseling");
const { checkDose } = require("../data/dosage");

describe("checkPair", () => {
  const sev = (a, b) => checkPair(a, b).map((r) => r.severity);

  test("warfarin + NSAID is major", () => {
    expect(sev(["warfarin"], ["ibuprofen"])).toContain("major");
  });
  test("class expansion: apixaban + naproxen hits anticoag/NSAID rule", () => {
    expect(sev(["apixaban"], ["naproxen"])).toContain("major");
  });
  test("PDE5 + nitrate is contraindicated", () => {
    expect(sev(["sildenafil"], ["nitroglycerin"])).toEqual(["contraindicated"]);
  });
  test("MAOI + SSRI is contraindicated, order-independent", () => {
    expect(sev(["phenelzine"], ["sertraline"])).toContain("contraindicated");
    expect(sev(["sertraline"], ["phenelzine"])).toContain("contraindicated");
  });
  test("QT class does not flag a drug against itself", () => {
    expect(sev(["citalopram"], ["citalopram"])).toEqual([]);
  });
  test("QT stacking across two different QT drugs flags major", () => {
    expect(sev(["citalopram"], ["ondansetron"])).toContain("major");
  });
  test("grapefruit + simvastatin is moderate", () => {
    expect(sev(["grapefruit"], ["simvastatin"])).toContain("moderate");
  });
  test("St. John's Wort + sertraline is major", () => {
    expect(sev(["st. john's wort"], ["sertraline"])).toContain("major");
  });
  test("inducer defeats birth control", () => {
    expect(sev(["carbamazepine"], ["ethinyl estradiol"])).toContain("major");
  });
  test("inducer + DOAC is major", () => {
    expect(sev(["rifampin"], ["apixaban"])).toContain("major");
  });
  test("case-insensitive matching", () => {
    expect(sev(["Warfarin"], ["IBUPROFEN"])).toContain("major");
  });
  test("multi-ingredient drug matches on any ingredient", () => {
    expect(sev(["hydrocodone", "acetaminophen"], ["alprazolam"])).toContain("major");
  });
  test("alcohol + opioid is major, + acetaminophen is moderate", () => {
    expect(sev(["oxycodone"], ["alcohol"])).toContain("major");
    expect(sev(["alcohol"], ["acetaminophen"])).toEqual(["moderate"]);
  });
  test("alcohol + zolpidem is major, + ibuprofen is moderate", () => {
    expect(sev(["zolpidem"], ["alcohol"])).toContain("major");
    expect(sev(["ibuprofen"], ["alcohol"])).toEqual(["moderate"]);
  });
  test("ginkgo flags with blood thinners but not unrelated drugs", () => {
    expect(sev(["ginkgo"], ["warfarin"])).toEqual(["moderate"]);
    expect(sev(["clopidogrel"], ["ginkgo"])).toEqual(["moderate"]);
    expect(sev(["ginkgo"], ["amlodipine"])).toEqual([]);
  });
  test("no interaction returns empty", () => {
    expect(sev(["amoxicillin"], ["amlodipine"])).toEqual([]);
  });
  test("every hit carries plain language and advice", () => {
    for (const r of checkPair(["warfarin"], ["ibuprofen"])) {
      expect(r.plain.length).toBeGreaterThan(20);
      expect(r.advice.length).toBeGreaterThan(10);
      expect(["contraindicated", "major", "moderate"]).toContain(r.severity);
    }
  });
});

describe("annotate", () => {
  test("oxycodone is Schedule II with note", () => {
    const f = annotate(["oxycodone"]);
    expect(f.schedule).toBe(2);
    expect(f.scheduleNote).toMatch(/No refills/);
  });
  test("tramadol is Schedule IV", () => {
    expect(annotate(["tramadol"]).schedule).toBe(4);
  });
  test("strictest schedule wins for combos", () => {
    expect(annotate(["tramadol", "oxycodone"]).schedule).toBe(2);
  });
  test("warfarin flags NTI and counseling", () => {
    const f = annotate(["warfarin"]);
    expect(f.nti).toBe(true);
    expect(f.counseling.length).toBeGreaterThan(0);
  });
  test("isotretinoin flags REMS", () => {
    expect(annotate(["isotretinoin"]).rems).toMatch(/iPLEDGE/);
  });
  test("plain drug has no flags", () => {
    const f = annotate(["amlodipine"]);
    expect(f.schedule).toBeNull();
    expect(f.nti).toBe(false);
    expect(f.rems).toBeNull();
  });
});

describe("checkDose", () => {
  test("unknown drug reports not known", () => {
    expect(checkDose("obscuredrug", 100).known).toBe(false);
  });
  test("within range is ok", () => {
    expect(checkDose("ibuprofen", 1200).verdict).toBe("ok");
  });
  test("near max flags", () => {
    expect(checkDose("acetaminophen", 3500).verdict).toBe("near-max");
  });
  test("above max flags", () => {
    expect(checkDose("sertraline", 250).verdict).toBe("above-max");
  });
  test("way above max flags high", () => {
    expect(checkDose("acetaminophen", 8000).verdict).toBe("high");
  });
  test("case insensitive", () => {
    expect(checkDose("Ibuprofen", 800).known).toBe(true);
  });
});

describe("checkDuplication", () => {
  const dup = (a, b) => checkDuplication(a, b);

  test("same ingredient in two products: acetaminophen is major", () => {
    const r = dup(["acetaminophen"], ["acetaminophen", "hydrocodone"]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ type: "duplication", severity: "major" });
    expect(r[0].plain).toMatch(/acetaminophen/);
  });
  test("any other shared ingredient is moderate", () => {
    expect(dup(["ibuprofen"], ["ibuprofen", "diphenhydramine"]).map((r) => r.severity)).toEqual(["moderate"]);
  });
  test("two different NSAIDs flag once, as moderate", () => {
    const r = dup(["ibuprofen"], ["naproxen"]);
    expect(r).toHaveLength(1);
    expect(r[0].severity).toBe("moderate");
  });
  test("aspirin next to another NSAID is not a duplicate", () => {
    expect(dup(["aspirin"], ["ibuprofen"])).toEqual([]);
  });
  test("two SSRIs and ACE + ARB are major", () => {
    expect(dup(["sertraline"], ["fluoxetine"])[0].severity).toBe("major");
    expect(dup(["lisinopril"], ["losartan"])[0].severity).toBe("major");
  });
  test("a shared ingredient is not also counted as a class duplicate", () => {
    expect(dup(["naproxen"], ["naproxen"])).toHaveLength(1);
  });
  test("unrelated drugs return nothing", () => {
    expect(dup(["warfarin"], ["ibuprofen"])).toEqual([]);
  });
});
