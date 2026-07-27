import { useState } from "react";

import {
  CATEGORIES,
  type ExpenseInput,
  type ValidationError,
} from "../domain/expense";

const EMPTY_VALUES = {
  amount: "",
  date: "",
  description: "",
  category: "",
};

/** `aria-describedby` target for a field's validation message. */
function messageId(field: keyof ExpenseInput): string {
  return `${field}-error`;
}

/**
 * Props-driven: the form owns the typed values, the caller owns the domain.
 *
 * `onSubmit` returns whether the submission was **accepted**. Only the caller
 * knows that (it runs `createExpense` and `saveExpenses`), and only a `true`
 * result clears the inputs — a rejected submission must keep every value the
 * user typed so they can correct it.
 */
export function ExpenseForm({
  onSubmit,
  errors = [],
  saveError = null,
}: {
  onSubmit: (values: ExpenseInput) => boolean;
  // Both optional: T8a's tests render <ExpenseForm> without them, and required
  // props would break `npm run typecheck` on those files.
  errors?: ValidationError[];
  saveError?: string | null;
}) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [suggesting, setSuggesting] = useState(false);

  function update(field: keyof typeof EMPTY_VALUES, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * Asks the server route to classify the description and prefills the category.
   *
   * Every failure is swallowed: the suggestion is a convenience, and no error
   * path may block manual registration (3.6). The pending flag is cleared in a
   * `finally` so no path can leave the button disabled.
   */
  async function suggest() {
    const description = values.description.trim();
    if (description === "") return; // no call at all for an empty description (3.5)

    setSuggesting(true);
    try {
      const response = await fetch("/api/suggest-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!response.ok) return;

      const body = (await response.json()) as { category?: unknown };
      if (typeof body.category === "string") {
        update("category", body.category);
      }
    } catch {
      // Network failure or timeout: leave the form exactly as the user left it.
    } finally {
      setSuggesting(false);
    }
  }

  function errorFor(field: keyof ExpenseInput): ValidationError | undefined {
    return errors.find((error) => error.field === field);
  }

  /**
   * The attribute is omitted entirely — not set to `""` — when the field has no
   * error, which is what the tests assert.
   */
  function describedBy(field: keyof ExpenseInput) {
    return errorFor(field) === undefined
      ? undefined
      : { "aria-describedby": messageId(field) };
  }

  function message(field: keyof ExpenseInput) {
    const error = errorFor(field);
    if (error === undefined) return null;
    return <span id={messageId(field)}>{error.message}</span>;
  }

  return (
    <form
      // noValidate + no `required`: the browser must not block submission of
      // invalid values, or the domain would never get to validate them.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (onSubmit(values)) {
          setValues(EMPTY_VALUES);
        }
      }}
    >
      <div>
        <label htmlFor="amount">Monto</label>
        <input
          id="amount"
          type="number"
          value={values.amount}
          onChange={(event) => update("amount", event.target.value)}
          {...describedBy("amount")}
        />
        {message("amount")}
      </div>

      <div>
        <label htmlFor="date">Fecha</label>
        <input
          id="date"
          type="date"
          value={values.date}
          onChange={(event) => update("date", event.target.value)}
          {...describedBy("date")}
        />
        {message("date")}
      </div>

      <div>
        <label htmlFor="description">Descripción</label>
        <input
          id="description"
          type="text"
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          {...describedBy("description")}
        />
        {message("description")}
        {/*
          type="button" is load-bearing: inside a <form> the HTML default is
          "submit", so an untyped button would register the expense on click.
        */}
        <button type="button" disabled={suggesting} onClick={() => void suggest()}>
          Sugerir
        </button>
      </div>

      <div>
        <label htmlFor="category">Categoría</label>
        <select
          id="category"
          value={values.category}
          onChange={(event) => update("category", event.target.value)}
          {...describedBy("category")}
        >
          <option value="">Selecciona una categoría</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {message("category")}
      </div>

      {saveError !== null && <p role="alert">{saveError}</p>}

      <button type="submit">Registrar</button>
    </form>
  );
}
