import { describe, expect, it } from "vitest";

import {
  GOALS,
  INCOME_SOURCES,
  RISK_LEVELS,
  describeRisk,
  validateProfile,
} from "./financialProfile";

const VALID = {
  goal: "pay-off-debt",
  riskTolerance: "balanced",
  incomeSources: ["salary"],
};

function errorFields(input: {
  goal: unknown;
  riskTolerance: unknown;
  incomeSources: unknown;
}) {
  const result = validateProfile(input);
  return result.ok ? [] : result.errors.map((error) => error.field);
}

describe("the options offered", () => {
  it("lists the five goals from the design, in order", () => {
    expect(GOALS.map((goal) => goal.label)).toEqual([
      "Build an emergency fund",
      "Pay off debt",
      "Save for a big purchase",
      "Grow long-term wealth",
      "Prepare for retirement",
    ]);
  });

  it("lists the three risk levels from the design, in order", () => {
    expect(RISK_LEVELS.map((level) => level.label)).toEqual([
      "Conservative",
      "Balanced",
      "Aggressive",
    ]);
  });

  it("lists the six income sources from the design, in order", () => {
    expect(INCOME_SOURCES.map((source) => source.label)).toEqual([
      "Salary",
      "Freelance",
      "Business",
      "Investments",
      "Rental",
      "Other",
    ]);
  });

  it("gives every option a distinct value", () => {
    for (const options of [GOALS, RISK_LEVELS, INCOME_SOURCES]) {
      const values = options.map((option) => option.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe("describeRisk", () => {
  it("returns the design's wording for the balanced level", () => {
    expect(describeRisk("balanced")).toBe(
      "Balanced — a mix of growth and stability, accepting moderate ups and downs for steady long-term returns.",
    );
  });

  it("describes every level, so the card is never blank", () => {
    for (const level of RISK_LEVELS) {
      expect(describeRisk(level.value).length).toBeGreaterThan(0);
    }
  });

  it("opens each description with its own level's name", () => {
    for (const level of RISK_LEVELS) {
      expect(describeRisk(level.value).startsWith(level.label)).toBe(true);
    }
  });
});

describe("validateProfile", () => {
  it("accepts a complete profile", () => {
    expect(validateProfile(VALID)).toEqual({
      ok: true,
      profile: {
        goal: "pay-off-debt",
        riskTolerance: "balanced",
        incomeSources: ["salary"],
      },
    });
  });

  describe("goal", () => {
    it.each([
      ["nothing chosen", null],
      ["an empty string", ""],
      ["a value that is not on the list", "buy-a-yacht"],
      ["a non-string", 3],
    ])("rejects %s", (_case, goal) => {
      expect(errorFields({ ...VALID, goal })).toEqual(["goal"]);
    });

    it("accepts every goal the design offers", () => {
      for (const goal of GOALS) {
        expect(validateProfile({ ...VALID, goal: goal.value }).ok).toBe(true);
      }
    });
  });

  describe("risk tolerance", () => {
    it.each([
      ["nothing chosen", null],
      ["a value that is not on the list", "reckless"],
      ["a non-string", true],
    ])("rejects %s", (_case, riskTolerance) => {
      expect(errorFields({ ...VALID, riskTolerance })).toEqual(["riskTolerance"]);
    });

    it("accepts every level the design offers", () => {
      for (const level of RISK_LEVELS) {
        expect(
          validateProfile({ ...VALID, riskTolerance: level.value }).ok,
        ).toBe(true);
      }
    });
  });

  describe("income sources", () => {
    it("requires at least one, because the question is not optional", () => {
      expect(errorFields({ ...VALID, incomeSources: [] })).toEqual([
        "incomeSources",
      ]);
    });

    it.each([
      ["a non-array", "salary"],
      ["null", null],
      ["an array of only unknown values", ["lottery"]],
    ])("rejects %s", (_case, incomeSources) => {
      expect(errorFields({ ...VALID, incomeSources })).toEqual([
        "incomeSources",
      ]);
    });

    it("accepts several at once", () => {
      const result = validateProfile({
        ...VALID,
        incomeSources: ["salary", "rental"],
      });

      expect(result.ok && result.profile.incomeSources).toEqual([
        "salary",
        "rental",
      ]);
    });

    it("drops unknown values but keeps the recognised ones", () => {
      const result = validateProfile({
        ...VALID,
        incomeSources: ["salary", "lottery"],
      });

      expect(result.ok && result.profile.incomeSources).toEqual(["salary"]);
    });

    it("collapses duplicates", () => {
      const result = validateProfile({
        ...VALID,
        incomeSources: ["salary", "salary"],
      });

      expect(result.ok && result.profile.incomeSources).toEqual(["salary"]);
    });

    it("normalizes to the design's order, not the order they arrived in", () => {
      // Two users who picked the same sources should produce identical profiles.
      const result = validateProfile({
        ...VALID,
        incomeSources: ["other", "freelance", "salary"],
      });

      expect(result.ok && result.profile.incomeSources).toEqual([
        "salary",
        "freelance",
        "other",
      ]);
    });
  });

  it("reports every problem at once, in question order", () => {
    expect(
      errorFields({ goal: null, riskTolerance: null, incomeSources: [] }),
    ).toEqual(["goal", "riskTolerance", "incomeSources"]);
  });

  it("returns no profile when validation fails", () => {
    const result = validateProfile({
      goal: null,
      riskTolerance: null,
      incomeSources: [],
    });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("profile");
  });
});
