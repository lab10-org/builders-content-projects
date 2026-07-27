import { describe, expect, it } from "vitest";

import { CATEGORIES, createExpense, isCategory } from "./expense";

const VALID_INPUT = {
  amount: 25000,
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "Comida",
};

describe("CATEGORIES", () => {
  it("is exactly the six fixed values, in order [2.1]", () => {
    expect([...CATEGORIES]).toEqual([
      "Comida",
      "Transporte",
      "Vivienda",
      "Ocio",
      "Salud",
      "Otros",
    ]);
  });
});

describe("isCategory", () => {
  it("accepts every value of the fixed list", () => {
    for (const category of CATEGORIES) {
      expect(isCategory(category)).toBe(true);
    }
  });

  it("rejects anything off the list, including non-strings", () => {
    expect(isCategory("Mascotas")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory("comida")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(42)).toBe(false);
    expect(isCategory({ category: "Comida" })).toBe(false);
  });
});

describe("createExpense — valid input", () => {
  it("returns a normalized expense with the given values [1.1, 1.7]", () => {
    const result = createExpense(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(typeof result.expense.id).toBe("string");
    expect(result.expense.id.length).toBeGreaterThan(0);
    expect(result.expense.amount).toBe(25000);
    expect(result.expense.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.expense.description).toBe("Almuerzo con cliente");
    expect(result.expense.category).toBe("Comida");
  });

  it("gives every expense a distinct id [1.1]", () => {
    const first = createExpense(VALID_INPUT);
    const second = createExpense(VALID_INPUT);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.expense.id).not.toBe(second.expense.id);
  });

  it("trims the description before storing it [1.1]", () => {
    const result = createExpense({ ...VALID_INPUT, description: "  Café  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.description).toBe("Café");
  });

  it("stores a numeric-string amount as a number [1.7]", () => {
    const result = createExpense({ ...VALID_INPUT, amount: "25000" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.amount).toBe(25000);
    expect(typeof result.expense.amount).toBe("number");
  });
});

/** Field names of the errors of a rejected result, for set-wise assertions. */
function errorFields(result: ReturnType<typeof createExpense>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.field);
}

describe("createExpense — amount validation [1.2]", () => {
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
    const result = createExpense({ ...VALID_INPUT, amount });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("amount");
  });
});

describe("createExpense — description validation [1.3]", () => {
  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["missing", undefined],
    ["null", null],
    ["not a string", 42],
  ])("rejects a description that is %s", (_label, description) => {
    const result = createExpense({ ...VALID_INPUT, description });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("description");
  });
});

describe("createExpense — date validation [1.4]", () => {
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
    const result = createExpense({ ...VALID_INPUT, date });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("date");
  });

  it("still accepts a real leap day", () => {
    const result = createExpense({ ...VALID_INPUT, date: "2024-2-29" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.date).toBe("2024-02-29");
  });
});

describe("createExpense — category validation [1.5, 2.3]", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["off the fixed list", "Mascotas"],
    ["a case variant", "comida"],
    ["empty", ""],
    ["not a string", 42],
  ])("rejects a category that is %s", (_label, category) => {
    const result = createExpense({ ...VALID_INPUT, category });

    expect(result.ok).toBe(false);
    expect(errorFields(result)).toContain("category");
  });
});

describe("createExpense — aggregated errors [1.6]", () => {
  it("reports every invalid field at once, and only those", () => {
    const result = createExpense({
      amount: -5,
      description: "",
      category: "Mascotas",
      date: "2026-07-02", // the one valid field
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const fields = result.errors.map((error) => error.field);
    expect([...fields].sort()).toEqual(["amount", "category", "description"]);
    expect(fields).not.toContain("date");
    expect(new Set(fields).size).toBe(fields.length); // no duplicate field
    expect(result).not.toHaveProperty("expense");
  });

  it("gives every error a non-empty message", () => {
    const result = createExpense({
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

  it("produces no expense when any field is invalid", () => {
    const result = createExpense({ ...VALID_INPUT, amount: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.field)).toEqual(["amount"]);
  });
});

describe("createExpense — date normalization [1.7]", () => {
  it("keeps an already-normalized date verbatim", () => {
    const result = createExpense({ ...VALID_INPUT, date: "2026-07-02" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.date).toBe("2026-07-02");
  });

  it("normalizes a non-padded date to YYYY-MM-DD", () => {
    const result = createExpense({ ...VALID_INPUT, date: "2026-7-2" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.date).toBe("2026-07-02");
  });

  it("normalizes a single-digit month with a padded day", () => {
    const result = createExpense({ ...VALID_INPUT, date: "2026-1-15" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.date).toBe("2026-01-15");
  });

  it("does not shift the day (timezone-independent normalization)", () => {
    const result = createExpense({ ...VALID_INPUT, date: "2026-1-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.date).toBe("2026-01-01");
  });
});
