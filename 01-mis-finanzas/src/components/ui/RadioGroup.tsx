import { Icon } from "./icons";
import { cx } from "./cx";

export interface Option {
  value: string;
  label: string;
}

/**
 * The stacked option rows of the "primary financial goal" card.
 *
 * Selected: surface-soft fill, 2px accent border, filled accent dot with a white
 * check, label at 600. Unselected: white fill, 1px border, hollow dot, label at
 * regular weight. Rows are 8px apart.
 *
 * Each row is a `<label>` around a visually hidden native radio, so the browser
 * — not this component — enforces single selection, arrow-key navigation and the
 * announced role. Because Preflight sets `box-sizing: border-box`, swapping the
 * 1px border for 2px on selection does not resize the row.
 */
export function RadioGroup({
  name,
  options,
  value,
  onChange,
  "aria-labelledby": labelledBy,
}: {
  name: string;
  options: readonly Option[];
  value: string | null;
  onChange: (value: string) => void;
  "aria-labelledby": string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <label
            key={option.value}
            className={cx(
              "flex cursor-pointer items-center gap-3 rounded-xl px-[14px] py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              selected
                ? "border-2 border-accent bg-surface-soft"
                : "border border-border bg-surface hover:border-text-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />

            <span
              className={cx(
                "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                selected
                  ? "bg-accent"
                  : "border-[1.5px] border-text-muted bg-surface",
              )}
            >
              {selected && (
                <Icon
                  name="check"
                  className="size-[13px] text-text-inverse"
                  strokeWidth={3}
                />
              )}
            </span>

            <span
              className={cx(
                "font-body text-[15px] text-text-primary",
                selected && "font-semibold",
              )}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
