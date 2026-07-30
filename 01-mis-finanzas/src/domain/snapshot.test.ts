import { describe, expect, it } from "vitest";

import { type Snapshot, monthOf, summarize } from "./snapshot";
import type { Category, Transaction, TransactionType } from "./transaction";

let counter = 0;

function tx(
  type: TransactionType,
  amount: number,
  date: string,
  category: Category = "other",
): Transaction {
  return {
    id: `t${++counter}`,
    type,
    amount,
    currency: "USD",
    date,
    description: `entry ${counter}`,
    category,
  };
}

/** Highlight sentences, which is what most assertions care about. */
function texts(snapshot: Snapshot | null): string[] {
  return (snapshot?.highlights ?? []).map((highlight) => highlight.text);
}

const expense = (amount: number, date: string, category?: Category) =>
  tx("expense", amount, date, category);
const income = (amount: number, date: string) => tx("income", amount, date);

describe("monthOf", () => {
  it("takes the year and month of a normalized date", () => {
    expect(monthOf("2026-07-02")).toBe("2026-07");
  });
});

describe("summarize", () => {
  it("returns null when there is nothing to summarize", () => {
    expect(summarize([])).toBeNull();
  });

  it("describes the most recent month that has data", () => {
    const snapshot = summarize([
      expense(100, "2026-05-10"),
      expense(200, "2026-07-01"),
      expense(300, "2026-06-15"),
    ]);

    expect(snapshot?.month).toBe("2026-07");
  });

  it("counts only the described month's income and spending", () => {
    const snapshot = summarize([
      income(7450, "2026-07-01"),
      expense(5710, "2026-07-15"),
      income(9999, "2026-06-01"), // an earlier month must not leak in
      expense(8888, "2026-06-02"),
    ]);

    expect(snapshot?.income).toBe(7450);
    expect(snapshot?.spending).toBe(5710);
  });

  describe("balance", () => {
    it("spans every transaction, not just the month", () => {
      // "Total balance" in the design is a standing figure, so a month's window
      // would understate it.
      const snapshot = summarize([
        income(1000, "2026-05-01"),
        income(1000, "2026-07-01"),
        expense(400, "2026-06-01"),
      ]);

      expect(snapshot?.balance).toBe(1600);
    });

    it("goes negative when more was spent than earned", () => {
      const snapshot = summarize([
        income(100, "2026-07-01"),
        expense(250, "2026-07-02"),
      ]);

      expect(snapshot?.balance).toBe(-150);
    });
  });

  describe("savings rate", () => {
    it("is the share of the month's income that was not spent", () => {
      // The design's figures: 7450 in, 5710 out → 23%.
      const snapshot = summarize([
        income(7450, "2026-07-01"),
        expense(5710, "2026-07-15"),
      ]);

      expect(Math.round((snapshot?.savingsRate ?? 0) * 100)).toBe(23);
    });

    it("is negative when the month overspent, rather than clamped to zero", () => {
      const snapshot = summarize([
        income(1000, "2026-07-01"),
        expense(1500, "2026-07-02"),
      ]);

      expect(snapshot?.savingsRate).toBeLessThan(0);
    });

    it("is zero when the month had no income, instead of dividing by zero", () => {
      const snapshot = summarize([expense(500, "2026-07-02")]);

      expect(snapshot?.savingsRate).toBe(0);
      expect(Number.isFinite(snapshot?.savingsRate)).toBe(true);
    });
  });

  describe("spending by category", () => {
    const MONTH = [
      income(5710, "2026-07-01"),
      expense(2180, "2026-07-02", "housing"),
      expense(960, "2026-07-03", "food"),
      expense(540, "2026-07-04", "transport"),
      expense(310, "2026-07-05", "subscriptions"),
    ];

    it("orders categories by amount, largest first", () => {
      const snapshot = summarize(MONTH);

      expect(snapshot?.byCategory.map((entry) => entry.category)).toEqual([
        "housing",
        "food",
        "transport",
        "subscriptions",
      ]);
    });

    it("sums several transactions in the same category", () => {
      const snapshot = summarize([
        expense(1000, "2026-07-02", "food"),
        expense(500, "2026-07-03", "food"),
      ]);

      expect(snapshot?.byCategory[0]).toMatchObject({
        category: "food",
        amount: 1500,
      });
    });

    it("takes each share of total spending, not of the categories shown", () => {
      // 2180 of 3990 total spending → 55%, and the design's "38%" for housing
      // only works because that month has more spending than these four bars.
      const snapshot = summarize(MONTH);
      const housing = snapshot?.byCategory[0];

      expect(housing?.share).toBeCloseTo(2180 / 3990, 5);
    });

    it("excludes income from the breakdown", () => {
      const snapshot = summarize(MONTH);

      expect(snapshot?.byCategory.every((entry) => entry.amount > 0)).toBe(true);
      expect(
        snapshot?.byCategory.reduce((total, entry) => total + entry.amount, 0),
      ).toBe(3990);
    });

    it("excludes earlier months", () => {
      const snapshot = summarize([
        expense(100, "2026-07-02", "food"),
        expense(999, "2026-06-02", "housing"),
      ]);

      expect(snapshot?.byCategory).toHaveLength(1);
      expect(snapshot?.byCategory[0].category).toBe("food");
    });

    it("breaks ties by category so the order never flickers", () => {
      const first = summarize([
        expense(100, "2026-07-02", "food"),
        expense(100, "2026-07-03", "housing"),
      ]);
      const reversed = summarize([
        expense(100, "2026-07-03", "housing"),
        expense(100, "2026-07-02", "food"),
      ]);

      expect(first?.byCategory.map((entry) => entry.category)).toEqual(
        reversed?.byCategory.map((entry) => entry.category),
      );
    });

    it("is empty for a month of pure income", () => {
      const snapshot = summarize([income(1000, "2026-07-01")]);

      expect(snapshot?.byCategory).toEqual([]);
    });
  });

  describe("highlights", () => {
    it("reports the drop against the previous month", () => {
      const snapshot = summarize([
        expense(1000, "2026-06-10"),
        expense(920, "2026-07-10"),
      ]);

      expect(texts(snapshot)).toContain("Spending is down 8% vs. last month.");
    });

    it("reports a rise too", () => {
      const snapshot = summarize([
        expense(1000, "2026-06-10"),
        expense(1100, "2026-07-10"),
      ]);

      expect(texts(snapshot)).toContain("Spending is up 10% vs. last month.");
    });

    it("crosses the year boundary when comparing months", () => {
      const snapshot = summarize([
        expense(1000, "2025-12-10"),
        expense(900, "2026-01-10"),
      ]);

      expect(texts(snapshot)).toContain("Spending is down 10% vs. last month.");
    });

    it("says nothing about last month when there is no last month", () => {
      const snapshot = summarize([expense(900, "2026-07-10")]);

      expect(
        texts(snapshot).some((line) => line.includes("last month")),
      ).toBe(false);
    });

    it("names the top category with its share of spending", () => {
      const snapshot = summarize([
        expense(380, "2026-07-02", "housing"),
        expense(620, "2026-07-03", "food"),
      ]);

      expect(texts(snapshot)).toContain("Food & dining is your top category at 62%.");
    });

    it("reports what the subscriptions cost once there are at least two", () => {
      // Reframed from the design's "2 subscriptions overlap": nothing in a
      // transaction list can prove two services duplicate each other.
      const snapshot = summarize([
        expense(180, "2026-07-02", "subscriptions"),
        expense(130, "2026-07-03", "subscriptions"),
      ]);

      expect(texts(snapshot)).toContain("2 subscriptions cost $310 a month.");
    });

    it("stays quiet about a single subscription", () => {
      const snapshot = summarize([
        expense(180, "2026-07-02", "subscriptions"),
      ]);

      expect(
        texts(snapshot).some((line) => line.includes("subscription")),
      ).toBe(false);
    });

    it("never invents a claim it cannot derive", () => {
      const snapshot = summarize([expense(100, "2026-07-02", "food")]);

      for (const line of texts(snapshot)) {
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toContain("undefined");
        expect(line).not.toContain("NaN");
      }
    });
  });
});
