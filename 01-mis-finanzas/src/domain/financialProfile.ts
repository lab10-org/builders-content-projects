/**
 * The onboarding profile questions, transcribed from the "2 · Financial Profile"
 * frame. Order is load-bearing: it is the order the screen renders, and the
 * order `validateProfile` normalizes selections into.
 */
export const GOALS = [
  { value: "emergency-fund", label: "Build an emergency fund" },
  { value: "pay-off-debt", label: "Pay off debt" },
  { value: "big-purchase", label: "Save for a big purchase" },
  { value: "long-term-wealth", label: "Grow long-term wealth" },
  { value: "retirement", label: "Prepare for retirement" },
] as const;

/**
 * NOTE: only the "Balanced" descriptor exists in the mockup — it is the level
 * shown selected. The other two are written here to match its voice and shape
 * ("<Level> — <what it trades for what>"), and should be reviewed by whoever
 * owns the copy.
 */
export const RISK_LEVELS = [
  {
    value: "conservative",
    label: "Conservative",
    descriptor:
      "Conservative — steadier value with smaller swings, trading some long-term growth for peace of mind.",
  },
  {
    value: "balanced",
    label: "Balanced",
    descriptor:
      "Balanced — a mix of growth and stability, accepting moderate ups and downs for steady long-term returns.",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    descriptor:
      "Aggressive — the most long-term growth potential, accepting large swings along the way.",
  },
] as const;

export const INCOME_SOURCES = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business" },
  { value: "investments", label: "Investments" },
  { value: "rental", label: "Rental" },
  { value: "other", label: "Other" },
] as const;

export type Goal = (typeof GOALS)[number]["value"];
export type RiskLevel = (typeof RISK_LEVELS)[number]["value"];
export type IncomeSource = (typeof INCOME_SOURCES)[number]["value"];

export interface FinancialProfile {
  goal: Goal;
  riskTolerance: RiskLevel;
  /** At least one, always in `INCOME_SOURCES` order, never duplicated. */
  incomeSources: IncomeSource[];
}

export interface FinancialProfileInput {
  goal: unknown;
  riskTolerance: unknown;
  incomeSources: unknown;
}

export type ProfileField = keyof FinancialProfileInput;

export type ProfileError = { field: ProfileField; message: string };

export type ValidateProfileResult =
  | { ok: true; profile: FinancialProfile }
  | { ok: false; errors: ProfileError[] };

/** English, to match the screen's copy — see the note in `credentials.ts`. */
const MESSAGES = {
  goal: "Choose the goal that fits you best.",
  riskTolerance: "Choose your risk tolerance.",
  incomeSources: "Select at least one income source.",
} as const;

export function isGoal(value: unknown): value is Goal {
  return GOALS.some((goal) => goal.value === value);
}

export function isRiskLevel(value: unknown): value is RiskLevel {
  return RISK_LEVELS.some((level) => level.value === value);
}

export function isIncomeSource(value: unknown): value is IncomeSource {
  return INCOME_SOURCES.some((source) => source.value === value);
}

/** The sentence shown under the segmented control, for the selected level. */
export function describeRisk(level: RiskLevel): string {
  // Non-null: `level` is narrowed to a value that exists in the list.
  return RISK_LEVELS.find((entry) => entry.value === level)!.descriptor;
}

/**
 * Derived by filtering `INCOME_SOURCES` rather than filtering the input, which
 * deduplicates and reorders in one step: two users who picked the same sources
 * in a different order must produce byte-identical profiles.
 */
function toIncomeSources(value: unknown): IncomeSource[] | null {
  if (!Array.isArray(value)) return null;

  const chosen = INCOME_SOURCES.filter((source) =>
    value.includes(source.value),
  ).map((source) => source.value);

  return chosen.length > 0 ? chosen : null;
}

export function validateProfile(
  input: FinancialProfileInput,
): ValidateProfileResult {
  const errors: ProfileError[] = [];

  const goal = isGoal(input.goal) ? input.goal : null;
  if (goal === null) errors.push({ field: "goal", message: MESSAGES.goal });

  const riskTolerance = isRiskLevel(input.riskTolerance)
    ? input.riskTolerance
    : null;
  if (riskTolerance === null) {
    errors.push({ field: "riskTolerance", message: MESSAGES.riskTolerance });
  }

  const incomeSources = toIncomeSources(input.incomeSources);
  if (incomeSources === null) {
    errors.push({ field: "incomeSources", message: MESSAGES.incomeSources });
  }

  // Null-checks rather than `errors.length`: this is what narrows the three
  // values for the returned profile.
  if (goal === null || riskTolerance === null || incomeSources === null) {
    return { ok: false, errors };
  }

  return { ok: true, profile: { goal, riskTolerance, incomeSources } };
}
