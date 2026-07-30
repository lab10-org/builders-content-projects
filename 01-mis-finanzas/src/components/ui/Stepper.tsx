import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * The onboarding header's progress indicator: 24px dots joined by 28x2
 * connectors, 8px apart.
 *
 * - finished — accent fill, white check
 * - current  — white fill, 2px accent ring, accent number, 600-weight label
 * - upcoming — white fill, 1.5px grey ring, muted number and label
 *
 * A connector is tinted accent only when the step *before* it is finished, so
 * the filled track always stops where the user is.
 *
 * Numbers use the mono family, matching the design's `font-data` token.
 *
 * Below `lg` the dots are replaced by a "Step N of M" summary: four labelled
 * dots do not fit a phone header, and a truncated one communicates nothing.
 */
export function Stepper({
  steps,
  currentIndex,
}: {
  steps: readonly string[];
  /** Zero-based; every earlier step counts as finished. */
  currentIndex: number;
}) {
  return (
    <>
      <p className="font-body text-[13px] font-medium text-accent lg:hidden">
        Step {currentIndex + 1} of {steps.length}
      </p>

      <ol className="hidden items-center gap-2 lg:flex">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;

          return (
            <li
              key={step}
              // Only the step the user is on; `aria-current` is single-valued by
              // definition and a second one would make both meaningless.
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  done && "bg-accent",
                  current && "border-2 border-accent bg-surface",
                  !done && !current && "border-[1.5px] border-border bg-surface",
                )}
              >
                {done ? (
                  <Icon
                    name="check"
                    className="size-3.5 text-text-inverse"
                    strokeWidth={3}
                  />
                ) : (
                  <span
                    className={cx(
                      "font-data text-[12px]",
                      current ? "font-semibold text-accent" : "text-text-muted",
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </span>

              <span
                className={cx(
                  "font-body text-[13px]",
                  done && "text-text-secondary",
                  current && "font-semibold text-accent",
                  !done && !current && "text-text-muted",
                )}
              >
                {step}
              </span>

              {/* Rendered inside the <li> rather than between them so the list
                  has exactly one item per step. */}
              {index < steps.length - 1 && (
                <span
                  data-connector=""
                  className={cx(
                    "ml-2 h-0.5 w-7 shrink-0 rounded-full",
                    done ? "bg-accent" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
