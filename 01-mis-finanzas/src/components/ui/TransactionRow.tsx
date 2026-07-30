import type { Transaction } from "../../domain/transaction";
import { formatSignedMoney } from "../../format/money";
import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * One row of "Recently added": an icon tile, the description with a
 * `Type · Currency` meta line, and the signed amount.
 *
 * The design colours income green and leaves an expense in the primary ink — the
 * arrow direction, not the colour alone, is what distinguishes them, so the row
 * still reads without colour.
 *
 * `tabular-nums` here (unlike `StatTile`) because these amounts stack vertically
 * and should align on the decimal point.
 */
export function TransactionRow({
  transaction,
}: {
  transaction: Transaction;
}) {
  const income = transaction.type === "income";

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg bg-surface-soft px-4 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-surface">
          <Icon
            name={income ? "trending-up" : "trending-down"}
            className={cx(
              "size-[17px]",
              income ? "text-positive" : "text-danger",
            )}
          />
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="truncate font-body text-[14px] font-medium text-text-primary">
            {transaction.description}
          </span>
          <span className="font-body text-[12px] text-text-muted">
            {income ? "Income" : "Expense"} · {transaction.currency}
          </span>
        </span>
      </span>

      <span
        className={cx(
          "shrink-0 font-data text-[15px] font-semibold tabular-nums",
          income ? "text-positive" : "text-text-primary",
        )}
      >
        {formatSignedMoney(transaction.amount, transaction.type)}
      </span>
    </li>
  );
}
