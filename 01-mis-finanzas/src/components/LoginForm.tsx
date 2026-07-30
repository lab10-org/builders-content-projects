import { useState } from "react";

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
 * navigation. `onSubmit` returns whether the submission was accepted — but
 * unlike `ExpenseForm` nothing is cleared on success, because a successful
 * sign-in navigates away and clearing would only flash empty inputs first.
 */
export function LoginForm({
  onSubmit,
  errors = [],
  saveError = null,
}: {
  onSubmit: (submission: LoginSubmission) => boolean;
  errors?: CredentialsError[];
  saveError?: string | null;
}) {
  const [values, setValues] = useState(EMPTY);
  const [remember, setRemember] = useState(false);

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
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...values, remember });
      }}
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

      <Button type="submit" variant="block">
        Sign in
      </Button>

      <p className="flex justify-center gap-1.5 font-body text-[14px]">
        <span className="text-text-secondary">New here?</span>
        <button
          type="button"
          className="cursor-pointer font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Create an account
        </button>
      </p>
    </form>
  );
}
