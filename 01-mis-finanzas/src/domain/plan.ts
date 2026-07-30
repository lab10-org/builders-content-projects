import type { Snapshot } from "./snapshot";
import type { FinancialProfile, Goal } from "./financialProfile";
import { categoryBucket } from "./transaction";

/**
 * The numbers behind the "Your personalized plan" screen.
 *
 * Everything is derived from the profile the user filled in and the snapshot of
 * their transactions, so the screen responds to real data rather than restating
 * the mockup.
 */

/** Needs, wants and what is left over, in money and as a share of income. */
export interface Allocation {
  income: number;
  needs: number;
  wants: number;
  /** `income - needs - wants`. Negative when the month overspent. */
  savings: number;
}

export interface ProjectedMonth {
  /** `YYYY-MM`. */
  month: string;
  /** Short label for the axis, e.g. "Jul". */
  label: string;
  needs: number;
  wants: number;
  savings: number;
}

/**
 * `reached` matters on its own: with a healthy balance a six-month emergency fund
 * can already be funded, and reporting "1 month to goal" for an achieved goal
 * would be worse than saying nothing.
 */
export type PlanStatus = "reached" | "on-track" | "at-risk";

export interface Plan {
  goal: Goal;
  /** What the goal is worth, in money — see `GOAL_TARGETS` on where it comes from. */
  target: number;
  /** What is already saved. Clamped at zero: a debt is not negative progress here. */
  saved: number;
  /** Money available for the goal each month — the leftover of the allocation. */
  monthlyTarget: number;
  /** `0` when the goal is already funded, `null` when it is unreachable. */
  monthsToGoal: number | null;
  /** e.g. "December 2027". `null` when `monthsToGoal` is. */
  targetDate: string | null;
  status: PlanStatus;
  allocation: Allocation;
  /** Twelve months starting at the snapshot's month. */
  projection: ProjectedMonth[];
  tips: string[];
}

export const PROJECTION_MONTHS = 12;

/**
 * Fraction of discretionary spending the plan moves into savings across the
 * projection, matching the chart's shape in the design: needs stay flat, savings
 * rise and wants ease by the same amount.
 */
const MAX_WANTS_SHIFT = 0.25;

/**
 * How big each goal is, as a multiple of the user's own figures.
 *
 * NOTE: the design shows "Target $15,000" for the emergency fund, but the
 * onboarding never asks how much the goal is worth — so these multiples are
 * **authored heuristics**, not user input. Only `emergency-fund` rests on a
 * conventional rule (six months of essential spending); the other four are
 * placeholders scaled to income so they at least respond to the user's data.
 *
 * The real fix is to collect a target amount in the profile step, which is a spec
 * change rather than a code one.
 */
const GOAL_TARGETS: Record<
  Goal,
  { basis: "needs" | "income"; multiple: number }
