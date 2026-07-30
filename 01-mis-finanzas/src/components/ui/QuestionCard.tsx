import type { ReactNode } from "react";

/**
 * The id of a card's heading. The control group inside the card points at it
 * with `aria-labelledby`, so a screen reader announces the question when focus
 * enters the group.
 *
 * A `<fieldset>`/`<legend>` would express the same thing with less wiring, but
 * `<legend>` is laid out specially by browsers and does not behave as a flex
 * item — `role="radiogroup"` plus this id keeps full control of the layout.
 */
export function questionLabelId(id: string): string {
  return `${id}-question`;
}

/**
 * One white card in the profile column: radius-2xl, 24px padding, 14px between
 * the header and the controls, and 4px between question and hint.
 */
export function QuestionCard({
  id,
  question,
  hint,
  children,
}: {
  id: string;
  question: string;
  /** Omitted on the risk-tolerance card, which has no hint in the design. */
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[14px] rounded-2xl bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2
          id={questionLabelId(id)}
          className="font-heading text-[18px] font-semibold text-text-primary"
        >
          {question}
        </h2>
        {hint !== undefined && (
          <p className="font-body text-[13px] text-text-muted">{hint}</p>
        )}
      </div>
      {children}
    </section>
  );
}
