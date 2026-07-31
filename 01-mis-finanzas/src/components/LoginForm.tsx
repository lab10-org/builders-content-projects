import { type FormEvent, useState } from "react";
import Link from "next/link";

import type { CredentialsError, CredentialsField } from "../domain/credentials";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { PasswordField } from "./ui/PasswordField";
import { TextField } from "./ui/TextField";

export interface LoginSubmission {
  email: string;
  password: string;
  /** The "Remember me" checkbox: keep the session past this tab. */
  remember: boolean;
}

const EMPTY = { email: "", password: "" };

/**
 * The login screen's 420px form column.
 *
 * Props-driven in the same shape as `ExpenseForm`: this component owns the typed
 * values and the remember flag, the caller owns validation, persistence and
 * navigation. Nothing is cleared on success — unlike `ExpenseForm` — because a
 * successful sign-in navigates away, and clearing would only flash empty
 * inputs on the way out.
 *
 * `onSubmit` may return a promise, and the only thing this form does with it is
 * wait: a sign-in is a round trip with nothing on screen to show for it, so
 * without the wait a user who clicks again fires a second concurrent attempt
 * whose result races the first.
 */
export function LoginForm({
  onSubmit,
  errors = [],
  saveError = null,
}: {
  onSubmit: (submission: LoginSubmission) => void | Promise<void>;
  errors?: CredentialsError[];
  saveError?: string | null;
}) {
  const [values, setValues] = useState(EMPTY);
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    try {
      await onSubmit({ ...values, remember });
    } finally {
      // Released even on a rejection: the caller reports the failure, and a
      // form the user can never resubmit would be the worse outcome.
      setPending(false);
    }
  }

  function update(field: keyof typeof EMPTY, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /** `undefined` — not `""` — so `TextField` omits the aria attributes. */
  function errorFor(field: CredentialsField): string | undefined {
    return errors.find((error) => error.field === field)?.message;
  }

  return (
    <form
      // noValidate, and no `required`/`type="email"` constraint enforcement:
      // the browser must not block submission of invalid values, or
      // `validateCredentials` would never get to report on them.
      noValidate
      className="flex w-full max-w-[420px] flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-[30px] font-semibold text-text-primary">
          Welcome back
        </h1>
        <p className="font-body text-[15px] leading-normal text-text-secondary">
          Sign in to continue building your Northstar plan.
        </p>
      </header>

      {/* 18px between fields, per the design's Fields frame. */}
      <div className="flex flex-col gap-[18px]">
        <TextField
          id="email"
          label="Email"
          // `type="email"` for the mobile keyboard; `noValidate` above keeps the
          // browser from acting on it.
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
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(event) => update("password", event.target.value)}
          error={errorFor("password")}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* 10px gap, per the design's Remember Me frame. */}
        <Checkbox
          id="remember"
          label="Remember me"
          checked={remember}
          onCheckedChange={setRemember}
          className="gap-2.5"
        />
        <button
          type="button"
          className="cursor-pointer font-body text-[14px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Forgot password?
        </button>
      </div>

      {saveError !== null && (
        <p role="alert" className="font-body text-[14px] text-danger">
          {saveError}
        </p>
      )}

      <Button type="submit" variant="block" disabled={pending}>
        Sign in
      </Button>

      <p className="flex justify-center gap-1.5 font-body text-[14px]">
        <span className="text-text-secondary">New here?</span>
        <Link
          href="/signup"
          className="cursor-pointer font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
