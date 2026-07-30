// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Transaction, categoryLabel } from "../src/domain/transaction";
import { TRANSACTIONS_KEY } from "../src/storage/transactionStorage";
import Home from "./page";

const STORED: Transaction = {
  id: "a1",
  type: "expense",
  amount: 25000,
  currency: "USD",
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "food",
};

const EMPTY_STATE = "Aún no hay gastos registrados.";

// Under jsdom `localStorage` is real, so the page is seeded through the actual
// browser API rather than a stub or a module mock.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

/**
 * Scopes assertions to a single row. The page grows a form (T8a) and a second
 * row, so unscoped `screen.getByText` would go ambiguous.
 */
function expectRowShows(row: HTMLElement, expense: Transaction) {
  const scope = within(row);
  expect(scope.getByText(String(expense.amount))).toBeDefined();
  expect(scope.getByText(expense.date)).toBeDefined();
  expect(scope.getByText(expense.description)).toBeDefined();
  expect(
    scope.getByText(categoryLabel(expense.category, "es")),
  ).toBeDefined();
}

function fillForm(values: {
  amount: string;
  date: string;
  description: string;
  category: string;
}) {
  fireEvent.change(screen.getByLabelText("Monto"), {
    target: { value: values.amount },
  });
  fireEvent.change(screen.getByLabelText("Fecha"), {
    target: { value: values.date },
  });
  fireEvent.change(screen.getByLabelText("Descripción"), {
    target: { value: values.description },
  });
  fireEvent.change(screen.getByLabelText("Categoría"), {
    target: { value: values.category },
  });
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
}

function storedExpenses(): unknown {
  return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) ?? "null");
}

describe("Home — load on mount [4.2]", () => {
  it("shows an expense that was already stored before render", async () => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([STORED]));

    render(<Home />);

    // findBy…: the page reads storage in a mount effect, not during render.
    await screen.findByText(STORED.description);
    expectRowShows(screen.getAllByRole("listitem")[0], STORED);
    expect(screen.queryByText(EMPTY_STATE)).toBeNull();
  });

  it("renders every stored expense", async () => {
    localStorage.setItem(
      TRANSACTIONS_KEY,
      JSON.stringify([STORED, { ...STORED, id: "b2", description: "Bus" }]),
    );

    render(<Home />);

    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
  });
});

describe("Home — unreadable storage [4.5]", () => {
  it("renders the empty state when nothing is stored", async () => {
    render(<Home />);

    expect(await screen.findByText(EMPTY_STATE)).toBeDefined();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it.each([
    ["corrupt JSON", "{oops"],
    ["a non-array value", '{"a":1}'],
    ["an array of junk", '[null,"x",42]'],
  ])("renders the empty state without crashing for %s", async (_label, raw) => {
    localStorage.setItem(TRANSACTIONS_KEY, raw);

    expect(() => render(<Home />)).not.toThrow();

    expect(await screen.findByText(EMPTY_STATE)).toBeDefined();
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});

describe("Home — registering a valid expense [1.1, 4.1, 4.3]", () => {
  const NEW_EXPENSE = {
    amount: "18500",
    date: "2026-07-05",
    description: "Mercado del mes",
    category: "housing",
  };

  it("adds the row without a reload and persists it [4.3, 4.1]", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    // The row must not exist before submitting — otherwise the assertion after
    // the submit would prove nothing.
    expect(screen.queryByText(NEW_EXPENSE.description)).toBeNull();

    fillForm(NEW_EXPENSE);
    submitForm();

    await screen.findByText(NEW_EXPENSE.description);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expectRowShows(rows[0], {
      id: "ignored",
      type: "expense",
      amount: 18500,
      currency: "USD",
      date: NEW_EXPENSE.date,
      description: NEW_EXPENSE.description,
      category: "housing",
    });
    expect(screen.queryByText(EMPTY_STATE)).toBeNull();

    const stored = storedExpenses() as Record<string, unknown>[];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      amount: 18500,
      date: NEW_EXPENSE.date,
      description: NEW_EXPENSE.description,
      category: "housing",
    });
    expect(typeof stored[0].id).toBe("string");
    expect((stored[0].id as string).length).toBeGreaterThan(0);
  });

  it("appends to the expenses already in storage", async () => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([STORED]));
    render(<Home />);
    await screen.findByText(STORED.description);

    fillForm(NEW_EXPENSE);
    submitForm();

    await screen.findByText(NEW_EXPENSE.description);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    const stored = storedExpenses() as Record<string, unknown>[];
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ description: STORED.description });
    expect(stored[1]).toMatchObject({ description: NEW_EXPENSE.description });
  });

  it("clears the form after a successful submission", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    fillForm(NEW_EXPENSE);
    submitForm();

    await screen.findByText(NEW_EXPENSE.description);
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByLabelText("Descripción") as HTMLInputElement).value,
    ).toBe("");
  });

  it("stores nothing and adds no row when the submission is invalid", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    fillForm({ ...NEW_EXPENSE, amount: "-5" });
    submitForm();

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(localStorage.getItem(TRANSACTIONS_KEY)).toBeNull();
    // The typed values survive, so the user can correct them.
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe(
      "-5",
    );
    expect(
      (screen.getByLabelText("Descripción") as HTMLInputElement).value,
    ).toBe(NEW_EXPENSE.description);
  });
});

/**
 * Resolves what an input points at through `aria-describedby`. The message copy
 * comes from the domain, so the tests assert the link and its non-emptiness,
 * never the wording.
 */
