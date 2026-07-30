import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * The login screen's "Remember me": an 18px box with a 1px border, plus a
 * 14px label in text-secondary, 8px apart.
 *
 * The real `<input>` is visually hidden rather than replaced, so the control
 * keeps its native role, checked state, keyboard behaviour and label
 * association; the `<span>` beside it is only paint.
 *
 * NOTE: the box uses `radius-lg` (8px) because that is what the `.pen` assigns
 * it — on an 18px box that reads as very nearly a circle, which is a shape
 * normally reserved for radios. Worth confirming with the designer; the fix is
 * this one class.
 */
export function Checkbox({
  id,
  label,
  checked,
  onCheckedChange,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cx(
        "inline-flex cursor-pointer items-center gap-2 select-none",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        // Always defined, even when the caller passes no handler, so React never
        // sees a controlled input without `onChange`.
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className="peer sr-only"
      />

      <span
        className={cx(
          "flex size-[18px] shrink-0 items-center justify-center rounded-lg border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          checked ? "border-accent bg-accent" : "border-border bg-surface",
        )}
      >
        {/* Heavier stroke: at 12px the 2px default reads thin against accent. */}
        {checked && (
          <Icon
            name="check"
            className="size-3 text-text-inverse"
            strokeWidth={3}
          />
        )}
      </span>

      <span className="font-body text-[14px] text-text-secondary">{label}</span>
    </label>
  );
}
