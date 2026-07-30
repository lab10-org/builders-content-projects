// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

const onSubmit = vi.fn(() => true);

beforeEach(() => {
  onSubmit.mockClear();
  onSubmit.mockReturnValue(true);
});

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
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

  it("uses the design's email placeholder", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    expect(screen.getByLabelText("Email").getAttribute("placeholder")).toBe(
      "you@example.com",
    );
  });
});

describe("submitting", () => {
  it("hands the typed values to the caller", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    type("Email", "ana@example.com");
    type("Password", "s3cret");
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "s3cret",
      remember: false,
    });
  });

  it("does not navigate away, so the submit default is prevented", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    const form = screen.getByRole("button", { name: "Sign in" }).closest("form");
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("submits empty values too — the domain validates, not the browser", () => {
    // Mirrors ExpenseForm: native constraint validation would stop the request
    // before `validateCredentials` ever saw it, so there would be nothing to
    // report back.
    render(<LoginForm onSubmit={onSubmit} />);

    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      email: "",
      password: "",
      remember: false,
    });
  });

  it("keeps what the user typed when the caller rejects the submission", () => {
    onSubmit.mockReturnValue(false);
    render(<LoginForm onSubmit={onSubmit} />);

    type("Email", "nope");
    type("Password", "s3cret");
    submit();

    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe("nope");
    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe(
      "s3cret",
    );
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

  it("travels with the submission once checked", () => {
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    submit();

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
