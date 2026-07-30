import type { Option } from "./RadioGroup";
import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * The income-source chips: pill shaped, 9px/14px padding, 10px apart.
 *
 * Selected: surface-soft fill, 2px accent border, accent check, label at 600.
 * Unselected: white fill, 1px border, muted plus, label at regular weight.
 *
 * Checkboxes, not radios — the design's hint is "Select all that apply".
 *
 * The design lays the six chips out as two fixed rows of three because Pencil
 * has no line wrapping. Here they wrap, which is the same result at 760px and a
 * far better one on a phone.
 */
export function ChipGroup({
  options,
  selected,
  onChange,
  "aria-labelledby": labelledBy,
}: {
  options: readonly Option[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
  "aria-labelledby": string;
}) {
  function toggle(value: string) {
    // Rebuilt from `options` rather than appended to, so the result is always in
    // the design's order regardless of the order the user tapped things.
    const next = selected.includes(value)
      ? selected.filter((current) => current !== value)
      : [...selected, value];

    onChange(options.map((option) => option.value).filter((v) => next.includes(v)));
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2.5"
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.value);

        return (
          <label
            key={option.value}
            className={cx(
              "flex cursor-pointer items-center gap-2 rounded-full px-[14px] py-[9px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              isSelected
                ? "border-2 border-accent bg-surface-soft"
                : "border border-border bg-surface hover:border-text-muted",
            )}
          >
            <input
              type="checkbox"
              value={option.value}
              checked={isSelected}
              onChange={() => toggle(option.value)}
              className="sr-only"
            />
            {/* The glyph doubles as the affordance: a plus invites adding, a
                check confirms it is already counted. */}
            <Icon
              name={isSelected ? "check" : "plus"}
              className={cx(
                "size-[15px] shrink-0",
                isSelected ? "text-accent" : "text-text-muted",
              )}
            />
            <span
              className={cx(
                "font-body text-[14px]",
                isSelected
                  ? "font-semibold text-text-primary"
                  : "text-text-secondary",
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
