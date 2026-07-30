import type { TransactionType } from "../domain/transaction";

/**
 * Money formatting for the onboarding screens, matching the two shapes the
 * design uses:
 *
 * - figures and totals: `$48,920` — no cents, because a snapshot rounds
 * - transaction rows: `+$1,200.00` / `-$142.30` — cents, and the sign carries
 *   the type
 *
 * `en-US` is hardcoded rather than taken from the browser: these screens' copy is
 * English and their currency is USD, so a locale-driven `1.200,00 €` would
 * contradict the label right beside it.
 */
const LOCALE = "en-US";

/** `$48,920`. Rounds, so it never shows cents the snapshot does not mean. */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";

  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${rounded.toLocaleString(LOCALE)}`;
}

/**
 * `+$1,200.00` for income, `-$142.30` for an expense.
 *
 * The stored amount is always positive — the type is what decides the sign — so
 * this is the one place that turns a type into a `+` or `-`.
 */
export function formatSignedMoney(
  amount: number,
  type: TransactionType,
): string {
  const magnitude = Math.abs(Number.isFinite(amount) ? amount : 0);
  const formatted = magnitude.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${type === "income" ? "+" : "-"}$${formatted}`;
}

/** `23%`. Takes a 0..1 fraction, as the domain produces. */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "0%";
  return `${Math.round(fraction * 100)}%`;
}
