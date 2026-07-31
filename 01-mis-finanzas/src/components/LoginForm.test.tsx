// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

const onSubmit = vi.fn<(submission: unknown) => void | Promise<void>>();

beforeEach(() => {
  onSubmit.mockReset();
});

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/**
 * Awaited, because the form now awaits `onSubmit`: the state that re-enables
 * the button settles a microtask later, and asserting before that would read
 * the form mid-submission.
 */
async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  });
}

describe("copy from the design", () => {
  it("renders the heading and subtitle verbatim", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeDefined();
    expect(
      screen.getByText("Sign in to continue building your Northstar plan."),
    ).toBeDefined();
  });

  it("offers the account-recovery and sign-up routes", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(screen.getByText("Forgot password?")).toBeDefined();
    expect(screen.getByText("Create an account")).toBeDefined();
  });

  // The href only, never a click: navigation is next/link's job and needs the
  // App Router context, and the routing itself is Next's, not ours.
  it("routes to the sign-up screen through a real link", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(
      screen.getByRole("link", { name: "Create an account" }).getAttribute("href"),
    ).toBe("/signup");
    expect(
      screen.queryByRole("button", { name: "Create an account" }),
    ).toBeNull();
  });

  it("uses the design's email placeholder", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(screen.getByLabelText("Email").getAttribute("placeholder")).toBe(
      "you@example.com",
    );
  });
});

describe("submitting", () => {
  it("hands the typed values to the caller", async () => {
    render(<LoginForm onSubmit={onSubmit} />);

    type("Email", "ana@example.com");
    type("Password", "s3cret");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "s3cret",
      remember: false,
    });
  });

  it("does not navigate away, so the submit default is prevented", async () => {
    render(<LoginForm onSubmit={onSubmit} />);

    const form = screen.getByRole("button", { name: "Sign in" }).closest("form");
    const event = new Event("submit", { bubbles: true, cancelable: true });
    await act(async () => {
      form?.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("submits empty values too — the domain validates, not the browser", async () => {
    // Mirrors ExpenseForm: native constraint validation would stop the request
    // before `validateCredentials` ever saw it, so there would be nothing to
    // report back.
    render(<LoginForm onSubmit={onSubmit} />);

    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      email: "",
      password: "",
      remember: false,
    });
  });

  it("keeps what the user typed when the caller rejects the submission", async () => {
    render(<LoginForm onSubmit={onSubmit} />);

    type("Email", "nope");
    type("Password", "s3cret");
    await submit();

    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe("nope");
    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe(
      "s3cret",
    );
  });
});

describe("a submission in flight", () => {
  /** A submission that has been started and can be finished on demand. */
  function deferred() {
    let finish = () => {};
    const settled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    onSubmit.mockReturnValue(settled);
    return { finish, settled };
  }

  it("disables the button until the caller is done", async () => {
    const { finish, settled } = deferred();
    render(<LoginForm onSubmit={onSubmit} />);

    await submit();
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Sign in",
    });
    expect(button.disabled).toBe(true);

    await act(async () => {
      finish();
      await settled;
    });
    expect(button.disabled).toBe(false);
  });

  // Two concurrent sign-ins race each other's state updates and push the user
  // towards the service's rate limit, for a click that changed nothing.
  it("ignores a second submit while the first is still running", async () => {
    const { finish, settled } = deferred();
    render(<LoginForm onSubmit={onSubmit} />);

    await submit();
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await settled;
    });
  });

  // The guard is released on every outcome, not only on success: the form is
  // never told whether the attempt worked, and one that could not be resubmitted
  // after a rejected password would be worse than the double click.
  it("takes the guard off again after a failed attempt", async () => {
    const { finish, settled } = deferred();
    render(<LoginForm onSubmit={onSubmit} />);

    await submit();
    await act(async () => {
      finish();
      await settled;
    });
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

describe("remember me", () => {
  it("starts unchecked", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Remember me" })
        .checked,
    ).toBe(false);
  });

  it("travels with the submission once checked", async () => {
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ remember: true }),
    );
  });
});

describe("errors from the caller", () => {
  it("shows an email error and points the input at it", () => {
    render(
      <LoginForm
        onSubmit={onSubmit}
        errors={[{ field: "email", message: "Enter a valid email address." }]}
      />,
    );

    const input = screen.getByLabelText("Email");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(input.getAttribute("aria-describedby") as string)
        ?.textContent,
    ).toBe("Enter a valid email address.");
  });

  it("annotates only the field that failed", () => {
    render(
      <LoginForm
        onSubmit={onSubmit}
        errors={[{ field: "password", message: "Enter your password." }]}
      />,
    );

    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("shows both messages when both fields failed", () => {
    render(
      <LoginForm
        onSubmit={onSubmit}
        errors={[
          { field: "email", message: "Enter a valid email address." },
          { field: "password", message: "Enter your password." },
        ]}
      />,
    );

    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(screen.getByText("Enter your password.")).toBeDefined();
  });

  it("announces a save failure as an alert", () => {
    render(<LoginForm onSubmit={onSubmit} saveError="Could not sign you in." />);

    expect(screen.getByRole("alert").textContent).toBe("Could not sign you in.");
  });

  it("shows no alert when nothing failed", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
