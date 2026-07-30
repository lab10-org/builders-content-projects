import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * The product mark, in the three forms the mockup uses.
 *
 * NOTE: the design draws the mark differently on almost every screen — a white
 * compass on the login panel, an accent *star* in the profile header, an accent
 * *compass* in the "Know me" and "Plan" headers — and sizes the name 22/20/20px
 * respectively. All three are reproduced faithfully, but one brand with two
 * glyphs and three treatments is worth settling with the designer.
 */
export type WordmarkTone = "default" | "brand" | "inverse";

const TONES = {
  // Profile header (screen 2): 20px star in accent.
  default: {
    wrapper: "gap-2 text-text-primary",
    icon: "size-5 text-accent",
    name: "text-[20px]",
    glyph: "star",
  },
  // Know me / Plan headers (screens 3 and 4): the compass, in accent.
  brand: {
    wrapper: "gap-2 text-text-primary",
    icon: "size-[22px] text-accent",
    name: "text-[20px]",
    glyph: "compass",
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
