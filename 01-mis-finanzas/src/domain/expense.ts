export const CATEGORIES = [
  "Comida",
  "Transporte",
  "Vivienda",
  "Ocio",
  "Salud",
  "Otros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string;
  amount: number; // positive
  date: string; // normalized YYYY-MM-DD
  description: string; // non-empty, trimmed
  category: Category;
}

export interface ExpenseInput {
  amount: unknown;
  date: unknown;
  description: unknown;
  category: unknown;
}

export type ValidationError = { field: keyof ExpenseInput; message: string };

export type CreateExpenseResult =
  | { ok: true; expense: Expense }
  | { ok: false; errors: ValidationError[] };

const MESSAGES = {
  amount: "El monto debe ser un número mayor que cero.",
  date: "La fecha debe ser una fecha válida.",
  description: "La descripción no puede estar vacía.",
  category: "Selecciona una categoría de la lista.",
} as const;

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" && (CATEGORIES as readonly string[]).includes(value)
  );
}

/** Parsed calendar parts of a `YYYY-MM-DD`-shaped string, before validation. */
type DateParts = { year: number; month: number; day: number };

function parseDateParts(value: unknown): DateParts | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (match === null) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * The single date path of this module: rebuilds the parts through `Date.UTC`
 * and reads them back with the **UTC** getters, so the result never shifts a
 * day in a negative-offset timezone.
 *
 * Rejects anything whose normalized form no longer describes the day that was
 * asked for. `Date` silently rolls over (`2026-02-30` → `2026-03-02`,
 * `2026-13-01` → `2027-01-01`, `2026-07-00` → `2026-06-30`) and maps a 2-digit
 * year to 1900+year (`26` → `1926`), so the round-trip comparison below is what
 * turns all of those into a date validation error. Parts are compared
 * **numerically**, so `"2026-7-2"` is normalized rather than rejected for a
 * `"7"` vs `"07"` string mismatch.
 */
function normalizeDate(value: unknown): string | null {
  const parts = parseDateParts(value);
  if (parts === null) return null;

  const timestamp = Date.UTC(parts.year, parts.month - 1, parts.day);
  if (!Number.isFinite(timestamp)) return null;

  const utc = new Date(timestamp);
  if (
    utc.getUTCFullYear() !== parts.year ||
    utc.getUTCMonth() + 1 !== parts.month ||
    utc.getUTCDate() !== parts.day
  ) {
    return null;
  }

  const year = String(utc.getUTCFullYear()).padStart(4, "0");
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * `Number("")` and `Number("  ")` are `0`, and `Number(null)` is `0` too, so a
 * missing amount has to be rejected on its type/emptiness before it can be
 * coerced into a silently valid-looking zero.
 */
function toAmount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** `description` is typed `unknown`, so guard the type before `.trim()`. */
function toDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createExpense(input: ExpenseInput): CreateExpenseResult {
  const errors: ValidationError[] = [];

  const amount = toAmount(input.amount);
  if (amount === null) errors.push({ field: "amount", message: MESSAGES.amount });

  const date = normalizeDate(input.date);
  if (date === null) errors.push({ field: "date", message: MESSAGES.date });

  const description = toDescription(input.description);
  if (description === null) {
    errors.push({ field: "description", message: MESSAGES.description });
  }

  const category = isCategory(input.category) ? input.category : null;
  if (category === null) {
    errors.push({ field: "category", message: MESSAGES.category });
  }

  if (
    amount === null ||
    date === null ||
    description === null ||
    category === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    expense: { id: crypto.randomUUID(), amount, date, description, category },
  };
}
