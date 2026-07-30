/**
 * The single transaction model for the whole app.
 *
 * It replaces the former `expense` module. Two screens with different languages
 * write to it — the Spanish `/` registration form and the English onboarding
 * flow — so a category is stored as a **language-neutral canonical value** and
 * carries a label per language. That is what lets one model back both screens
 * without either of them showing the other's language.
 */

export const TRANSACTION_TYPES = ["expense", "income"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * Which third of the plan's allocation a category counts towards. `savings` is
 * deliberately absent: it is what remains of income after needs and wants, not
 * something a transaction can be filed under.
 */
export type Bucket = "needs" | "wants";

/**
 * The first six are, in order, the categories requirement 2.1 of the
 * register-expenses spec pins to the Spanish registration form.
 * `subscriptions` is a seventh, added for the onboarding's "Know me" screen,
 * which breaks it out as its own spending bar.
 */
export const CATEGORIES = [
  { value: "food", es: "Comida", en: "Food & dining", bucket: "needs" },
  { value: "transport", es: "Transporte", en: "Transport", bucket: "needs" },
  { value: "housing", es: "Vivienda", en: "Housing", bucket: "needs" },
  { value: "leisure", es: "Ocio", en: "Leisure", bucket: "wants" },
  { value: "health", es: "Salud", en: "Health", bucket: "needs" },
  { value: "other", es: "Otros", en: "Other", bucket: "wants" },
  {
    value: "subscriptions",
    es: "Suscripciones",
    en: "Subscriptions",
    bucket: "wants",
  },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

export type Language = "es" | "en";

/**
 * The subset the Spanish registration form offers, fixed by requirement 2.1.
 * Listed explicitly rather than sliced, so adding an eighth category cannot
 * silently change what that form offers.
 */
export const REGISTRATION_CATEGORIES = [
  "food",
  "transport",
  "housing",
  "leisure",
  "health",
  "other",
] as const satisfies readonly Category[];

export const CURRENCIES = ["USD", "EUR", "COP"] as const;

export type Currency = (typeof CURRENCIES)[number];

/**
 * What the `/` form recorded before currency existed, and what the onboarding
 * design shows. Applied when the caller supplies none.
 */
export const DEFAULT_CURRENCY: Currency = "USD";

/**
 * The registration form predates income and records only expenses, so it sends
 * no type. Applied when the caller supplies none.
 */
export const DEFAULT_TYPE: TransactionType = "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Always positive. The sign a UI shows comes from `type`, not from here. */
  amount: number;
  currency: Currency;
  date: string; // normalized YYYY-MM-DD
  description: string; // non-empty, trimmed
  category: Category;
}

export interface TransactionInput {
  amount: unknown;
  date: unknown;
  description: unknown;
  category: unknown;
  /** Optional: absent means `DEFAULT_TYPE`. */
  type?: unknown;
  /** Optional: absent means `DEFAULT_CURRENCY`. */
  currency?: unknown;
}

export type ValidationField =
  | "amount"
  | "date"
  | "description"
  | "category"
  | "type"
  | "currency";

export type ValidationError = { field: ValidationField; message: string };

export type CreateTransactionResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; errors: ValidationError[] };

/**
 * Spanish, because these surface on the `/` registration form. The onboarding
 * screens are English and supply their own copy — see `knowMe` messages.
 */
const MESSAGES = {
  amount: "El monto debe ser un número mayor que cero.",
  date: "La fecha debe ser una fecha válida.",
  description: "La descripción no puede estar vacía.",
  category: "Selecciona una categoría de la lista.",
  type: "El tipo debe ser ingreso o gasto.",
  currency: "Selecciona una moneda válida.",
} as const;

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((category) => category.value === value);
}

export function isTransactionType(value: unknown): value is TransactionType {
  return (TRANSACTION_TYPES as readonly unknown[]).includes(value);
}

export function isCurrency(value: unknown): value is Currency {
  return (CURRENCIES as readonly unknown[]).includes(value);
}

function definitionOf(category: Category) {
  // Non-null: `category` is narrowed to a value that exists in the list.
  return CATEGORIES.find((entry) => entry.value === category)!;
}

/** The display name of a category in the given language. */
export function categoryLabel(category: Category, language: Language): string {
  return definitionOf(category)[language];
}

export function categoryBucket(category: Category): Bucket {
  return definitionOf(category).bucket;
}

/**
 * Resolves a Spanish or English label back to its canonical value, so a stored
 * legacy value (categories used to be stored as `"Comida"`) or a model reply
 * given as a label can be understood. Case-insensitive; `null` when unknown.
 */
export function categoryFromLabel(raw: unknown): Category | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw.trim().toLowerCase();
  if (cleaned === "") return null;

  const match = CATEGORIES.find(
    (entry) =>
      entry.value === cleaned ||
      entry.es.toLowerCase() === cleaned ||
      entry.en.toLowerCase() === cleaned,
  );
  return match?.value ?? null;
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

export function createTransaction(
  input: TransactionInput,
): CreateTransactionResult {
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

  // Absent is valid and means the default; present-but-wrong is an error, so a
  // typo is never silently swallowed into "expense"/"USD".
  const type =
    input.type === undefined
      ? DEFAULT_TYPE
      : isTransactionType(input.type)
        ? input.type
        : null;
  if (type === null) errors.push({ field: "type", message: MESSAGES.type });

  const currency =
    input.currency === undefined
      ? DEFAULT_CURRENCY
      : isCurrency(input.currency)
        ? input.currency
        : null;
  if (currency === null) {
    errors.push({ field: "currency", message: MESSAGES.currency });
  }

  if (
    amount === null ||
    date === null ||
    description === null ||
    category === null ||
    type === null ||
    currency === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    transaction: {
      id: crypto.randomUUID(),
      type,
      amount,
      currency,
      date,
      description,
      category,
    },
  };
}
