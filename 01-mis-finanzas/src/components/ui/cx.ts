/**
 * Joins class names, dropping anything falsy so a conditional can be written
 * inline as `condition && "..."`.
 *
 * Deliberately not a Tailwind-aware merger: no primitive here takes a caller
 * class that has to *override* a variant class, so the last-wins behaviour a
 * merger provides is not needed, and `clsx`/`tailwind-merge` would be a
 * dependency earning nothing.
 */
export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}