> = {
  "emergency-fund": { basis: "needs", multiple: 6 },
  "pay-off-debt": { basis: "income", multiple: 3 },
  "big-purchase": { basis: "income", multiple: 4 },
  "long-term-wealth": { basis: "income", multiple: 12 },
  retirement: { basis: "income", multiple: 24 },
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const FULL_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** `"2026-07"` plus `count` months, still as `YYYY-MM`. */
export function addMonths(month: string, count: number): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + count;
  return `${year + Math.floor(index / 12)}-${String((((index % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}

/** `"2026-07"` → `"Jul"`. Fixed names, so no locale or `Date` is involved. */
export function monthLabel(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1];
}

/** `"2027-12"` → `"December 2027"`. */
export function monthTitle(month: string): string {
  return `${FULL_MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

function bucketTotals(snapshot: Snapshot): { needs: number; wants: number } {
  let needs = 0;
  let wants = 0;

  for (const entry of snapshot.byCategory) {
    if (categoryBucket(entry.category) === "needs") needs += entry.amount;
    else wants += entry.amount;
  }

  return { needs, wants };
}

/**
 * Rounded to whole units so the three parts still add up to income after
 * rounding — savings absorbs the remainder rather than each part rounding
 * independently and the total drifting by a dollar.
 */
function allocate(snapshot: Snapshot): Allocation {
  const { needs, wants } = bucketTotals(snapshot);
  const income = Math.round(snapshot.income);
  const roundedNeeds = Math.round(needs);
  const roundedWants = Math.round(wants);

  return {
    income,
    needs: roundedNeeds,
    wants: roundedWants,
    savings: income - roundedNeeds - roundedWants,
  };
}

/**
 * Twelve months in which needs hold steady while a growing slice of wants moves
 * into savings, linearly, up to `MAX_WANTS_SHIFT` of the starting wants.
 */
function project(month: string, allocation: Allocation): ProjectedMonth[] {
  const months: ProjectedMonth[] = [];

  for (let index = 0; index < PROJECTION_MONTHS; index += 1) {
    // Divided by length-1 so the last month lands exactly on the full shift.
    const progress = index / (PROJECTION_MONTHS - 1);
    const moved = Math.round(allocation.wants * MAX_WANTS_SHIFT * progress);
    const at = addMonths(month, index);

    months.push({
      month: at,
      label: monthLabel(at),
      needs: allocation.needs,
      wants: allocation.wants - moved,
      savings: allocation.savings + moved,
    });
  }

  return months;
}

function buildTips(
  monthlyTarget: number,
  allocation: Allocation,
  reached: boolean,
): string[] {
  const tips: string[] = [];

  if (reached) {
    tips.push(
      `Your goal is fully funded — keep the $${monthlyTarget.toLocaleString("en-US")} a month working toward what is next.`,
    );
  } else if (monthlyTarget > 0) {
    tips.push(
      `Automate a $${monthlyTarget.toLocaleString("en-US")} transfer to savings each payday.`,
    );
  } else {
    tips.push(
      "Your spending currently uses all of your income — free up room before automating a transfer.",
    );
  }

  const shift = Math.round(allocation.wants * MAX_WANTS_SHIFT);
  if (shift > 0) {
    tips.push(
      `Trim discretionary spending by ~$${shift.toLocaleString("en-US")} a month to stay on plan.`,
    );
  }

  // Static copy from the design — no data behind it, and none implied.
  tips.push("We recheck your plan every 6 months and adjust.");

  return tips;
}

export function buildPlan(
  profile: FinancialProfile,
  snapshot: Snapshot,
): Plan {
  const allocation = allocate(snapshot);
  const monthlyTarget = allocation.savings;

  const rule = GOAL_TARGETS[profile.goal];
  const basis = rule.basis === "needs" ? allocation.needs : allocation.income;
  const target = Math.round(basis * rule.multiple);

  // A negative balance is debt, not negative progress towards a savings goal.
  const saved = Math.max(0, Math.round(snapshot.balance));
  const remaining = Math.max(0, target - saved);

  const reached = remaining === 0;

  // Three distinct outcomes, none of them a rounded-up guess:
  // already funded (0), on the way (a real count), or never at this rate (null).
  const monthsToGoal = reached
    ? 0
    : monthlyTarget > 0
      ? Math.max(1, Math.ceil(remaining / monthlyTarget))
      : null;

  return {
    goal: profile.goal,
    target,
    saved,
    monthlyTarget,
    monthsToGoal,
    // No date for a goal that is already funded, and none for one that never
    // arrives — in both cases a month name would be fiction.
    targetDate:
      reached || monthsToGoal === null
        ? null
        : monthTitle(addMonths(snapshot.month, monthsToGoal)),
    status: reached ? "reached" : monthlyTarget > 0 ? "on-track" : "at-risk",
    allocation,
    projection: project(snapshot.month, allocation),
    tips: buildTips(monthlyTarget, allocation, reached),
  };
}
