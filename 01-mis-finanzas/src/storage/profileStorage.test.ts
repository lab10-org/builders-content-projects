// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { FinancialProfile } from "../domain/financialProfile";
import { PROFILE_KEY, loadProfile, saveProfile } from "./profileStorage";

const PROFILE: FinancialProfile = {
  goal: "pay-off-debt",
  riskTolerance: "balanced",
  incomeSources: ["salary", "rental"],
};

beforeEach(() => {
  localStorage.clear();
});

describe("saveProfile", () => {
  it("round-trips through loadProfile", () => {
    saveProfile(PROFILE);

    expect(loadProfile()).toEqual(PROFILE);
  });

  it("replaces a previously stored profile rather than appending", () => {
    saveProfile(PROFILE);
    saveProfile({ ...PROFILE, goal: "retirement" });

    expect(loadProfile()?.goal).toBe("retirement");
  });
});

describe("loadProfile", () => {
  it("returns null before the question has ever been answered", () => {
    expect(loadProfile()).toBeNull();
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["an array", "[]"],
    ["null", "null"],
    ["an empty object", "{}"],
    ["an unknown goal", '{"goal":"yacht","riskTolerance":"balanced","incomeSources":["salary"]}'],
    ["an unknown risk level", '{"goal":"retirement","riskTolerance":"wild","incomeSources":["salary"]}'],
    ["no income sources", '{"goal":"retirement","riskTolerance":"balanced","incomeSources":[]}'],
    ["income sources that are not an array", '{"goal":"retirement","riskTolerance":"balanced","incomeSources":"salary"}'],
    ["an unknown income source", '{"goal":"retirement","riskTolerance":"balanced","incomeSources":["lottery"]}'],
  ])("returns null for %s rather than throwing", (_case, raw) => {
    localStorage.setItem(PROFILE_KEY, raw);

    expect(loadProfile()).toBeNull();
  });

  it("drops fields from an older shape", () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ ...PROFILE, monthlyIncome: 4200 }),
    );

    expect(loadProfile()).toEqual(PROFILE);
  });
});
