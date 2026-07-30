import { describe, expect, it } from "vitest";

import type { FinancialProfile } from "./financialProfile";
import {
  PROJECTION_MONTHS,
  addMonths,
  buildPlan,
  monthLabel,
  monthTitle,
} from "./plan";
import type { Snapshot } from "./snapshot";

const PROFILE: FinancialProfile = {
  goal: "emergency-fund",
  riskTolerance: "balanced",
  incomeSources: ["salary"],
};

/**
 * A month matching the design's allocation: $3,000 in, $1,650 of needs, $930 of
 * wants, leaving $420.
 */
function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    balance: 0,
    month: "2026-07",
    income: 3000,
    spending: 2580,
    savingsRate: 0.14,
    byCategory: [
      { category: "housing", amount: 1200, share: 1200 / 2580 },
      { category: "food", amount: 450, share: 450 / 2580 },
      { category: "leisure", amount: 700, share: 700 / 2580 },
      { category: "subscriptions", amount: 230, share: 230 / 2580 },
    ],
    highlights: [],
    ...overrides,
  };
}

describe("addMonths", () => {
  it.each([
    ["2026-07", 1, "2026-08"],
    ["2026-07", 5, "2026-12"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", 11, "2026-12"],
    ["2026-07", 30, "2029-01"],
    ["2026-07", 0, "2026-07"],
  ])("%s + %i months = %s", (month, count, expected) => {
    expect(addMonths(month, count)).toBe(expected);
  });
});

describe("monthLabel / monthTitle", () => {
  it("abbreviates for the axis", () => {
    expect(monthLabel("2026-07")).toBe("Jul");
    expect(monthLabel("2026-01")).toBe("Jan");
    expect(monthLabel("2026-12")).toBe("Dec");
  });

  it("spells out for the goal date", () => {
    expect(monthTitle("2027-12")).toBe("December 2027");
  });
});

describe("allocation", () => {
  it("splits income into needs, wants and what is left", () => {
    // The design's split: 1650 / 930 / 420 of 3000.
    const { allocation } = buildPlan(PROFILE, snapshot());

    expect(allocation).toEqual({
      income: 3000,
      needs: 1650,
      wants: 930,
      savings: 420,
    });
  });

  it("files each category by its bucket", () => {
    const { allocation } = buildPlan(
      PROFILE,
      snapshot({
        income: 1000,
        byCategory: [
          { category: "transport", amount: 300, share: 0.5 }, // needs
          { category: "leisure", amount: 300, share: 0.5 }, // wants
        ],
      }),
    );

    expect(allocation.needs).toBe(300);
    expect(allocation.wants).toBe(300);
  });

  it("always adds up to income, even when the parts round", () => {
    const { allocation } = buildPlan(
      PROFILE,
      snapshot({
        income: 1000,
        byCategory: [
          { category: "housing", amount: 333.33, share: 0.5 },
          { category: "leisure", amount: 333.33, share: 0.5 },
        ],
      }),
    );

    expect(allocation.needs + allocation.wants + allocation.savings).toBe(
      allocation.income,
    );
  });

  it("goes negative on savings when spending exceeds income", () => {
    const { allocation } = buildPlan(
      PROFILE,
      snapshot({
        income: 1000,
        byCategory: [{ category: "housing", amount: 1500, share: 1 }],
      }),
    );

    expect(allocation.savings).toBe(-500);
  });
});

describe("the monthly target", () => {
  it("is whatever the allocation leaves over", () => {
    // The design shows the same $420 as both "Savings" and "Monthly target".
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.monthlyTarget).toBe(420);
    expect(plan.monthlyTarget).toBe(plan.allocation.savings);
  });
});

describe("the goal target", () => {
  it("sizes an emergency fund at six months of essential spending", () => {
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.target).toBe(1650 * 6);
  });

  it("scales the other goals to income", () => {
    const plan = buildPlan({ ...PROFILE, goal: "retirement" }, snapshot());

    expect(plan.target).toBe(3000 * 24);
  });

  it("gives every goal a target, so the hero is never blank", () => {
    for (const goal of [
      "emergency-fund",
      "pay-off-debt",
      "big-purchase",
      "long-term-wealth",
      "retirement",
    ] as const) {
      expect(buildPlan({ ...PROFILE, goal }, snapshot()).target).toBeGreaterThan(
        0,
      );
    }
  });

  it("carries the goal through unchanged", () => {
    expect(buildPlan({ ...PROFILE, goal: "big-purchase" }, snapshot()).goal).toBe(
      "big-purchase",
    );
  });
});

