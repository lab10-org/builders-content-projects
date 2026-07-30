"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LoginForm, type LoginSubmission } from "../../src/components/LoginForm";
import { Icon } from "../../src/components/ui/icons";
import { Wordmark } from "../../src/components/ui/Wordmark";
import {
  type CredentialsError,
  validateCredentials,
} from "../../src/domain/credentials";
import { saveSession } from "../../src/storage/sessionStorage";

const SAVE_ERROR_MESSAGE = "Could not sign you in. Please try again.";

/** Verbatim from the design's Reassurance frame. */
const REASSURANCES = [
  "Bank-level encryption on every connection",
  "No hidden fees, ever",
  "Cancel anytime — your data stays yours",
];

/**
 * The teal half of the split. Hidden below `lg`, where the form takes the full
 * width: it is pure reassurance copy, and on a phone it would push the actual
 * sign-in fields below the fold.
 */
function BrandPanel() {
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

export default function Login() {
  const router = useRouter();
  const [errors, setErrors] = useState<CredentialsError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Returns whether the submission was accepted, mirroring `ExpenseForm`. */
  function handleSubmit({
    email,
    password,
    remember,
  }: LoginSubmission): boolean {
    const result = validateCredentials({ email, password });
    if (!result.ok) {
      // Recomputed from this result, never accumulated, so a corrected field
      // stops being annotated. `saveError` is cleared too: no write was even
      // attempted, so an earlier failure no longer describes anything on screen.
      setErrors(result.errors);
      setSaveError(null);
      return false;
    }

    try {
      // The normalized email, not the raw input.
      saveSession({ email: result.credentials.email }, { remember });
    } catch {
      // Nothing navigates: a failed write must not leave the app claiming the
      // user is signed in. Every field is valid here, so stale field
      // annotations must go.
      setErrors([]);
      setSaveError(SAVE_ERROR_MESSAGE);
      return false;
    }

    setErrors([]);
    setSaveError(null);
    router.push("/onboarding/profile");
    return true;
  }

  return (
    <main className="flex min-h-full items-stretch justify-center bg-bg p-6 lg:p-12">
      <div className="flex w-full max-w-[1344px] flex-col gap-6 lg:flex-row">
        <BrandPanel />

        <section className="flex flex-1 items-center justify-center rounded-2xl bg-surface p-8 lg:p-14">
          <LoginForm
            onSubmit={handleSubmit}
            errors={errors}
            saveError={saveError}
          />
        </section>
      </div>
    </main>
  );
}
