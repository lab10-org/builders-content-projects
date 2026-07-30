import {
  DEFAULT_CURRENCY,
  DEFAULT_TYPE,
  type Transaction,
  categoryFromLabel,
  isCurrency,
  isTransactionType,
} from "../domain/transaction";

/** Where the unified transaction list lives. */
export const TRANSACTIONS_KEY = "mis-finanzas:transactions";

/**
 * The key the app used while the model was `Expense`. Entries there have no
 * `type` or `currency` and store the category as its Spanish label
 * (`"Comida"`), so they are migrated on read rather than discarded — a user who
 * registered expenses before this refactor must not lose them.
 */
export const LEGACY_EXPENSES_KEY = "mis-finanzas:expenses";

/**
 * Rebuilds one stored record into a `Transaction`, filling in what the legacy
 * shape lacked and translating a legacy Spanish category to its canonical
 * value. Returns `null` for anything that cannot be salvaged.
 *
 * Everything read back from storage is untrusted: it may predate a shape
 * change, or have been edited by hand.
 */
function toTransaction(value: unknown): Transaction | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.amount !== "number") return null;
  if (!Number.isFinite(candidate.amount) || candidate.amount <= 0) return null;
  if (typeof candidate.date !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) return null;
  if (typeof candidate.description !== "string") return null;
  if (candidate.description.length === 0) return null;

  // Accepts a canonical value or a legacy label — this is the migration.
  const category = categoryFromLabel(candidate.category);
  if (category === null) return null;

  // Absent means a legacy record; present-but-wrong means a corrupt one, which
  // is dropped rather than silently coerced to the default.
  const type =
    candidate.type === undefined ? DEFAULT_TYPE : candidate.type;
  if (!isTransactionType(type)) return null;

  const currency =
    candidate.currency === undefined ? DEFAULT_CURRENCY : candidate.currency;
  if (!isCurrency(currency)) return null;

  return {
    id: candidate.id,
    type,
    amount: candidate.amount,
    currency,
    date: candidate.date,
    description: candidate.description,
    category,
  };
}

/** Parses one key's contents, dropping entries that fail the shape check. */
function readKey(key: string): Transaction[] | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(toTransaction)
    .filter((entry): entry is Transaction => entry !== null);
}

/**
 * Reads the stored list, tolerating every failure mode: absent key, malformed
 * JSON, a non-array payload, or individual malformed entries. Never throws (4.5).
 *
 * Falls back to the legacy key only when the current one is absent, so once the
 * app has written once, the old data stops being consulted.
 *
 * `localStorage` is touched only inside these functions — never at module scope
 * — so importing this during server rendering cannot crash.
 */
export function loadTransactions(): Transaction[] {
  try {
    return readKey(TRANSACTIONS_KEY) ?? readKey(LEGACY_EXPENSES_KEY) ?? [];
  } catch {
    return [];
  }
}

/**
 * Writes the whole list. A quota or serialization failure is deliberately **not**
 * caught: the caller surfaces it to the user while keeping the entered values
 * (4.6).
 *
 * The legacy key is dropped only *after* the write succeeds, so a failed write
 * cannot destroy the pre-refactor data that is still the only copy.
 */
export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  localStorage.removeItem(LEGACY_EXPENSES_KEY);
}
