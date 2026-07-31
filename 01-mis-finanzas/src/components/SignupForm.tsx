import { useState } from "react";
import Link from "next/link";

import type { CredentialsError, CredentialsField } from "../domain/credentials";
import { Button } from "./ui/Button";
import { PasswordField } from "./ui/PasswordField";
import { TextField } from "./ui/TextField";

export interface SignupSubmission {
  email: string;
  password: string;
}

const EMPTY = { email: "", password: "" };

/**
 * The sign-up screen's 420px form column — `LoginForm`'s sibling, not its
 * second mode: the two differ in copy, in fields and in controls, and one
 * component with a mode flag would make every branch conditional and every
 * test parameterized.
 *
 * Props-driven the same way: this component owns the typed values, the caller
 * owns validation, the call and navigation. It performs no validation of its
 * own and never clears itself — a failed registration must leave the user
 * looking at what they typed.
 */
export function SignupForm({
  onSubmit,
  errors = [],
  saveError = null,
}: {
  onSubmit: (submission: SignupSubmission) => void;
  errors?: CredentialsError[];
  saveError?: string | null;
}) {
  const [values, setValues] = useState(EMPTY);

  function update(field: keyof typeof EMPTY, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /** `undefined` — not `""` — so `TextField` omits the aria attributes. */
  function errorFor(field: CredentialsField): string | undefined {
    return errors.find((error) => error.field === field)?.message;
  }

  return (
    <form
      // noValidate, as in `LoginForm`: the browser must not block submission of
      // invalid values, or `validateNewCredentials` would never see them.
      noValidate
      className="flex w-full max-w-[420px] flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...values });
      }}
    >
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-[30px] font-semibold text-text-primary">
          Create your account
        </h1>
        <p className="font-body text-[15px] leading-normal text-text-secondary">
          Start building your Northstar plan.
        </p>
      </header>

      {/* 18px between fields, matching the sign-in column. */}
      <div className="flex flex-col gap-[18px]">
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          error={errorFor("email")}
        />

        <PasswordField
          id="password"
          label="Password"
          // `new-password`, not `current-password`: this is where a password
          // manager should offer to generate one.
          autoComplete="new-password"
          placeholder="Create a password"
          value={values.password}
          onChange={(event) => update("password", event.target.value)}
          error={errorFor("password")}
        />
      </div>

      {saveError !== null && (
        <p role="alert" className="font-body text-[14px] text-danger">
          {saveError}
        </p>
      )}

      <Button type="submit" variant="block">
        Create account
      </Button>

      <p className="flex justify-center gap-1.5 font-body text-[14px]">
        <span className="text-text-secondary">Already have an account?</span>
        <Link
          href="/login"
          className="cursor-pointer font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
