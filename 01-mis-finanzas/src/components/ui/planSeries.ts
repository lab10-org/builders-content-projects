/**
 * The three tiers of the plan, in stacking order: needs at the base, then wants,
 * with savings on top — the order the design draws them.
 *
 * Colours come from the validated ordinal ramp in `globals.css` (see the note
 * there on why they are not the mockup's values). They are referenced as tokens,
 * never as literals, so the palette has exactly one home.
 */
export const PLAN_SERIES = [
  { key: "needs", label: "Needs", bar: "bg-chart-needs" },
  { key: "wants", label: "Wants", bar: "bg-chart-wants" },
  { key: "savings", label: "Savings", bar: "bg-chart-savings" },
] as const;

export type PlanSeriesKey = (typeof PLAN_SERIES)[number]["key"];

/** Bottom-to-top, which is the reverse of how a flex column lays children out. */
export const STACK_ORDER = ["savings", "wants", "needs"] as const;
