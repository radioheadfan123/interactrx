import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

const SEARCH = { results: [
  { rxcui: "11289", name: "warfarin" },
  { rxcui: "5640", name: "ibuprofen" },
]};
const IX = {
  drugs: [
    { rxcui: "11289", name: "warfarin", ingredients: ["warfarin"], flags: { schedule: null, scheduleNote: null, nti: true, rems: null, counseling: ["Regular INR blood checks are essential."] } },
    { rxcui: "5640", name: "ibuprofen", ingredients: ["ibuprofen"], flags: { schedule: null, scheduleNote: null, nti: false, rems: null, counseling: [] } },
  ],
  interactions: [{ drugA: "warfarin", drugB: "ibuprofen", severity: "major", plain: "Taking these together significantly raises the risk of serious bleeding.", mechanism: "Additive bleeding risk.", advice: "Avoid the combination when possible." }],
};

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn((url, opts) => {
    const ok = (j) => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
    if (String(url).includes("/api/search")) return ok(SEARCH);
    if (String(url).includes("/api/interactions")) return ok(IX);
    if (String(url).includes("/api/dose")) return ok({ known: true, verdict: "high", message: "That's well above the typical adult maximum of 3200 mg/day.", caveat: null });
    if (String(url).includes("/api/label")) return ok({ found: true, boxedWarning: null, commonSideEffects: ["nausea", "headache"], adverseExcerpt: null });
    return ok({});
  });
});

async function addTwoMeds(user) {
  const input = screen.getByRole("combobox");
  await user.type(input, "warf");
  const opt = await screen.findByText("warfarin");
  await user.click(opt);
  await user.type(input, "ibup");
  await user.click(await screen.findByText("ibuprofen"));
}

describe("InteractRx UI", () => {
  test("renders empty state", () => {
    render(<App />);
    expect(screen.getByText(/Add two or more items/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Check interactions/ })).toBeDisabled();
  });

  test("search, add via click, chips render, check enabled", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTwoMeds(user);
    expect(screen.getByRole("button", { name: /Check interactions/ })).toBeEnabled();
    expect(screen.getByText(/1 pair will be screened/)).toBeTruthy();
  });

  test("keyboard navigation: arrow down + enter adds highlighted med", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByRole("combobox");
    await user.type(input, "warf");
    await screen.findByText("warfarin");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    // second option (ibuprofen) should now be a chip
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove ibuprofen/ })).toBeTruthy());
  });

  test("full check flow renders severity card, flags, counseling", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTwoMeds(user);
    await user.click(screen.getByRole("button", { name: /Check interactions/ }));
    expect(await screen.findByText("Major")).toBeTruthy();
    expect(screen.getByText(/serious bleeding/)).toBeTruthy();
    expect(screen.getByText("Narrow therapeutic index")).toBeTruthy();
    expect(screen.getByText(/INR blood checks/)).toBeTruthy();
  });

  test("dose checker shows verdict", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTwoMeds(user);
    await user.click(screen.getByRole("button", { name: /Check interactions/ }));
    await screen.findByText("Major");
    const doseInput = screen.getByLabelText(/Daily dose of ibuprofen/);
    await user.type(doseInput, "4800");
    await user.click(screen.getAllByRole("button", { name: /Sanity check/ })[1]);
    expect(await screen.findByText(/well above the typical adult maximum/)).toBeTruthy();
  });

  test("FDA label side effect chips render", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTwoMeds(user);
    await user.click(screen.getByRole("button", { name: /Check interactions/ }));
    await screen.findByText("Major");
    await user.click(screen.getAllByRole("button", { name: /Side effects from FDA label/ })[0]);
    expect(await screen.findByText("nausea")).toBeTruthy();
  });

  test("med list persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTwoMeds(user);
    const saved = JSON.parse(localStorage.getItem("meds"));
    expect(saved).toHaveLength(2);
    expect(saved[0].name).toBe("warfarin");
  });
});
