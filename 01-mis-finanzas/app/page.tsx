"use client";

import { useEffect, useState } from "react";

import { ExpenseForm } from "../src/components/ExpenseForm";
import { ExpenseList } from "../src/components/ExpenseList";
import {
  type Transaction,
  type TransactionInput,
  type ValidationError,
  createTransaction,
} from "../src/domain/transaction";
import {
  loadTransactions,
  saveTransactions,
} from "../src/storage/transactionStorage";

const SAVE_ERROR_MESSAGE = "No se pudo guardar el gasto. Vuelve a intentarlo.";

export default function Home() {
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Read storage in a mount effect, never during render: `localStorage` does
  // not exist while Next.js renders this on the server.
  useEffect(() => {
    setExpenses(loadTransactions());
  }, []);

  /** Returns whether the submission was accepted, which drives the form reset. */
  function handleSubmit(values: TransactionInput): boolean {
    const result = createTransaction(values);
    if (!result.ok) {
      // Recomputed from this result, never accumulated, so corrected fields
      // stop being annotated. Clearing `saveError` matters too: no write was
      // even attempted, so a previous save failure no longer describes
      // anything on screen.
      setErrors(result.errors);
      setSaveError(null);
      return false;
    }

    const next = [...expenses, result.transaction];
    try {
      saveTransactions(next);
    } catch {
      // Nothing is added to the list either: a failed write must not leave the
      // UI claiming an expense was registered. Every field is valid at this
      // point, so any leftover field annotations must go.
      setErrors([]);
      setSaveError(SAVE_ERROR_MESSAGE);
      return false;
    }

    setErrors([]);
    setSaveError(null);
    setExpenses(next);
    return true;
  }

  return (
    <main>
      <h1>Mis finanzas</h1>
      <ExpenseForm
        onSubmit={handleSubmit}
        errors={errors}
        saveError={saveError}
      />
      <ExpenseList expenses={expenses} />
    </main>
  );
}
