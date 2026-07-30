import type { Allocation } from "../../domain/plan";
import { formatMoney, formatPercent } from "../../format/money";
import { PLAN_SERIES } from "./planSeries";
import { cx } from "./cx";

/**
 * "This month's allocation": one stacked strip over a legend-cum-table of the
 * three amounts and their shares.
 *
 * The rows are the readable version — name, amount and percentage in text — so
 * the strip above them adds shape, never information you can only get by
 * comparing colours.
 */
export function AllocationBar({ allocation }: { allocation: Allocation }) {
  const parts = PLAN_SERIES.map((series) => ({
    ...series,
    amount: allocation[series.key],
  }));

  // Negative savings contributes no width; the row below still states it.
  const total = parts.reduce(
    (sum, part) => sum + Math.max(0, part.amount),
    0,
  );

  function share(amount: number): number {
    return total > 0 ? Math.max(0, amount) / total : 0;
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <span
        aria-hidden="true"
        className="flex h-4 gap-0.5 overflow-hidden rounded-full"
      >
        {parts.map((part) => (
          <span
            key={part.key}
            className={cx("block h-full", part.bar)}
            style={{ width: `${share(part.amount) * 100}%` }}
          />
        ))}
      </span>

      <ul className="flex flex-col gap-3">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-2.5">
            <span className="flex flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className={cx("size-2.5 shrink-0 rounded-[3px]", part.bar)}
              />
              <span className="font-body text-[14px] text-text-primary">
                {part.label}
              </span>
            </span>
            <span className="font-data text-[14px] font-semibold tabular-nums text-text-primary">
              {formatMoney(part.amount)}
            </span>
            <span className="w-10 text-right font-body text-[13px] tabular-nums text-text-muted">
              {formatPercent(share(part.amount))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
