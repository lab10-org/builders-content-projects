import { Icon } from "./ui/icons";
import { Wordmark } from "./ui/Wordmark";

/** Verbatim from the design's Reassurance frame. */
const REASSURANCES = [
  "Bank-level encryption on every connection",
  "No hidden fees, ever",
  "Cancel anytime — your data stays yours",
];

/**
 * The teal half of the split, shared by `/login` and `/signup`. Hidden below
 * `lg`, where the form takes the full width: it is pure reassurance copy, and
 * on a phone it would push the actual fields below the fold.
 */
export function BrandPanel() {
  return (
    <section className="hidden flex-1 flex-col justify-between rounded-2xl bg-surface-inverse p-14 lg:flex">
      <Wordmark tone="inverse" />

      <div className="flex flex-col gap-5">
        {/* Display copy, not a heading: it precedes the form's <h1> in the DOM,
            so marking it up as one would put an <h2> before the page's only
            <h1> and break the heading outline. Nothing is lost — a screen
            reader still reads it, it just no longer claims to be structure. */}
        <p className="font-heading text-[40px] leading-[1.15] font-semibold text-text-inverse">
          Build the financial future you deserve.
        </p>
        <p className="max-w-[548px] font-body text-[16px] leading-normal text-surface-sage">
          Northstar turns everyday money decisions into a clear, guided plan — so
          you always know your next step.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {REASSURANCES.map((point) => (
          <li key={point} className="flex items-center gap-3">
            {/* The dot is accent on an accent panel — invisible by design, so
                only the white check reads. Kept for fidelity and spacing. */}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent">
              <Icon name="check" className="size-3.5 text-text-inverse" />
            </span>
            <span className="font-body text-[15px] text-text-inverse">
              {point}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
