import { type Transaction, categoryLabel } from "../domain/transaction";

export const EMPTY_STATE_MESSAGE = "Aún no hay gastos registrados.";

/**
 * Presentational and props-driven: it never reads storage itself, so the page
 * owns the data and this stays trivially testable.
 *
 * Amounts and dates render as the stored values verbatim — no currency symbol
 * and no locale formatting, both out of scope for this feature.
 *
 * The category is stored as a language-neutral value, so it is translated here:
 * this screen is Spanish, and the same value renders in English inside the
 * onboarding flow.
 */
export function ExpenseList({ expenses }: { expenses: Transaction[] }) {
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
          <span>{categoryLabel(expense.category, "es")}</span>
        </li>
      ))}
    </ul>
  );
}
