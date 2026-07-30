import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/**
 * Label + bordered input box + optional error message, matching the login
 * screen's Email/Password fields: label 14px/500, box radius-lg with a 1px
 * border, 14px/16px padding, 15px input text, 8px between label and box.
 *
 * The visible border lives on the wrapping box, not the `<input>`, because the
 * design puts the reveal toggle *inside* that box — `trailing` is that slot.
 */
export function TextField({
  id,
  label,
  error,
  trailing,
  type = "text",
  className,
  ...props
}: {
  id: string;
  label: string;
  /** Omit (or pass `undefined`) when the field is fine. */
  error?: string;
  /** Rendered inside the bordered box, after the input. */
  trailing?: ReactNode;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">) {
  const invalid = error !== undefined;
  const errorId = `${id}-error`;

  return (
    <div className={cx("flex w-full flex-col gap-2", className)}>
      <label
        htmlFor={id}
        className="font-body text-[14px] font-medium text-text-primary"
      >
        {label}
      </label>

      <div
        className={cx(
          "flex items-center gap-2 rounded-lg border bg-surface px-4 py-[14px] transition-colors focus-within:border-accent",
          invalid ? "border-danger" : "border-border",
        )}
      >
        <input
          id={id}
          type={type}
          // The box carries the ring, so the input's own outline would double it.
          className="w-full min-w-0 bg-transparent font-body text-[15px] text-text-primary outline-none placeholder:text-text-muted"
          // Spread as a group so the attributes are absent entirely — not set to
          // `""` — on a valid field, matching `ExpenseForm`'s convention.
          {...(invalid ? { "aria-invalid": true, "aria-describedby": errorId } : {})}
          {...props}
        />
        {trailing}
      </div>

      {invalid && (
        <p id={errorId} className="font-body text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
