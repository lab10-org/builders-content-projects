import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transaction } from "../domain/transaction";
import {
  LEGACY_EXPENSES_KEY,
  TRANSACTIONS_KEY,
  loadTransactions,
  saveTransactions,
} from "./transactionStorage";

/**
 * Node has no `localStorage`, so the tests install an in-memory stub through
 * `vi.stubGlobal` — assigning `globalThis.localStorage` directly would have to
 * satisfy the full DOM `Storage` interface to typecheck.
 */
function createStorageStub() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      entries.delete(key);
    }),
    clear: vi.fn(() => {
      entries.clear();
    }),
  };
}

let stub: ReturnType<typeof createStorageStub>;

const LUNCH: Transaction = {
  id: "a1",
  type: "expense",
  amount: 25000,
  currency: "USD",
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "food",
};

const BUS: Transaction = {
  id: "b2",
  type: "expense",
  amount: 3500,
  currency: "USD",
  date: "2026-07-03",
  description: "Bus al trabajo",
  category: "transport",
};

const SALARY: Transaction = {
  id: "c3",
  type: "income",
  amount: 1200,
  currency: "USD",
  date: "2026-07-01",
  description: "Freelance project",
  category: "other",
};

beforeEach(() => {
  stub = createStorageStub();
  vi.stubGlobal("localStorage", stub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("round trip [4.1, 4.2]", () => {
  it("saves under the exported key and loads the same list back", () => {
    saveTransactions([LUNCH, BUS]);

    expect(TRANSACTIONS_KEY).toBe("mis-finanzas:transactions");
    expect(JSON.parse(stub.entries.get(TRANSACTIONS_KEY) ?? "null")).toEqual([
      LUNCH,
      BUS,
    ]);
    expect(loadTransactions()).toEqual([LUNCH, BUS]);
  });

  it("saves an empty list without error", () => {
    saveTransactions([]);

    expect(loadTransactions()).toEqual([]);
  });

  it("round-trips income alongside expenses", () => {
    saveTransactions([SALARY, LUNCH]);

    expect(loadTransactions()).toEqual([SALARY, LUNCH]);
  });
});

describe("migrating pre-refactor data", () => {
  /** Exactly the shape the app wrote before transactions existed. */
  const LEGACY = {
    id: "old1",
    amount: 25000,
    date: "2026-07-02",
    description: "Almuerzo con cliente",
    category: "Comida",
  };

  it("reads a legacy expense list when nothing has been written yet", () => {
    stub.entries.set(LEGACY_EXPENSES_KEY, JSON.stringify([LEGACY]));

    expect(loadTransactions()).toEqual([
      {
        id: "old1",
        type: "expense",
        amount: 25000,
        currency: "USD",
        date: "2026-07-02",
        description: "Almuerzo con cliente",
        category: "food",
      },
    ]);
  });

  it("translates every legacy Spanish category to its canonical value", () => {
    stub.entries.set(
      LEGACY_EXPENSES_KEY,
      JSON.stringify(
        ["Comida", "Transporte", "Vivienda", "Ocio", "Salud", "Otros"].map(
          (category, index) => ({ ...LEGACY, id: `l${index}`, category }),
        ),
      ),
    );

    expect(loadTransactions().map((entry) => entry.category)).toEqual([
      "food",
      "transport",
      "housing",
      "leisure",
      "health",
      "other",
    ]);
  });

  it("ignores the legacy key once the app has written its own list", () => {
    stub.entries.set(LEGACY_EXPENSES_KEY, JSON.stringify([LEGACY]));
    saveTransactions([BUS]);

    expect(loadTransactions()).toEqual([BUS]);
  });

  it("clears the legacy key after a successful write", () => {
    stub.entries.set(LEGACY_EXPENSES_KEY, JSON.stringify([LEGACY]));

    saveTransactions([BUS]);

    expect(stub.entries.has(LEGACY_EXPENSES_KEY)).toBe(false);
  });

  it("keeps the legacy data when the write fails", () => {
    // It is still the only copy at that point, so losing it would be data loss.
    stub.entries.set(LEGACY_EXPENSES_KEY, JSON.stringify([LEGACY]));
    stub.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveTransactions([BUS])).toThrow("QuotaExceededError");
    expect(stub.entries.has(LEGACY_EXPENSES_KEY)).toBe(true);
    expect(loadTransactions()).toHaveLength(1);
  });

  it("prefers an empty current list over legacy data", () => {
    // Having deleted everything is a real state; it must not resurrect old rows.
    stub.entries.set(LEGACY_EXPENSES_KEY, JSON.stringify([LEGACY]));
    stub.entries.set(TRANSACTIONS_KEY, "[]");

    expect(loadTransactions()).toEqual([]);
  });
});

describe("unreadable stored data [4.5]", () => {
  it("returns [] when the key is absent", () => {
    expect(loadTransactions()).toEqual([]);
  });

  it("returns [] when the stored value is malformed JSON", () => {
    stub.entries.set(TRANSACTIONS_KEY, "{oops");

    expect(loadTransactions()).toEqual([]);
  });

  it.each([
    ["an object", '{"a":1}'],
    ["a string", '"hola"'],
    ["a number", "42"],
    ["null", "null"],
  ])("returns [] when the stored value is %s, not an array", (_label, raw) => {
    stub.entries.set(TRANSACTIONS_KEY, raw);

    expect(loadTransactions()).toEqual([]);
  });

  it("drops only the malformed entries and keeps the valid ones", () => {
    stub.entries.set(
      TRANSACTIONS_KEY,
      JSON.stringify([
        LUNCH,
        { ...BUS, category: "pets" }, // off the fixed list
        { ...BUS, id: 7 }, // wrong id type
        { ...BUS, amount: "3500" }, // wrong amount type
        { ...BUS, amount: -1 }, // non-positive
        { ...BUS, date: undefined }, // missing field
        { ...BUS, type: "transfer" }, // corrupt type
        { ...BUS, currency: "BTC" }, // corrupt currency
        { description: "suelto" }, // wrong shape
        null,
        "no soy una transacción",
        42,
      ]),
    );

    expect(loadTransactions()).toEqual([LUNCH]);
  });

  it("never throws, whatever is stored", () => {
    for (const raw of ["{oops", "undefined", "[", '[{"id":']) {
      stub.entries.set(TRANSACTIONS_KEY, raw);
      expect(() => loadTransactions()).not.toThrow();
    }
  });
});

describe("write failures [4.6]", () => {
  it("propagates a setItem failure to the caller", () => {
    stub.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveTransactions([LUNCH])).toThrow("QuotaExceededError");
  });
});
