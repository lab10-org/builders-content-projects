import type { Category, Transaction } from "./transaction";

/**
 * Demo transactions that make the onboarding screens open showing the figures in
 * `docs/mockups/onboarding.pen`: a $48,920 balance, a 23% savings rate, $7,450
 * of monthly income and $5,710 of monthly spending.
 *
 * IMPORTANT: this is scaffolding, never user data. It is held in memory and
 * **never written to storage**, so the `/` expenses screen keeps showing only
 * what the user actually entered. The onboarding screens summarize
 * `[...seed, ...stored]`, which is why adding a transaction moves the figures.
 *
 * Every id is prefixed `seed-` so demo rows stay identifiable at a glance.
 */

interface SeedEntry {
  offsetMonths: number;
  day: number;
  type: "income" | "expense";
  amount: number;
  category: Category;
  description: string;
}

/**
 * The current month reproduces the design's spending mix. `housing` at $2,180 of
 * $5,710 is 38% — the design's "Housing is your top category at 38%" — and the
 * two subscriptions summing to $310 are what its third highlight counts.
 *
 * NOTE: the design's card draws four bars ($2,180 + $960 + $540 + $310 =
 * $3,990) while stating $5,710 of monthly spending, so $1,720 of it is in
 * categories the mockup does not draw. Those categories are seeded here, and the
 * screen lists all of them rather than a top four that silently omits a third of
 * the total.
 */
const CURRENT_MONTH: SeedEntry[] = [
  { offsetMonths: 0, day: 1, type: "income", amount: 7450, category: "other", description: "Salary" },
  { offsetMonths: 0, day: 2, type: "expense", amount: 2180, category: "housing", description: "Rent" },
  { offsetMonths: 0, day: 4, type: "expense", amount: 960, category: "food", description: "Groceries & dining" },
  { offsetMonths: 0, day: 6, type: "expense", amount: 820, category: "leisure", description: "Weekend plans" },
  { offsetMonths: 0, day: 8, type: "expense", amount: 540, category: "transport", description: "Transit & fuel" },
  { offsetMonths: 0, day: 10, type: "expense", amount: 480, category: "health", description: "Clinic & pharmacy" },
  { offsetMonths: 0, day: 12, type: "expense", amount: 420, category: "other", description: "Household" },
  { offsetMonths: 0, day: 14, type: "expense", amount: 180, category: "subscriptions", description: "Streaming bundle" },
  { offsetMonths: 0, day: 15, type: "expense", amount: 130, category: "subscriptions", description: "Cloud storage" },
];

/**
 * Last month, spending $6,207 — chosen so this month reads 8% lower, which is
 * the design's first highlight.
 */
const PREVIOUS_MONTH: SeedEntry[] = [
  { offsetMonths: -1, day: 1, type: "income", amount: 7450, category: "other", description: "Salary" },
  { offsetMonths: -1, day: 2, type: "expense", amount: 2180, category: "housing", description: "Rent" },
  { offsetMonths: -1, day: 4, type: "expense", amount: 1150, category: "food", description: "Groceries & dining" },
  { offsetMonths: -1, day: 6, type: "expense", amount: 1100, category: "leisure", description: "Concert & dining out" },
  { offsetMonths: -1, day: 8, type: "expense", amount: 620, category: "transport", description: "Transit & fuel" },
  { offsetMonths: -1, day: 10, type: "expense", amount: 480, category: "health", description: "Clinic & pharmacy" },
  { offsetMonths: -1, day: 12, type: "expense", amount: 367, category: "other", description: "Household" },
  { offsetMonths: -1, day: 14, type: "expense", amount: 180, category: "subscriptions", description: "Streaming bundle" },
  { offsetMonths: -1, day: 15, type: "expense", amount: 130, category: "subscriptions", description: "Cloud storage" },
];

/**
 * What the accounts already held. Six months back so it never lands in either
 * month's figures — it exists only to make the standing balance add up:
 * $45,937 + ($7,450 − $6,207) + ($7,450 − $5,710) = $48,920.
 */
const OPENING: SeedEntry[] = [
  { offsetMonths: -6, day: 1, type: "income", amount: 45937, category: "other", description: "Opening balance" },
];

const ENTRIES = [...OPENING, ...PREVIOUS_MONTH, ...CURRENT_MONTH];

/** Shifts a `YYYY-MM` by whole months. */
function shiftMonth(month: string, by: number): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + by;
  return `${year + Math.floor(index / 12)}-${String((((index % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}

/**
 * Builds the demo list relative to `today` (a `YYYY-MM-DD` date), so the seeded
 * "current month" is always the month the user is actually in and a transaction
 * they add lands in the same window.
 *
 * `today` is injected rather than read from the clock so this stays pure and the
 * tests are not time-dependent.
 */
export function buildSeedTransactions(today: string): Transaction[] {
  const month = today.slice(0, 7);

  return ENTRIES.map((entry, index) => ({
    id: `seed-${index}`,
    type: entry.type,
    amount: entry.amount,
    currency: "USD" as const,
    date: `${shiftMonth(month, entry.offsetMonths)}-${String(entry.day).padStart(2, "0")}`,
    description: entry.description,
    category: entry.category,
  }));
}

/** Whether a transaction came from this module rather than from the user. */
export function isSeeded(transaction: Transaction): boolean {
  return transaction.id.startsWith("seed-");
}
