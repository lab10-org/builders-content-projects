"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BrandPanel } from "../../src/components/BrandPanel";
import { LoginForm, type LoginSubmission } from "../../src/components/LoginForm";
import { signIn } from "../../src/auth/actions";
import { runAuthAction } from "../../src/auth/runAuthAction";
import {
  type CredentialsError,
  validateCredentials,
} from "../../src/domain/credentials";

export default function Login() {
  const router = useRouter();
  const [errors, setErrors] = useState<CredentialsError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit({
    email,
    password,
    remember,
  }: LoginSubmission): Promise<void> {
    // Cleared before anything else: from here on, whatever is on screen must
    // describe *this* attempt, never the previous one.
    setErrors([]);
    setSaveError(null);

    const result = validateCredentials({ email, password });
    if (!result.ok) {
      // Recomputed from this result, never accumulated, so a corrected field
      // stops being annotated. Nothing was sent, so nothing navigates.
      setErrors(result.errors);
      return;
    }

    // Through `runAuthAction`, so an action that rejects instead of returning
    // still reaches the user as a banner rather than as a dead button.
    const outcome = await runAuthAction(() =>
      // The normalized email, and the password exactly as typed.
      signIn({
        email: result.credentials.email,
        password: result.credentials.password,
        remember,
      }),
    );

    if (!outcome.ok) {
      // The copy comes from the action; this page spells no failure message of
      // its own. A failure never navigates: the session does not exist.
      if (outcome.failure.kind === "banner") setSaveError(outcome.failure.message);
      else setErrors([outcome.failure]);
      return;
    }

    router.push("/onboarding/profile");
    // The session cookies were written by the server during the action, so the
    // next server render has to be asked for — otherwise it is still the
    // signed-out one.
    router.refresh();
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
