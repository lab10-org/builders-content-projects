import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_TYPE,
  REGISTRATION_CATEGORIES,
  categoryBucket,
  categoryFromLabel,
  categoryLabel,
  createTransaction,
  isCategory,
  isCurrency,
  isTransactionType,
} from "./transaction";

const VALID_INPUT = {
  amount: 25000,
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "food",
};

describe("CATEGORIES", () => {
  it("keeps the six registration categories first, in requirement 2.1's order", () => {
    // 2.1 fixes the order the Spanish form shows, so the canonical list leads
    // with them and appends anything the onboarding needs.
    expect(CATEGORIES.slice(0, 6).map((category) => category.es)).toEqual([
      "Comida",
      "Transporte",
      "Vivienda",
      "Ocio",
      "Salud",
      "Otros",
    ]);
  });

  it("adds subscriptions for the onboarding's spending breakdown", () => {
    expect(CATEGORIES.map((category) => category.value)).toContain(
      "subscriptions",
    );
  });

  it("gives every category a distinct canonical value", () => {
    const values = CATEGORIES.map((category) => category.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("labels every category in both languages", () => {
    for (const category of CATEGORIES) {
      expect(category.es.length).toBeGreaterThan(0);
      expect(category.en.length).toBeGreaterThan(0);
    }
  });

  it("files every category under needs or wants for the plan", () => {
    for (const category of CATEGORIES) {
      expect(["needs", "wants"]).toContain(category.bucket);
    }
  });

  it("stores canonical values that carry no language", () => {
    // The point of the refactor: nothing Spanish or English ends up in storage.
    for (const category of CATEGORIES) {
      expect(category.value).toMatch(/^[a-z-]+$/);
    }
  });
});

describe("REGISTRATION_CATEGORIES [2.1]", () => {
  it("is exactly the six the Spanish form may offer, in order", () => {
    expect([...REGISTRATION_CATEGORIES]).toEqual([
      "food",
      "transport",
      "housing",
      "leisure",
      "health",
      "other",
    ]);
  });

  it("excludes the onboarding-only category", () => {
    expect([...REGISTRATION_CATEGORIES]).not.toContain("subscriptions");
  });

  it("maps to requirement 2.1's Spanish names, in order", () => {
    expect(
      REGISTRATION_CATEGORIES.map((value) => categoryLabel(value, "es")),
    ).toEqual(["Comida", "Transporte", "Vivienda", "Ocio", "Salud", "Otros"]);
  });
});

describe("categoryLabel", () => {
  it("renders Spanish for the / screen", () => {
    expect(categoryLabel("housing", "es")).toBe("Vivienda");
  });

  it("renders English for the onboarding screens", () => {
    expect(categoryLabel("housing", "en")).toBe("Housing");
  });

  it("uses the design's wording for the food category", () => {
    expect(categoryLabel("food", "en")).toBe("Food & dining");
  });
});

describe("categoryBucket", () => {
  it("counts housing as a need", () => {
    expect(categoryBucket("housing")).toBe("needs");
  });

  it("counts subscriptions as a want", () => {
    expect(categoryBucket("subscriptions")).toBe("wants");
  });
});

describe("categoryFromLabel", () => {
  it("accepts a canonical value unchanged", () => {
    expect(categoryFromLabel("food")).toBe("food");
  });

  it("accepts a legacy Spanish label, so stored data can be migrated", () => {
    expect(categoryFromLabel("Comida")).toBe("food");
  });

  it("accepts an English label", () => {
    expect(categoryFromLabel("Food & dining")).toBe("food");
  });

  it("ignores case and surrounding whitespace", () => {
    expect(categoryFromLabel("  vIvIeNdA  ")).toBe("housing");
  });

  it.each([
    ["an unknown label", "Mascotas"],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a non-string", 42],
    ["null", null],
    ["undefined", undefined],
  ])("returns null for %s", (_case, raw) => {
    expect(categoryFromLabel(raw)).toBeNull();
  });
});

describe("isCategory", () => {
  it("accepts every canonical value", () => {
    for (const category of CATEGORIES) {
      expect(isCategory(category.value)).toBe(true);
    }
  });

  it("rejects a display label — only canonical values are stored", () => {
    expect(isCategory("Comida")).toBe(false);
    expect(isCategory("Food & dining")).toBe(false);
  });

  it("rejects anything off the list, including non-strings", () => {
    expect(isCategory("pets")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory("FOOD")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(42)).toBe(false);
    expect(isCategory({ category: "food" })).toBe(false);
  });
});

describe("isTransactionType", () => {
  it("accepts the two types", () => {
    expect(isTransactionType("expense")).toBe(true);
    expect(isTransactionType("income")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["Expense", "", "transfer", null, 1]) {
      expect(isTransactionType(value)).toBe(false);
    }
  });
});

describe("isCurrency", () => {
  it("accepts every supported currency", () => {
    for (const currency of CURRENCIES) {
      expect(isCurrency(currency)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["usd", "", "BTC", null, 1]) {
      expect(isCurrency(value)).toBe(false);
    }
  });
});

describe("createTransaction — valid input", () => {
  it("returns a normalized transaction with the given values [1.1, 1.7]", () => {
    const result = createTransaction(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(typeof result.transaction.id).toBe("string");
    expect(result.transaction.id.length).toBeGreaterThan(0);
    expect(result.transaction.amount).toBe(25000);
    expect(result.transaction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.transaction.description).toBe("Almuerzo con cliente");
    expect(result.transaction.category).toBe("food");
  });

  it("gives every transaction a distinct id [1.1]", () => {
    const first = createTransaction(VALID_INPUT);
    const second = createTransaction(VALID_INPUT);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.transaction.id).not.toBe(second.transaction.id);
  });

  it("trims the description before storing it [1.1]", () => {
    const result = createTransaction({ ...VALID_INPUT, description: "  Café  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.description).toBe("Café");
  });

  it("stores a numeric-string amount as a number [1.7]", () => {
    const result = createTransaction({ ...VALID_INPUT, amount: "25000" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.amount).toBe(25000);
    expect(typeof result.transaction.amount).toBe("number");
  });

  it("keeps the amount positive for income too — the sign lives in the type", () => {
    const result = createTransaction({
      ...VALID_INPUT,
      type: "income",
      amount: 1200,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.amount).toBe(1200);
    expect(result.transaction.type).toBe("income");
  });
});

/** Field names of the errors of a rejected result, for set-wise assertions. */
function errorFields(result: ReturnType<typeof createTransaction>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.field);
}

describe("createTransaction — type", () => {
  it("defaults to expense, so the registration form need not send one", () => {
    const result = createTransaction(VALID_INPUT);

    expect(result.ok && result.transaction.type).toBe(DEFAULT_TYPE);
    expect(DEFAULT_TYPE).toBe("expense");
  });

  it("accepts an explicit income", () => {
    const result = createTransaction({ ...VALID_INPUT, type: "income" });

    expect(result.ok && result.transaction.type).toBe("income");
  });

  it.each([
    ["a wrong string", "transfer"],
    ["a case variant", "Expense"],
    ["null", null],
    ["a number", 1],
  ])("rejects %s rather than falling back to the default", (_case, type) => {
    // Absent means "use the default"; present-but-invalid is a bug worth
    // surfacing, not something to swallow.
    expect(errorFields(createTransaction({ ...VALID_INPUT, type }))).toContain(
      "type",
    );
  });
});

describe("createTransaction — currency", () => {
  it("defaults to USD", () => {
    const result = createTransaction(VALID_INPUT);

    expect(result.ok && result.transaction.currency).toBe(DEFAULT_CURRENCY);
    expect(DEFAULT_CURRENCY).toBe("USD");
  });

  it("accepts a supported currency", () => {
    const result = createTransaction({ ...VALID_INPUT, currency: "EUR" });

    expect(result.ok && result.transaction.currency).toBe("EUR");
  });

  it.each([
    ["an unsupported code", "BTC"],
    ["a case variant", "usd"],
    ["null", null],
  ])("rejects %s", (_case, currency) => {
    expect(
      errorFields(createTransaction({ ...VALID_INPUT, currency })),
    ).toContain("currency");
  });
});

describe("createTransaction — amount validation [1.2]", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["not a number", "abc"],
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["zero", 0],
    ["zero as a string", "0"],
    ["negative", -5],
    ["negative as a string", "-5"],
    ["a boolean", true],
  ])("rejects an amount that is %s", (_label, amount) => {
    const result = createTransaction({ ...VALID_INPUT, amount });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("amount");
  });
});

describe("createTransaction — description validation [1.3]", () => {
  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["missing", undefined],
    ["null", null],
    ["not a string", 42],
  ])("rejects a description that is %s", (_label, description) => {
    const result = createTransaction({ ...VALID_INPUT, description });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("description");
  });
});

describe("createTransaction — date validation [1.4]", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["not a date", "hola"],
    ["empty", ""],
    ["a non-existent calendar day", "2026-02-30"],
    ["February 30 in a leap year", "2024-02-30"],
    ["month 13", "2026-13-01"],
    ["day 0", "2026-07-00"],
    ["a 2-digit year silently mapped to 1926", "26-7-2"],
    ["not a string", 20260702],
  ])("rejects a date that is %s", (_label, date) => {
    const result = createTransaction({ ...VALID_INPUT, date });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("date");
  });

  it("still requires a date even though the onboarding form has no field", () => {
    // The onboarding passes today's date itself rather than the domain relaxing
    // this, so requirement 1.4 keeps holding for the registration form.
    expect(errorFields(createTransaction({ ...VALID_INPUT, date: "" }))).toEqual(
      ["date"],
    );
  });

  it("still accepts a real leap day", () => {
    const result = createTransaction({ ...VALID_INPUT, date: "2024-2-29" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.date).toBe("2024-02-29");
  });
});

