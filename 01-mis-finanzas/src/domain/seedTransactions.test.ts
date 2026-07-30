import { describe, expect, it } from "vitest";

import { buildSeedTransactions, isSeeded } from "./seedTransactions";
import { summarize } from "./snapshot";
import { categoryLabel } from "./transaction";

const TODAY = "2026-07-29";

function seeded(today = TODAY) {
  return buildSeedTransactions(today);
}

/** The seed's whole purpose: these are the mockup's figures. */
describe("the figures the design shows", () => {
  const snapshot = summarize(seeded());

  it("reports a $48,920 total balance", () => {
    expect(snapshot?.balance).toBe(48920);
  });

  it("reports $7,450 of monthly income", () => {
    expect(snapshot?.income).toBe(7450);
  });

  it("reports $5,710 of monthly spending", () => {
    expect(snapshot?.spending).toBe(5710);
  });

  it("reports a 23% savings rate", () => {
    expect(Math.round((snapshot?.savingsRate ?? 0) * 100)).toBe(23);
  });

  it("reproduces the four spending amounts the design draws", () => {
    const amounts = new Map(
      snapshot?.byCategory.map((entry) => [entry.category, entry.amount]),
    );

    expect(amounts.get("housing")).toBe(2180);
    expect(amounts.get("food")).toBe(960);
    expect(amounts.get("transport")).toBe(540);
    expect(amounts.get("subscriptions")).toBe(310);
  });

  it("puts housing on top, at the design's 38%", () => {
    expect(snapshot?.byCategory[0].category).toBe("housing");
    expect(Math.round((snapshot?.byCategory[0].share ?? 0) * 100)).toBe(38);
  });

  it("accounts for every dollar of spending in the breakdown", () => {
    // The mockup's four bars sum to $3,990 against a stated $5,710; the seeded
    // categories reconcile, so nothing is quietly missing from the chart.
    const total = snapshot?.byCategory.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );

    expect(total).toBe(snapshot?.spending);
  });

  it("produces the design's three highlights", () => {
    expect(snapshot?.highlights).toEqual([
      { kind: "trend", text: "Spending is down 8% vs. last month." },
      { kind: "composition", text: "Housing is your top category at 38%." },
      { kind: "warning", text: "2 subscriptions cost $310 a month." },
    ]);
  });
});

describe("buildSeedTransactions", () => {
  it("puts the latest activity in the month of the given date", () => {
    expect(summarize(seeded("2026-07-29"))?.month).toBe("2026-07");
  });

  it("follows the reference date rather than a hardcoded month", () => {
    expect(summarize(seeded("2027-03-04"))?.month).toBe("2027-03");
  });

  it("produces the same figures whatever the reference month", () => {
    // Nothing may depend on the calendar — a user onboarding in December must
    // see the same demo snapshot as one onboarding in July.
    for (const today of ["2026-01-15", "2026-07-29", "2026-12-31"]) {
      const snapshot = summarize(seeded(today));
      expect(snapshot?.balance).toBe(48920);
      expect(snapshot?.spending).toBe(5710);
      expect(snapshot?.highlights[0].text).toBe(
        "Spending is down 8% vs. last month.",
      );
    }
  });

  it("rolls the previous month across a year boundary", () => {
    const january = seeded("2026-01-15");

    expect(january.some((entry) => entry.date.startsWith("2025-12"))).toBe(true);
  });

  it("dates every transaction as a valid normalized day", () => {
    for (const entry of seeded()) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps the opening balance out of both months' figures", () => {
    const snapshot = summarize(seeded());

    // It shows up in the standing balance but not in the monthly flow.
    expect(snapshot?.income).toBe(7450);
    expect(snapshot?.balance).toBeGreaterThan(snapshot?.income ?? 0);
  });

  it("gives every entry a distinct id", () => {
    const ids = seeded().map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only positive amounts — the sign lives in the type", () => {
    for (const entry of seeded()) {
      expect(entry.amount).toBeGreaterThan(0);
    }
  });

  it("labels every category in both languages, so neither screen breaks", () => {
    for (const entry of seeded()) {
      expect(categoryLabel(entry.category, "es").length).toBeGreaterThan(0);
      expect(categoryLabel(entry.category, "en").length).toBeGreaterThan(0);
    }
  });
});

describe("isSeeded", () => {
  it("recognizes every demo row", () => {
    for (const entry of seeded()) {
      expect(isSeeded(entry)).toBe(true);
    }
  });

  it("does not claim a user's own transaction is demo data", () => {
    expect(
      isSeeded({
        id: "8f1c2f6e-0000-4000-8000-000000000000",
        type: "expense",
        amount: 10,
        currency: "USD",
        date: "2026-07-29",
        description: "Coffee",
        category: "food",
      }),
    ).toBe(false);
  });
});

describe("recomputing after the user adds something", () => {
  it("moves the monthly spending figure", () => {
    const withExtra = summarize([
      ...seeded(),
      {
        id: "user-1",
        type: "expense" as const,
        amount: 142.3,
        currency: "USD" as const,
        date: "2026-07-20",
        description: "Groceries — Whole Foods",
        category: "food" as const,
      },
    ]);

    expect(withExtra?.spending).toBeCloseTo(5710 + 142.3, 2);
    expect(withExtra?.byCategory.find((c) => c.category === "food")?.amount).toBe(
      960 + 142.3,
    );
  });

  it("moves the balance when income is added", () => {
    const withIncome = summarize([
      ...seeded(),
      {
        id: "user-2",
        type: "income" as const,
        amount: 1200,
        currency: "USD" as const,
        date: "2026-07-18",
        description: "Freelance project",
        category: "other" as const,
      },
    ]);

    expect(withIncome?.balance).toBe(48920 + 1200);
    expect(withIncome?.income).toBe(7450 + 1200);
  });
});
