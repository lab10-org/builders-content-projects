import { cx } from "./cx";

/**
 * One figure of the snapshot grid: a large mono value over a small caption.
 *
 * The design fills the first tile ("Total balance") with the inverse surface and
 * leaves the other three white, which is what `tone` selects.
 *
 * Proportional figures, not `tabular-nums`: these are standalone display numbers,
 * and equal-width digits make them look loose at this size.
 */
export function StatTile({
  value,
  caption,
  tone = "default",
}: {
  value: string;
  caption: string;
  tone?: "default" | "inverse";
}) {
  const inverse = tone === "inverse";

  return (
    <div
      className={cx(
        "flex flex-1 flex-col gap-1 rounded-xl p-[14px] shadow-sm",
        inverse ? "bg-surface-inverse" : "bg-surface",
      )}
    >
      <span
        className={cx(
          "font-data text-[22px] font-semibold",
          inverse ? "text-text-inverse" : "text-text-primary",
        )}
      >
        {value}
      </span>
      <span
        className={cx(
          "font-body text-[12px]",
          inverse ? "text-surface-sage" : "text-text-muted",
        )}
      >
        {caption}
      </span>
    </div>
  );
}