describe("createTransaction — category validation [1.5, 2.3]", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["off the fixed list", "pets"],
    ["a Spanish label rather than a canonical value", "Comida"],
    ["a case variant", "FOOD"],
    ["empty", ""],
    ["not a string", 42],
  ])("rejects a category that is %s", (_label, category) => {
    const result = createTransaction({ ...VALID_INPUT, category });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("category");
  });

  it("accepts every canonical category, including the onboarding-only one", () => {
    for (const category of CATEGORIES) {
      expect(
        createTransaction({ ...VALID_INPUT, category: category.value }).ok,
      ).toBe(true);
    }
  });
});

describe("createTransaction — aggregated errors [1.6]", () => {
  it("reports every invalid field at once, and only those", () => {
    const result = createTransaction({
      amount: -5,
      description: "",
      category: "pets",
      date: "2026-07-02", // the one valid field
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const fields = result.errors.map((error) => error.field);
    expect([...fields].sort()).toEqual(["amount", "category", "description"]);
    expect(fields).not.toContain("date");
    expect(new Set(fields).size).toBe(fields.length); // no duplicate field
    expect(result).not.toHaveProperty("transaction");
  });

  it("gives every error a non-empty message", () => {
    const result = createTransaction({
      amount: undefined,
      description: undefined,
      category: undefined,
      date: undefined,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.length).toBe(4);
    for (const error of result.errors) {
      expect(typeof error.message).toBe("string");
      expect(error.message.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not report type or currency when they are simply absent", () => {
    const result = createTransaction({
      amount: undefined,
      description: undefined,
      category: undefined,
      date: undefined,
    });

    expect(errorFields(result)).not.toContain("type");
    expect(errorFields(result)).not.toContain("currency");
  });

  it("produces no transaction when any field is invalid", () => {
    const result = createTransaction({ ...VALID_INPUT, amount: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.field)).toEqual(["amount"]);
  });
});

describe("createTransaction — date normalization [1.7]", () => {
  it("keeps an already-normalized date verbatim", () => {
    const result = createTransaction({ ...VALID_INPUT, date: "2026-07-02" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.date).toBe("2026-07-02");
  });

  it("normalizes a non-padded date to YYYY-MM-DD", () => {
    const result = createTransaction({ ...VALID_INPUT, date: "2026-7-2" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.date).toBe("2026-07-02");
  });

  it("normalizes a single-digit month with a padded day", () => {
    const result = createTransaction({ ...VALID_INPUT, date: "2026-1-15" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.date).toBe("2026-01-15");
  });

  it("does not shift the day (timezone-independent normalization)", () => {
    const result = createTransaction({ ...VALID_INPUT, date: "2026-1-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.date).toBe("2026-01-01");
  });
});
