import type { Expense } from "../domain/expense";

export const EMPTY_STATE_MESSAGE = "Aún no hay gastos registrados.";

/**
 * Presentational and props-driven: it never reads storage itself, so the page
 * owns the data and this stays trivially testable.
 *
 * Amounts and dates render as the stored values verbatim — no currency symbol
 * and no locale formatting, both out of scope for this feature.
 */
export function ExpenseList({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return <p>{EMPTY_STATE_MESSAGE}</p>;
  }

  return (
    <ul>
      {expenses.map((expense) => (
        <li key={expense.id}>
          <span>{expense.amount}</span>
          <span>{expense.date}</span>
          <span>{expense.description}</span>
          <span>{expense.category}</span>
        </li>
      ))}
    </ul>
  );
}
