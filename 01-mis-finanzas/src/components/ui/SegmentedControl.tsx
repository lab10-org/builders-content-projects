import type { Option } from "./RadioGroup";
import { cx } from "./cx";

/**
 * The risk-tolerance selector: a surface-soft track with 4px padding and 4px
 * between segments, each segment sharing the width equally. The selected segment
 * gets an accent fill and a 600-weight white label; the others stay transparent
 * with an accent label at 500.
 *
 * Radios rather than buttons — the three levels are mutually exclusive, so this
 * is the same control as `RadioGroup` wearing different paint, and it should be
 * announced and keyboard-navigated the same way.
 */
export function SegmentedControl({
  name,
  options,
  value,
  onChange,
  "aria-labelledby": labelledBy,
}: {
  name: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
  "aria-labelledby": string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex gap-1 rounded-xl bg-surface-soft p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <label
            key={option.value}
            className={cx(
              "flex flex-1 cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              selected ? "bg-accent" : "hover:bg-surface",
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
                "font-body text-[14px]",
                selected
                  ? "font-semibold text-text-inverse"
                  : "font-medium text-text-secondary",
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
