import { type Expense, isCategory } from "../domain/expense";

/**
 * The single `localStorage` key holding the whole expense list as a JSON array.
 * Exported so the UI tests assert against the constant instead of duplicating
 * the literal.
 */
export const STORAGE_KEY = "mis-finanzas:expenses";

/**
 * Anything read back from storage is untrusted: it may predate a shape change,
 * or have been edited by hand. Entries failing this check are dropped rather
 * than surfacing as a corrupt `Expense` (4.5).
 */
function isExpense(value: unknown): value is Expense {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.amount === "number" &&
    Number.isFinite(candidate.amount) &&
    candidate.amount > 0 &&
    typeof candidate.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.date) &&
    typeof candidate.description === "string" &&
    candidate.description.length > 0 &&
    isCategory(candidate.category)
  );
}

/**
 * Reads the stored list, tolerating every failure mode: absent key, malformed
 * JSON, a non-array payload, or individual malformed entries. Never throws (4.5).
 *
 * `localStorage` is touched only inside this function — never at module scope —
 * so importing the module during server rendering cannot crash. It is reached
 * through the bare global rather than `window.localStorage`, which is
 * `undefined` outside a browser.
 */
export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isExpense);
  } catch {
    return [];
  }
}

/**
 * Writes the whole list. A quota or serialization failure is deliberately **not**
 * caught: the caller surfaces it to the user while keeping the entered values
 * (4.6).
 */
export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}
