// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignupForm } from "./SignupForm";

const onSubmit = vi.fn();

beforeEach(() => {
  onSubmit.mockClear();
});

function fill({
  email = "ana@example.com",
  password = "s3cret-pass",
}: { email?: string; password?: string } = {}) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("rendering", () => {
  it("shows the sign-up copy and both fields", () => {
    render(<SignupForm onSubmit={onSubmit} />);

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeDefined();
    expect(
      screen.getByText("Start building your Northstar plan."),
    ).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDefined();
  });

  // Both belong to signing in, not to creating an account: there is no session
  // to remember yet and no password to recover.
  it("offers neither Remember me nor Forgot password", () => {
    render(<SignupForm onSubmit={onSubmit} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Forgot password?")).toBeNull();
  });

  it("routes back to sign-in through a real link", () => {
    render(<SignupForm onSubmit={onSubmit} />);

    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
    ).toBe("/login");
  });
});

describe("submitting", () => {
  it("reports the typed values exactly as typed", () => {
    render(<SignupForm onSubmit={onSubmit} />);

    fill({ email: "  Ana@Example.COM ", password: " s3cret " });
    submit();

    // The component normalizes nothing — that is the domain layer's call. The
    // email arrives without its surrounding spaces only because
    // `input[type=email]` sanitizes them in the DOM itself; the casing, which
    // no browser touches, comes through untouched. The password, on a plain
    // password input, keeps its spaces: they may well be part of it.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      email: "Ana@Example.COM",
      password: " s3cret ",
    });
  });

  it("does not reload the page", () => {
    render(<SignupForm onSubmit={onSubmit} />);
    fill();

    const event = new Event("submit", { bubbles: true, cancelable: true });
    screen.getByRole("button", { name: "Create account" }).closest("form")!
      .dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  // noValidate, mirroring LoginForm: the browser must not block the submission,
  // or validateNewCredentials would never get to report on it.
  it("submits empty fields rather than letting the browser block them", () => {
    render(<SignupForm onSubmit={onSubmit} />);

    submit();

    expect(onSubmit).toHaveBeenCalledWith({ email: "", password: "" });
  });

  it("keeps what the user typed after a submit", () => {
    render(<SignupForm onSubmit={onSubmit} />);

    fill({ email: "ana@example.com", password: "s3cret-pass" });
    submit();

    expect(screen.getByLabelText("Email").getAttribute("value")).toBe(
      "ana@example.com",
    );
    expect(screen.getByLabelText("Password").getAttribute("value")).toBe(
      "s3cret-pass",
    );
  });
});

describe("errors", () => {
  it.each([
    { field: "password" as const, other: "Email" },
    { field: "email" as const, other: "Password" },
  ])("annotates only the $field field", ({ field, other }) => {
    render(
      <SignupForm
        onSubmit={onSubmit}
        errors={[{ field, message: "Nope." }]}
      />,
    );

    const annotated = screen.getByLabelText(
      field === "email" ? "Email" : "Password",
    );
    expect(screen.getByText("Nope.")).toBeDefined();
    expect(annotated.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(other).getAttribute("aria-invalid")).toBeNull();
  });

  it("announces a submission failure without moving focus", () => {
    render(<SignupForm onSubmit={onSubmit} saveError="Boom" />);

    expect(screen.getByRole("alert").textContent).toBe("Boom");
  });

  it("shows no alert when there is nothing to announce", () => {
    render(<SignupForm onSubmit={onSubmit} saveError={null} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