describe("months to goal", () => {
  it("counts what is left at the monthly rate", () => {
    // 9900 target, nothing saved, 420 a month → 24 months.
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.monthsToGoal).toBe(Math.ceil(9900 / 420));
  });

  it("credits what is already saved", () => {
    const withSavings = buildPlan(PROFILE, snapshot({ balance: 5000 }));
    const without = buildPlan(PROFILE, snapshot());

    expect(withSavings.saved).toBe(5000);
    expect(withSavings.monthsToGoal).toBeLessThan(without.monthsToGoal ?? 0);
  });

  it("treats a negative balance as nothing saved, not as a setback", () => {
    const plan = buildPlan(PROFILE, snapshot({ balance: -2000 }));

    expect(plan.saved).toBe(0);
  });

  it("reports the goal as already funded rather than one month away", () => {
    // A healthy balance really can cover a six-month emergency fund, and
    // "1 month to goal" would be a worse answer than saying it is done.
    const plan = buildPlan(PROFILE, snapshot({ balance: 999999 }));

    expect(plan.monthsToGoal).toBe(0);
    expect(plan.status).toBe("reached");
    expect(plan.targetDate).toBeNull();
  });

  it("congratulates rather than telling a funded user to save harder", () => {
    const plan = buildPlan(PROFILE, snapshot({ balance: 999999 }));

    expect(plan.tips[0]).toContain("fully funded");
  });

  it("is unreachable when nothing is left over each month", () => {
    const plan = buildPlan(
      PROFILE,
      snapshot({
        income: 1000,
        byCategory: [{ category: "housing", amount: 1000, share: 1 }],
      }),
    );

    expect(plan.monthsToGoal).toBeNull();
    expect(plan.targetDate).toBeNull();
  });

  it("dates the goal from the snapshot's month", () => {
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.targetDate).toBe(
      monthTitle(addMonths("2026-07", plan.monthsToGoal as number)),
    );
  });
});

describe("status", () => {
  it("is on track while there is money left to save and a gap to close", () => {
    expect(buildPlan(PROFILE, snapshot()).status).toBe("on-track");
  });

  it("is at risk when spending uses everything", () => {
    const plan = buildPlan(
      PROFILE,
      snapshot({
        income: 1000,
        byCategory: [{ category: "housing", amount: 1100, share: 1 }],
      }),
    );

    expect(plan.status).toBe("at-risk");
  });
});

describe("the twelve-month projection", () => {
  it("covers twelve consecutive months from the snapshot's", () => {
    const { projection } = buildPlan(PROFILE, snapshot());

    expect(projection).toHaveLength(PROJECTION_MONTHS);
    expect(projection[0].month).toBe("2026-07");
    expect(projection[11].month).toBe("2027-06");
  });

  it("labels each month for the axis", () => {
    const { projection } = buildPlan(PROFILE, snapshot());

    expect(projection.map((entry) => entry.label)).toEqual([
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
    ]);
  });

  it("holds needs flat, as the design's chart does", () => {
    const { projection } = buildPlan(PROFILE, snapshot());

    for (const month of projection) {
      expect(month.needs).toBe(1650);
    }
  });

  it("starts at today's allocation", () => {
    const { projection, allocation } = buildPlan(PROFILE, snapshot());

    expect(projection[0]).toMatchObject({
      needs: allocation.needs,
      wants: allocation.wants,
      savings: allocation.savings,
    });
  });

  it("raises savings and eases wants by the same amount every month", () => {
    const { projection } = buildPlan(PROFILE, snapshot());

    for (const month of projection) {
      expect(month.needs + month.wants + month.savings).toBe(3000);
    }
  });

  it("moves a quarter of discretionary spending by the last month", () => {
    const { projection } = buildPlan(PROFILE, snapshot());
    const last = projection[11];

    expect(last.savings).toBe(420 + Math.round(930 * 0.25));
    expect(last.wants).toBe(930 - Math.round(930 * 0.25));
  });

  it("rises monotonically, never dipping", () => {
    const { projection } = buildPlan(PROFILE, snapshot());

    for (let index = 1; index < projection.length; index += 1) {
      expect(projection[index].savings).toBeGreaterThanOrEqual(
        projection[index - 1].savings,
      );
      expect(projection[index].wants).toBeLessThanOrEqual(
        projection[index - 1].wants,
      );
    }
  });
});

describe("tips", () => {
  it("names the transfer to automate", () => {
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.tips[0]).toBe(
      "Automate a $420 transfer to savings each payday.",
    );
  });

  it("quantifies the trim in discretionary spending", () => {
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.tips[1]).toContain("$233");
  });

  it("keeps the design's closing reassurance", () => {
    const plan = buildPlan(PROFILE, snapshot());

    expect(plan.tips).toContain(
      "We recheck your plan every 6 months and adjust.",
    );
  });

  it("does not tell an overspending user to automate a transfer", () => {
    const plan = buildPlan(
      PROFILE,
      snapshot({
        income: 1000,
        byCategory: [{ category: "housing", amount: 1100, share: 1 }],
      }),
    );

    expect(plan.tips[0]).not.toContain("Automate");
    expect(plan.tips[0]).toContain("free up room");
  });

  it("never emits a broken sentence", () => {
    const plan = buildPlan(PROFILE, snapshot());

    for (const tip of plan.tips) {
      expect(tip).not.toContain("undefined");
      expect(tip).not.toContain("NaN");
      expect(tip.endsWith(".")).toBe(true);
    }
  });
});
