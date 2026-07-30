import type { CategorySpending } from "../../domain/snapshot";
import { categoryLabel } from "../../domain/transaction";
import { formatMoney } from "../../format/money";

/**
 * "Spending by category": a ranked list of thin bars, each with its name and
 * amount above it.
 *
 * The bar is scaled to the **largest** category, so the longest one fills its
 * track. The mockup instead draws housing at 64% of the track, which implies an
 * axis maximum ~1.6× the biggest value — headroom with nothing in it. Scaling to
 * the data is the readable rule.
 *
 * Every value is printed beside its label, so the bars are decoration on top of
 * a table that is already legible — which is what keeps the chart usable when the
 * fills are too pale to compare (they clear 3:1 against the track, not the page).
 */
export function BarList({ items }: { items: readonly CategorySpending[] }) {
  const largest = items.reduce((max, item) => Math.max(max, item.amount), 0);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface p-4 shadow-sm">
      <h3 className="font-body text-[13px] font-semibold text-text-secondary">
        Spending by category
      </h3>

      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.category} className="flex flex-col gap-[5px]">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-body text-[12px] text-text-secondary">
                {categoryLabel(item.category, "en")}
              </span>
              <span className="font-data text-[12px] tabular-nums text-text-primary">
                {formatMoney(item.amount)}
              </span>
            </span>

            {/* Decorative: the numbers above already carry the value. */}
            <span
              aria-hidden="true"
              className="block h-2 overflow-hidden rounded-full bg-surface-soft"
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{
                  width:
                    largest > 0
                      ? `${Math.max(2, (item.amount / largest) * 100)}%`
                      : "0%",
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