function describedByText(input: HTMLElement): string | null {
  const id = input.getAttribute("aria-describedby");
  if (id === null) return null;
  return document.getElementById(id)?.textContent ?? "";
}

function expectHasMessage(label: string) {
  const text = describedByText(screen.getByLabelText(label));
  expect(text).not.toBe(null);
  expect((text ?? "").trim().length).toBeGreaterThan(0);
}

function expectHasNoMessage(label: string) {
  expect(screen.getByLabelText(label).getAttribute("aria-describedby")).toBeNull();
}

describe("Home — rejected submission [1.6]", () => {
  const INVALID = {
    amount: "-5",
    date: "2026-07-05",
    description: "   ",
    category: "housing",
  };

  it("annotates every invalid field, keeps input, stores nothing", async () => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([STORED]));
    render(<Home />);
    await screen.findByText(STORED.description);

    fillForm(INVALID);
    submitForm();

    expectHasMessage("Monto");
    expectHasMessage("Descripción");
    expectHasNoMessage("Fecha");
    expectHasNoMessage("Categoría");

    // Nothing added, anywhere.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(storedExpenses()).toEqual([STORED]);

    // Every typed value survives.
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe(
      INVALID.amount,
    );
    expect(
      (screen.getByLabelText("Descripción") as HTMLInputElement).value,
    ).toBe(INVALID.description);
    expect((screen.getByLabelText("Fecha") as HTMLInputElement).value).toBe(
      INVALID.date,
    );
    expect(
      (screen.getByLabelText("Categoría") as HTMLSelectElement).value,
    ).toBe(INVALID.category);
  });

  it("clears the messages once the fields are corrected — errors are not sticky", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    fillForm(INVALID);
    submitForm();
    expectHasMessage("Monto");
    expectHasMessage("Descripción");

    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: "9900" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Almuerzo corregido" },
    });
    submitForm();

    await screen.findByText("Almuerzo corregido");
    expectHasNoMessage("Monto");
    expectHasNoMessage("Descripción");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("Home — failed write [4.6]", () => {
  const SAVE_ERROR = "No se pudo guardar el gasto. Vuelve a intentarlo.";
  const VALID = {
    amount: "18500",
    date: "2026-07-05",
    description: "Mercado del mes",
    category: "housing",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the failure, adds no row, and keeps every entered value", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    // Installed AFTER any seeding, and on the browser API rather than on the
    // module the page also imports from — so the page's real saveExpenses runs.
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    fillForm(VALID);
    submitForm();

    expect(setItem).toHaveBeenCalled(); // the save was attempted, not skipped
    expect(await screen.findByText(SAVE_ERROR)).toBeDefined();
    expect(screen.queryByRole("listitem")).toBeNull();

    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe(
      VALID.amount,
    );
    expect(
      (screen.getByLabelText("Descripción") as HTMLInputElement).value,
    ).toBe(VALID.description);
    expect((screen.getByLabelText("Fecha") as HTMLInputElement).value).toBe(
      VALID.date,
    );
    expect(
      (screen.getByLabelText("Categoría") as HTMLSelectElement).value,
    ).toBe(VALID.category);
  });

  it("clears the save error once a later write succeeds", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("QuotaExceededError");
      });

    fillForm(VALID);
    submitForm();
    await screen.findByText(SAVE_ERROR);

    setItem.mockRestore();
    submitForm();

    await screen.findByText(VALID.description);
    expect(screen.queryByText(SAVE_ERROR)).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

/**
 * The two failure kinds are mutually exclusive: whichever one happens is the
 * only thing the UI may claim. Without this, a corrected field stays flagged
 * after a write failure, and a save-error alert survives a submission that
 * never even attempted a write — in both cases the UI states something untrue.
 */
describe("Home — the two failure kinds do not leak into each other", () => {
  const SAVE_ERROR = "No se pudo guardar el gasto. Vuelve a intentarlo.";
  const VALID = {
    amount: "18500",
    date: "2026-07-05",
    description: "Mercado del mes",
    category: "housing",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops field annotations when the next submission fails on the write instead", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    // First: a validation rejection annotates Monto.
    fillForm({ ...VALID, amount: "-5" });
    submitForm();
    expectHasMessage("Monto");

    // Then: the field is corrected, but the write fails.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: VALID.amount },
    });
    submitForm();

    await screen.findByText(SAVE_ERROR);
    expectHasNoMessage("Monto"); // the amount is valid now — do not keep flagging it
  });

  it("drops the save-error alert when the next submission is rejected by validation", async () => {
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    fillForm(VALID);
    submitForm();
    await screen.findByText(SAVE_ERROR);

    // Now submit something invalid: no write is even attempted, so the save
    // error no longer describes anything.
    setItem.mockClear();
    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: "-5" },
    });
    submitForm();

    expectHasMessage("Monto");
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.queryByText(SAVE_ERROR)).toBeNull();
  });
});

describe("Home — the user's category overrides the suggestion [3.3]", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the category the user finally selected, not the suggested one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ category: "food" }),
      })),
    );
    render(<Home />);
    await screen.findByText(EMPTY_STATE);

    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: "25000" },
    });
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-07-02" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Almuerzo con cliente" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sugerir" }));
    await screen.findByDisplayValue("Comida");

    // The user disagrees with the suggestion.
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "transport" },
    });
    submitForm();

    await screen.findByText("Almuerzo con cliente");
    const row = screen.getAllByRole("listitem")[0];
    expect(within(row).getByText("Transporte")).toBeDefined();
    expect(within(row).queryByText("Comida")).toBeNull();

    const stored = storedExpenses() as Record<string, unknown>[];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ category: "transport" });
  });
});
