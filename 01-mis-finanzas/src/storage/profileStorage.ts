import {
  type FinancialProfile,
  validateProfile,
} from "../domain/financialProfile";

/** Matches the key scheme of `expenseStorage` and `sessionStorage`. */
export const PROFILE_KEY = "mis-finanzas:financial-profile";

/**
 * Reads the stored profile, tolerating every failure mode: absent key, malformed
 * JSON, a non-object payload, or values that are no longer on the option lists.
 * Never throws (a corrupt entry reads as "not answered yet").
 *
 * Validation is reused rather than reimplemented as a type guard: the rules for
 * what makes a profile valid must not be able to drift between the form and
 * storage. It also rebuilds the object, so fields from an older shape are
 * dropped instead of riding along.
 *
 * `localStorage` is touched only inside these functions, never at module scope,
 * so importing this during server rendering cannot crash.
 */
export function loadProfile(): FinancialProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    const result = validateProfile({
      goal: candidate.goal,
      riskTolerance: candidate.riskTolerance,
      incomeSources: candidate.incomeSources,
    });

    return result.ok ? result.profile : null;
  } catch {
    return null;
  }
}

/**
 * A quota or serialization failure is deliberately not caught — the caller
 * surfaces it while keeping the user on the form, as `saveExpenses` does.
 */
export function saveProfile(profile: FinancialProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
