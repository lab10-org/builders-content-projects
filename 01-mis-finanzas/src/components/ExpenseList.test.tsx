// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Expense } from "../domain/expense";
import { ExpenseList } from "./ExpenseList";

const LUNCH: Expense = {
  id: "a1",
  amount: 25000,
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "Comida",
};

// Shares a category with LUNCH on purpose: a bare screen.getByText("Comida")
// would be ambiguous, which is what forces the `within(row)` scoping below.
const COFFEE: Expense = {
  id: "b2",
  amount: 4800,
  date: "2026-07-03",
  description: "Café de la mañana",
  category: "Comida",
};

describe("ExpenseList [4.4]", () => {
  it("renders one row per expense", () => {
    render(<ExpenseList expenses={[LUNCH, COFFEE]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows amount, date, description and category inside each row", () => {
    render(<ExpenseList expenses={[LUNCH, COFFEE]} />);

    const rows = screen.getAllByRole("listitem");

    for (const [row, expense] of [
      [rows[0], LUNCH],
      [rows[1], COFFEE],
    ] as const) {
      const scope = within(row);
      expect(scope.getByText(String(expense.amount))).toBeDefined();
      expect(scope.getByText(expense.date)).toBeDefined();
      expect(scope.getByText(expense.description)).toBeDefined();
      expect(scope.getByText(expense.category)).toBeDefined();
    }
  });

  it("renders the amount as a plain number and the date verbatim", () => {
    render(<ExpenseList expenses={[LUNCH]} />);

    const row = screen.getAllByRole("listitem")[0];
    const text = row.textContent ?? "";

    expect(text).toContain("25000");
    expect(text).not.toContain("$");
    expect(text).not.toContain("25.000");
    expect(text).not.toContain("25,000");
    expect(text).toContain("2026-07-02");
  });

  it("shows the empty state and no rows for an empty list", () => {
    render(<ExpenseList expenses={[]} />);

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.getByText("Aún no hay gastos registrados.")).toBeDefined();
  });

  it("does not show the empty state when there are expenses", () => {
    render(<ExpenseList expenses={[LUNCH]} />);

    expect(screen.queryByText("Aún no hay gastos registrados.")).toBeNull();
  });
});
