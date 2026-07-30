import type { ReactNode } from "react";

/**
 * The seven lucide glyphs `docs/mockups/onboarding.pen` references, inlined.
 *
 * Inlining rather than depending on `lucide-react` is deliberate: the whole
 * design needs seven paths, and the project's rule is to avoid dependencies
 * that carry no weight. Geometry is copied verbatim from lucide so the shapes
 * stay recognisable — do not hand-tune these paths.
 */
export const ICON_NAMES = [
  "compass",
  "star",
  "check",
  "eye",
  "eye-off",
  "arrow-left",
  "arrow-right",
  "plus",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const GEOMETRY: Record<IconName, ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    </>
  ),
  star: (
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.11a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.895a.53.53 0 0 1 .294-.905l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
};

/**
 * Colour comes from the surrounding `text-*` class via `currentColor`, and size
 * from the caller's `className` — the design uses the same glyph at 13px inside
 * a radio dot and at 28px in the login wordmark.
 *
 * Pass `title` only for an icon that is the *sole* content of a control (the
 * password reveal button). Every other icon in both screens sits beside a
 * visible label, where announcing it would just duplicate that label.
 */
export function Icon({
  name,
  className,
  title,
  strokeWidth = 2,
}: {
  name: IconName;
  className?: string;
  title?: string;
  strokeWidth?: number;
}) {
  const labelled = title !== undefined;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(labelled ? { role: "img" } : { "aria-hidden": true })}
    >
      {labelled && <title>{title}</title>}
      {GEOMETRY[name]}
    </svg>
  );
}
