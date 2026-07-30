import type { ButtonHTMLAttributes } from "react";

import { cx } from "./cx";

/**
 * The three button shapes in `onboarding.pen`:
 * - `block` — the login screen's full-width "Sign in" (radius-lg, 16px/600)
 * - `pill`  — the profile screen's "Continue" (radius-full, 15px/600)
 * - `ghost` — the profile screen's "Back", no fill (radius-full, 15px/500)
 */
export type ButtonVariant = "block" | "pill" | "ghost";

const BASE =
  "inline-flex items-center justify-center font-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

// Padding and gap values are the design's, in px, rather than the nearest
// Tailwind step — `py-[13px]` really is 13px in the mockup.
const VARIANTS: Record<ButtonVariant, string> = {
  block:
    "w-full gap-2 rounded-lg bg-accent p-4 text-[16px] font-semibold text-text-inverse hover:bg-accent/90",
  pill: "gap-2 rounded-full bg-accent px-[26px] py-[13px] text-[15px] font-semibold text-text-inverse hover:bg-accent/90",
  ghost:
    "gap-1.5 rounded-full px-[18px] py-3 text-[15px] font-medium text-text-secondary hover:bg-surface-soft",
};

/**
 * `type` defaults to `"button"`, not the HTML default of `"submit"`.
 *
 * The profile footer places Back beside Continue inside the same form, so an
 * implicit submit would let the wrong button send it. Submitting is opt-in via
 * `type="submit"`.
 */
export function Button({
  variant = "block",
  type = "button",
  className,
  ...props
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(BASE, VARIANTS[variant], className)}
      {...props}
    />
  );
}
