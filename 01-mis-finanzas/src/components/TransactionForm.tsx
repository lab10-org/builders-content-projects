import { type ReactNode, useState } from "react";

import {
  CATEGORIES,
  CURRENCIES,
  type Currency,
  type TransactionType,
  type ValidationError,
  type ValidationField,
  categoryLabel,
} from "../domain/transaction";
import { Icon } from "./ui/icons";
import { cx } from "./ui/cx";

export interface TransactionDraft {
  type: TransactionType;
  description: string;
  amount: string;
  currency: Currency;
  category: string;
}

const EMPTY: TransactionDraft = {
  type: "expense",
  description: "",
  amount: "",
  currency: "USD",
  category: "",
};

/**
 * The compact field shell of the "Add income or expense" row: a 12px/600 label
 * over a bordered control. Deliberately not `TextField` — that one is the login
 * screen's field, with a larger label and taller box, and forcing one component
 * to be both would make neither match its screen.
 */
function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="font-body text-[12px] font-semibold text-text-secondary"
      >
        {label}
      </label>
      {children}
      {error !== undefined && (
        <span id={`${id}-error`} className="font-body text-[12px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-lg border bg-surface px-[14px] py-[11px] font-body text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent";

/**
 * A `<select>` with the design's own chevron.
 *
 * The native arrow is removed so the control matches the text inputs beside it,
 * which means the chevron has to be drawn back — without it the field looks like
 * a text input that ignores typing.
 */
function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select
        {...props}
        className={cx(CONTROL, "cursor-pointer appearance-none pr-9", className)}
      />
      <Icon
        name="chevron-down"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
      />
    </span>
  );
}

/**
 * "Add income or expense". Owns the draft values and the expense/income toggle;
 * the caller owns validation and persistence and reports back through `errors`.
 *
 * There is no date field — the design has none — so the caller stamps the
 * transaction with today's date rather than the domain relaxing its date rule.
 */
export function TransactionForm({
  onSubmit,
  errors = [],
}: {
  onSubmit: (draft: TransactionDraft) => boolean;
  errors?: ValidationError[];
}) {
  const [draft, setDraft] = useState(EMPTY);

  function update<K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function errorFor(field: ValidationField): string | undefined {
    return errors.find((error) => error.field === field)?.message;
  }

  function describedBy(field: ValidationField) {
    return errorFor(field) === undefined
      ? undefined
      : { "aria-describedby": `${field}-error`, "aria-invalid": true as const };
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        // Only a clean submission clears the row; a rejected one keeps every
        // value so the user can fix it.
        if (onSubmit(draft)) setDraft(EMPTY);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[18px] font-semibold text-text-primary">
            Add income or expense
          </h2>
          <p className="font-body text-[13px] text-text-muted">
            Log a transaction we couldn&apos;t detect from your files.
          </p>
        </div>

        {/*
          A radiogroup, not two buttons: expense and income are exclusive, so the
          browser should own the arrow-key behaviour and announce the state.
          The selected segment is white-on-soft here, unlike the profile screen's
          accent fill — the design styles the two toggles differently.
        */}
        <div
          role="radiogroup"
          aria-label="Transaction type"
          className="flex gap-1 rounded-full bg-surface-soft p-1"
        >
          {(
            [
              ["expense", "Expense", "trending-down", "text-danger"],
              ["income", "Income", "trending-up", "text-positive"],
            ] as const
          ).map(([value, label, icon, iconColor]) => {
            const selected = draft.type === value;

            return (
              <label
                key={value}
                className={cx(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  selected ? "bg-surface shadow-sm" : "hover:bg-surface/60",
                )}
              >
                <input
                  type="radio"
                  name="transaction-type"
                  value={value}
                  checked={selected}
                  onChange={() => update("type", value)}
                  className="sr-only"
                />
                <Icon name={icon} className={cx("size-[15px]", iconColor)} />
                <span
                  className={cx(
                    "font-body text-[13px]",
                    selected
                      ? "font-semibold text-text-primary"
                      : "text-text-muted",
                  )}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field
          id="tx-description"
          label="Description"
          error={errorFor("description")}
          className="min-w-[220px] flex-[3]"
        >
          <input
            id="tx-description"
            type="text"
            placeholder="e.g. Monthly rent"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            className={cx(
              CONTROL,
              errorFor("description") !== undefined
                ? "border-danger"
                : "border-border",
            )}
            {...describedBy("description")}
          />
        </Field>

        <Field
          id="tx-amount"
          label="Value"
          error={errorFor("amount")}
          className="w-[130px]"
        >
          <input
            id="tx-amount"
            // `inputMode="decimal"` rather than type="number": the latter's
            // spinners and locale-dependent parsing fight a currency field.
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.amount}
            onChange={(event) => update("amount", event.target.value)}
            className={cx(
              CONTROL,
              "text-right font-data tabular-nums",
              errorFor("amount") !== undefined
                ? "border-danger"
                : "border-border",
            )}
            {...describedBy("amount")}
          />
        </Field>

        <Field id="tx-currency" label="Currency" className="w-[110px]">
          <Select
            id="tx-currency"
            value={draft.currency}
            onChange={(event) =>
              update("currency", event.target.value as Currency)
            }
            className="border-border"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="tx-category"
          label="Category"
          error={errorFor("category")}
          className="min-w-[170px] flex-1"
        >
          <Select
            id="tx-category"
            value={draft.category}
            onChange={(event) => update("category", event.target.value)}
            className={
              errorFor("category") !== undefined
                ? "border-danger"
                : "border-border"
            }
            {...describedBy("category")}
          >
            <option value="">Select category</option>
            {/* All seven here, unlike the Spanish form's six: this screen is
                where `subscriptions` is meant to be selectable. */}
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {categoryLabel(category.value, "en")}
              </option>
            ))}
          </Select>
        </Field>

        <button
          type="submit"
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 py-3 font-body text-[14px] font-semibold text-text-inverse transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Icon name="plus" className="size-[17px]" />
          Add
        </button>
      </div>
    </form>
  );
}
