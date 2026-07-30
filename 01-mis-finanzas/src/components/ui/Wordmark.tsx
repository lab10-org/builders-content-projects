import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * The product mark, in the two forms the mockup uses.
 *
 * NOTE: the design deliberately draws a *different* glyph in each place — a
 * compass on the login brand panel, a star in the onboarding header — and sizes
 * the name differently too (22px vs 20px). Both are reproduced faithfully, but
 * two marks for one brand is worth confirming with the designer.
 */
export type WordmarkTone = "default" | "inverse";

const TONES = {
  // Onboarding header: 20px star in accent, 20px/600 name in text-primary.
  default: {
    wrapper: "gap-2 text-text-primary",
    icon: "size-5 text-accent",
    name: "text-[20px]",
    glyph: "star",
  },
  // Login brand panel, on teal: 28px compass and 22px/600 name, both white.
  inverse: {
    wrapper: "gap-2.5 text-text-inverse",
    icon: "size-7",
    name: "text-[22px]",
    glyph: "compass",
  },
} as const;

export function Wordmark({
  tone = "default",
  className,
}: {
  tone?: WordmarkTone;
  className?: string;
}) {
  const style = TONES[tone];

  return (
    <div className={cx("inline-flex items-center", style.wrapper, className)}>
      <Icon name={style.glyph} className={cx("shrink-0", style.icon)} />
      <span className={cx("font-heading font-semibold", style.name)}>
        Northstar
      </span>
    </div>
  );
}
