import type { ProjectedMonth } from "../../domain/plan";
import { formatMoney } from "../../format/money";
import { PLAN_SERIES, STACK_ORDER } from "./planSeries";
import { cx } from "./cx";

/**
 * The twelve-month plan chart: one stacked bar per month, needs at the base.
 *
 * Three things here are deliberate rather than decorative:
 *
 * - **A 2px gap between segments.** The design stacks them flush; a hairline of
 *   surface between fills is what keeps the boundary readable rather than relying
 *   on the colour step alone.
 * - **Every bar is an `img` with a full aria-label**, so each month's three
 *   values are reachable without seeing the chart.
 * - **A table twin.** Visually hidden, but it means no value in this chart exists
 *   only as a coloured rectangle.
 *
 * Bars are scaled to the tallest month's total, so heights stay comparable even
 * if a month's mix changes.
 */
export function StackedBarChart({
  months,
}: {
  months: readonly ProjectedMonth[];
}) {
  const totalOf = (month: ProjectedMonth) =>
    month.needs + month.wants + Math.max(0, month.savings);
  const tallest = months.reduce(
    (max, month) => Math.max(max, totalOf(month)),
    0,
  );

  function height(amount: number): string {
    if (tallest <= 0 || amount <= 0) return "0%";
    return `${(amount / tallest) * 100}%`;
  }

  return (
    <figure className="flex flex-col gap-5">
      <figcaption className="flex flex-wrap items-start justify-between gap-4">
        <span className="flex flex-col gap-1">
          <span className="font-heading text-[18px] font-semibold text-text-primary">
            Month-over-month spending plan
          </span>
          <span className="font-body text-[13px] text-text-muted">
            As your goal nears, savings rise while discretionary spending eases.
          </span>
        </span>

        {/* Always present, per the rule that identity is never colour-alone. */}
        <ul className="flex shrink-0 flex-wrap items-center gap-4">
          {PLAN_SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx("size-2.5 rounded-[3px]", series.bar)}
              />
              <span className="font-body text-[12px] text-text-secondary">
                {series.label}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>

      <div className="flex flex-col gap-2.5">
        <div className="flex h-[300px] items-end gap-2 sm:gap-3">
          {months.map((month) => (
            <div
              key={month.month}
              role="img"
              aria-label={`${month.label}: needs ${formatMoney(month.needs)}, wants ${formatMoney(month.wants)}, savings ${formatMoney(month.savings)}`}
              // Native tooltip rather than a custom hover layer — enough to read a
              // month on hover without building a positioned overlay.
              title={`${month.label} · Needs ${formatMoney(month.needs)} · Wants ${formatMoney(month.wants)} · Savings ${formatMoney(month.savings)}`}
              className="flex h-full flex-1 flex-col justify-end gap-0.5"
            >
              {STACK_ORDER.map((key) => {
                const series = PLAN_SERIES.find((entry) => entry.key === key);
                if (series === undefined) return null;

                return (
                  <span
                    key={key}
                    aria-hidden="true"
                    className={cx(
                      "block w-full shrink-0",
                      series.bar,
                      key === "savings" && "rounded-t-[5px]",
                      key === "needs" && "rounded-b-[5px]",
                    )}
                    style={{ height: height(month[key]) }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex gap-2 sm:gap-3" aria-hidden="true">
          {months.map((month) => (
            <span
              key={month.month}
              className="flex-1 text-center font-data text-[11px] text-text-muted"
            >
              {month.label}
            </span>
          ))}
        </div>
      </div>

      {/* The WCAG-clean twin of the chart above. */}
      <table className="sr-only">
        <caption>Month-over-month spending plan</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {PLAN_SERIES.map((series) => (
              <th key={series.key} scope="col">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{month.label}</th>
              <td>{formatMoney(month.needs)}</td>
              <td>{formatMoney(month.wants)}</td>
              <td>{formatMoney(month.savings)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
