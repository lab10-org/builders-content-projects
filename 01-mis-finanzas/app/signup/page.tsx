"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signUp } from "../../src/auth/actions";
import { BrandPanel } from "../../src/components/BrandPanel";
import {
  SignupForm,
  type SignupSubmission,
} from "../../src/components/SignupForm";
import {
  type CredentialsError,
  validateNewCredentials,
} from "../../src/domain/credentials";

/**
 * The sign-up screen: the mirror of `/login`, against `validateNewCredentials`
 * and the `signUp` action.
 *
 * Because the local stack has email confirmations disabled, a successful
 * registration already carries a session, so it lands on the same onboarding
 * step a sign-in does — no confirmation screen in between.
 */
export default function Signup() {
  const router = useRouter();
  const [errors, setErrors] = useState<CredentialsError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit({
    email,
    password,
  }: SignupSubmission): Promise<void> {
    // Cleared first: from here on, what is on screen describes *this* attempt.
    setErrors([]);
    setSaveError(null);

    const result = validateNewCredentials({ email, password });
    if (!result.ok) {
      // Nothing was sent, so nothing navigates.
      setErrors(result.errors);
      return;
    }

    const outcome = await signUp({
      // The normalized email, and the password exactly as typed.
      email: result.credentials.email,
      password: result.credentials.password,
    });

    if (!outcome.ok) {
      // The copy comes from the action; this page spells no failure message of
      // its own. No account, no session, no navigation.
      if (outcome.failure.kind === "banner") {
        setSaveError(outcome.failure.message);
      } else {
        setErrors([outcome.failure]);
      }
      return;
    }

    router.push("/onboarding/profile");
    // The session cookies were written by the server during the action, so the
    // next server render has to be asked for.
    router.refresh();
  }

  return (
    <main className="flex min-h-full items-stretch justify-center bg-bg p-6 lg:p-12">
      <div className="flex w-full max-w-[1344px] flex-col gap-6 lg:flex-row">
        <BrandPanel />

        <section className="flex flex-1 items-center justify-center rounded-2xl bg-surface p-8 lg:p-14">
          <SignupForm
            onSubmit={handleSubmit}
            errors={errors}
            saveError={saveError}
          />
        </section>
      </div>
    </main>
  );
}
