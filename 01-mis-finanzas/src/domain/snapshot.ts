import {
  type Category,
  type Transaction,
  categoryLabel,
} from "./transaction";

/**
 * The figures behind the "Your financial snapshot" tile.
 *
 * Everything here is derived from the transaction list — nothing is a constant
 * lifted from the mockup. The seeded demo data is what makes the screen open
 * showing the designed numbers; change the data and these move.
 */

export interface CategorySpending {
  category: Category;
  amount: number;
  /** Share of the month's total spending, 0..1. */
  share: number;
}

/**
 * What a highlight is *about*, so the UI can pick the icon the design assigns it:
 * a trend arrow, a composition glyph, or a warning.
 */
export type HighlightKind = "trend" | "composition" | "warning";

export interface Highlight {
  kind: HighlightKind;
  text: string;
}

export interface Snapshot {
  /** Income minus expenses across every transaction, not just the month. */
  balance: number;
  /** The month these figures describe, as `YYYY-MM`. */
  month: string;
  income: number;
  spending: number;
  /**
   * `(income - spending) / income`. Not clamped: spending more than you earned
   * is a real state, and hiding it behind a 0% would be a lie.
   */
  savingsRate: number;
  /** Expenses of `month`, largest first. Every category, not just the top few. */
  byCategory: CategorySpending[];
  highlights: Highlight[];
}

/** The `YYYY-MM` prefix of a normalized `YYYY-MM-DD` date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The month immediately before `YYYY-MM`, handling the January rollover. */
function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return index === 1
    ? `${year - 1}-12`
    : `${year}-${String(index - 1).padStart(2, "0")}`;
}

function sum(transactions: readonly Transaction[]): number {
  return transactions.reduce((total, entry) => total + entry.amount, 0);
}

function spendingIn(
  transactions: readonly Transaction[],
  month: string,
): Transaction[] {
  return transactions.filter(
    (entry) => entry.type === "expense" && monthOf(entry.date) === month,
  );
}

/**
 * Rounded to whole units, because that is how every figure in the design reads
 * ("$5,710", "38%") and because carrying cents into a percentage only produces
 * a number nobody checks.
 */
function percent(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * The three sentences under "Highlights", each derived from the data.
 *
 * NOTE: the design's third highlight reads "2 subscriptions overlap — possible
 * savings", which asserts that two services *duplicate each other*. Nothing in a
 * transaction list can establish that, so it is reframed as what the data does
 * support: how many subscriptions there are and what they cost. Detecting real
 * overlap would need to know what each service is.
 */
function buildHighlights(
  transactions: readonly Transaction[],
  month: string,
  spending: number,
  byCategory: readonly CategorySpending[],
): Highlight[] {
  const highlights: Highlight[] = [];

  const previous = sum(spendingIn(transactions, previousMonth(month)));
  if (previous > 0) {
    const change = percent(Math.abs(spending - previous) / previous);
    if (change > 0) {
      const direction = spending < previous ? "down" : "up";
      highlights.push({
        kind: "trend",
        text: `Spending is ${direction} ${change}% vs. last month.`,
      });
    } else {
      highlights.push({ kind: "trend", text: "Spending is flat vs. last month." });
    }
  }

  const top = byCategory[0];
  if (top !== undefined) {
    highlights.push({
      kind: "composition",
      text: `${categoryLabel(top.category, "en")} is your top category at ${percent(
        top.share,
      )}%.`,
    });
  }

  const subscriptions = spendingIn(transactions, month).filter(
    (entry) => entry.category === "subscriptions",
  );
  if (subscriptions.length >= 2) {
    highlights.push({
      kind: "warning",
      text: `${subscriptions.length} subscriptions cost $${sum(
        subscriptions,
      ).toLocaleString("en-US")} a month.`,
    });
  }

  return highlights;
}

/**
 * Summarizes a transaction list, or returns `null` when there is nothing to
 * summarize — the caller shows an empty state rather than a wall of zeros.
 *
 * The month described is the **most recent one with data**, so the tile always
 * reflects the latest activity and a newly added transaction is included in it.
 */
export function summarize(transactions: readonly Transaction[]): Snapshot | null {
  if (transactions.length === 0) return null;

  // Max rather than sort: the list is only needed for its latest month.
  const month = transactions.reduce(
    (latest, entry) =>
      monthOf(entry.date) > latest ? monthOf(entry.date) : latest,
    monthOf(transactions[0].date),
  );

  const allIncome = transactions.filter((entry) => entry.type === "income");
  const allExpenses = transactions.filter((entry) => entry.type === "expense");
  const balance = sum(allIncome) - sum(allExpenses);

  const income = sum(
    allIncome.filter((entry) => monthOf(entry.date) === month),
  );
  const monthExpenses = spendingIn(transactions, month);
  const spending = sum(monthExpenses);

  const totals = new Map<Category, number>();
  for (const entry of monthExpenses) {
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
  }

  const byCategory: CategorySpending[] = [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      // Guarded: a month of only income has no spending to take a share of.
      share: spending > 0 ? amount / spending : 0,
      amount,
    }))
    // Ties broken by category name so the order is stable across renders.
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  return {
    balance,
    month,
    income,
    spending,
    savingsRate: income > 0 ? (income - spending) / income : 0,
    byCategory,
    highlights: buildHighlights(transactions, month, spending, byCategory),
  };
}
