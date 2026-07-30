import type { Highlight, HighlightKind } from "../../domain/snapshot";
import { type IconName, Icon } from "./icons";
import { cx } from "./cx";

/**
 * The "Highlights" list. Each kind gets the glyph and colour the design assigns
 * it, so the icon reinforces what the sentence says rather than decorating it.
 */
const STYLES: Record<HighlightKind, { icon: IconName; className: string }> = {
  trend: { icon: "trending-up", className: "text-text-secondary" },
  composition: { icon: "chart-pie", className: "text-text-secondary" },
  warning: { icon: "triangle-alert", className: "text-danger" },
};

export function HighlightList({
  highlights,
}: {
  highlights: readonly Highlight[];
}) {
  if (highlights.length === 0) return null;

  return (
    <div className="flex flex-col gap-[9px]">
      <h3 className="font-body text-[13px] font-semibold text-text-secondary">
        Highlights
      </h3>

      <ul className="flex flex-col gap-[9px]">
        {highlights.map((highlight) => {
          const style = STYLES[highlight.kind];

          return (
            <li key={highlight.text} className="flex items-start gap-[9px]">
              <Icon
                name={style.icon}
                className={cx("mt-px size-4 shrink-0", style.className)}
              />
              <span className="font-body text-[13px] leading-[1.35] text-text-secondary">
                {highlight.text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
