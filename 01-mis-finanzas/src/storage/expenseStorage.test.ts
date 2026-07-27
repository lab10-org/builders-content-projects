import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Expense } from "../domain/expense";
import { STORAGE_KEY, loadExpenses, saveExpenses } from "./expenseStorage";

/**
 * Node has no `localStorage`, so the tests install a three-method in-memory
 * stub through `vi.stubGlobal` — assigning `globalThis.localStorage` directly
 * would have to satisfy the full DOM `Storage` interface to typecheck.
 */
function createStorageStub() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
    clear: vi.fn(() => {
      entries.clear();
    }),
  };
}

let stub: ReturnType<typeof createStorageStub>;

const EXPENSE_A: Expense = {
  id: "a1",
  amount: 25000,
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "Comida",
};

const EXPENSE_B: Expense = {
  id: "b2",
  amount: 3500,
  date: "2026-07-03",
  description: "Bus al trabajo",
  category: "Transporte",
};

beforeEach(() => {
  stub = createStorageStub();
  vi.stubGlobal("localStorage", stub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("round trip [4.1, 4.2]", () => {
  it("saves under the exported STORAGE_KEY and loads the same list back", () => {
    saveExpenses([EXPENSE_A, EXPENSE_B]);

    expect(STORAGE_KEY).toBe("mis-finanzas:expenses");
    expect(JSON.parse(stub.entries.get(STORAGE_KEY) ?? "null")).toEqual([
      EXPENSE_A,
      EXPENSE_B,
    ]);
    expect(loadExpenses()).toEqual([EXPENSE_A, EXPENSE_B]);
  });

  it("saves an empty list without error", () => {
    saveExpenses([]);

    expect(loadExpenses()).toEqual([]);
  });
});

describe("unreadable stored data [4.5]", () => {
  it("returns [] when the key is absent", () => {
    expect(loadExpenses()).toEqual([]);
  });

  it("returns [] when the stored value is malformed JSON", () => {
    stub.entries.set(STORAGE_KEY, "{oops");

    expect(loadExpenses()).toEqual([]);
  });

  it.each([
    ["an object", '{"a":1}'],
    ["a string", '"hola"'],
    ["a number", "42"],
    ["null", "null"],
  ])("returns [] when the stored value is %s, not an array", (_label, raw) => {
    stub.entries.set(STORAGE_KEY, raw);

    expect(loadExpenses()).toEqual([]);
  });

  it("drops only the malformed entries and keeps the valid ones", () => {
    stub.entries.set(
      STORAGE_KEY,
      JSON.stringify([
        EXPENSE_A,
        { ...EXPENSE_B, category: "Mascotas" }, // off the fixed list
        { ...EXPENSE_B, id: 7 }, // wrong id type
        { ...EXPENSE_B, amount: "3500" }, // wrong amount type
        { ...EXPENSE_B, date: undefined }, // missing field
        { description: "suelto" }, // wrong shape
        null,
        "no soy un gasto",
        42,
      ]),
    );

    expect(loadExpenses()).toEqual([EXPENSE_A]);
  });

  it("never throws, whatever is stored", () => {
    for (const raw of ["{oops", "undefined", "[", '[{"id":']) {
      stub.entries.set(STORAGE_KEY, raw);
      expect(() => loadExpenses()).not.toThrow();
    }
  });
});

describe("write failures [4.6]", () => {
  it("propagates a setItem failure to the caller", () => {
    stub.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveExpenses([EXPENSE_A])).toThrow("QuotaExceededError");
  });
});
