const request = require("supertest");

// Mock global fetch so tests don't hit RxNorm/openFDA
global.fetch = jest.fn((url) => {
  const ok = (json) => Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
  if (url.includes("approximateTerm")) {
    return ok({ approximateGroup: { candidate: [{ rxcui: "5640", name: "ibuprofen", score: "100" }] } });
  }
  if (url.includes("/rxcui/5640/properties")) {
    return ok({ properties: { rxcui: "5640", name: "ibuprofen", tty: "IN" } });
  }
  if (url.includes("/related.json")) {
    const map = { "5640": "ibuprofen", "11289": "warfarin" };
    const id = url.match(/rxcui\/(\d+)\//)[1];
    return ok({ relatedGroup: { conceptGroup: [{ tty: "IN", conceptProperties: [{ name: map[id] || "unknown" }] }] } });
  }
  if (url.includes("api.fda.gov")) {
    return ok({ results: [{ adverse_reactions: ["Common reactions included nausea, headache, dizziness, and rash."], openfda: { brand_name: ["Advil"] } }] });
  }
  return ok({});
});

const app = require("../index");

describe("API", () => {
  test("health", async () => {
    const r = await request(app).get("/api/health");
    expect(r.body.ok).toBe(true);
  });
  test("search returns filtered results", async () => {
    const r = await request(app).get("/api/search?q=ibuprofen");
    expect(r.status).toBe(200);
    expect(r.body.results[0].name).toBe("ibuprofen");
  });
  test("search injects grapefruit pseudo-entry", async () => {
    const r = await request(app).get("/api/search?q=grapefruit");
    expect(r.body.results.some((x) => x.rxcui === "custom:grapefruit")).toBe(true);
  });
  test("interactions rejects malformed payloads", async () => {
    for (const bad of [{}, { drugs: "x" }, { drugs: [{ rxcui: "<script>", name: "x" }] }, { drugs: [] }]) {
      const r = await request(app).post("/api/interactions").send(bad);
      expect(r.status).toBe(400);
    }
  });
  test("interactions finds warfarin + ibuprofen", async () => {
    const r = await request(app).post("/api/interactions").send({
      drugs: [{ rxcui: "11289", name: "warfarin" }, { rxcui: "5640", name: "ibuprofen" }],
    });
    expect(r.status).toBe(200);
    expect(r.body.interactions.some((i) => i.severity === "major")).toBe(true);
    expect(r.body.drugs.find((d) => d.name === "warfarin").flags.nti).toBe(true);
  });
  test("pseudo-entry grapefruit interacts with resolved statin", async () => {
    global.fetch.mockImplementationOnce((url) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ relatedGroup: { conceptGroup: [{ conceptProperties: [{ name: "simvastatin" }] }] } }) })
    );
    const r = await request(app).post("/api/interactions").send({
      drugs: [{ rxcui: "36567", name: "simvastatin" }, { rxcui: "custom:grapefruit", name: "Grapefruit" }],
    });
    expect(r.body.interactions.some((i) => i.plain.match(/grapefruit/i) || i.mechanism.match(/grapefruit/i))).toBe(true);
  });
  test("dose endpoint validates and answers", async () => {
    expect((await request(app).get("/api/dose?name=ibuprofen")).status).toBe(400);
    const r = await request(app).get("/api/dose?name=ibuprofen&daily=4800");
    expect(r.body.verdict).toBe("high");
  });
  test("label endpoint parses common side effects", async () => {
    const r = await request(app).get("/api/label?name=ibuprofen");
    expect(r.body.found).toBe(true);
    expect(r.body.commonSideEffects).toEqual(expect.arrayContaining(["nausea", "headache"]));
  });
});
