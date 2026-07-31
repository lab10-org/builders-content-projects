// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signUp as signUpAction } from "../../src/auth/actions";
import Signup from "./page";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("../../src/auth/actions", () => ({ signUp: vi.fn() }));

const signUp = vi.mocked(signUpAction);

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  signUp.mockReset();
  signUp.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function submit({
  email = "ana@example.com",
  password = "s3cret-pass",
}: { email?: string; password?: string } = {}) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("the screen", () => {
  // 2.9: the same two-panel split as /login, brand panel included.
  it("mirrors the sign-in layout", () => {
    render(<Signup />);

    expect(
      screen.getByText("Build the financial future you deserve."),
    ).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeDefined();
  });

  it("opens the document with exactly one heading", () => {
    render(<Signup />);

    const headings = screen.getAllByRole("heading");

    expect(headings).toHaveLength(1);
    expect(headings[0].tagName).toBe("H1");
  });

  // The href only, never a click: navigation is next/link's job.
  it("offers the way back to sign-in (2.2)", () => {
    render(<Signup />);

    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
    ).toBe("/login");
  });
});

describe("a valid registration", () => {
  it("registers the normalized email with the password verbatim (2.3)", async () => {
    render(<Signup />);

    submit({ email: "  Ana@Example.COM ", password: "s3cret-pass" });

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "s3cret-pass",
    });
  });

  // 2.4: no confirmation step stands between registering and using the app.
  it("continues straight to the next onboarding step (2.4)", async () => {
    render(<Signup />);

    submit();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/onboarding/profile"),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/confirm/i)).toBeNull();
  });
});

describe("an invalid registration", () => {
  it("annotates a malformed email and contacts nobody (2.5)", () => {
    render(<Signup />);

    submit({ email: "not-an-email" });

    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("annotates a password below the minimum and contacts nobody (2.6)", () => {
    render(<Signup />);

    submit({ password: "12345" });

    expect(
      screen.getByText("Password must be at least 6 characters."),
    ).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("when the auth service refuses the registration", () => {
  const alreadyRegistered = {
    ok: false as const,
    failure: {
      kind: "banner" as const,
      message: "That email is already registered. Sign in instead.",
    },
  };

  it("announces it and stays put (2.7, 4.2, 4.7)", async () => {
    signUp.mockResolvedValue(alreadyRegistered);
    render(<Signup />);

    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "That email is already registered. Sign in instead.",
    );
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  // 2.8: a refusal must not cost the user what they typed.
  it("leaves the typed values in place", async () => {
    signUp.mockResolvedValue(alreadyRegistered);
    render(<Signup />);

    submit({ email: "ana@example.com", password: "s3cret-pass" });

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email").getAttribute("value")).toBe(
      "ana@example.com",
    );
    expect(screen.getByLabelText("Password").getAttribute("value")).toBe(
      "s3cret-pass",
    );
  });

  it("lands a weak-password failure on the password field (4.3)", async () => {
    signUp.mockResolvedValue({
      ok: false,
      failure: {
        kind: "field",
        field: "password",
        message: "Password should be at least 8 characters",
      },
    });
    render(<Signup />);

    submit();

    await screen.findByText("Password should be at least 8 characters");
    expect(
      screen.getByLabelText("Password").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the previous failure when a new attempt is submitted (4.8)", async () => {
    signUp.mockResolvedValue(alreadyRegistered);
    render(<Signup />);

    submit();
    await screen.findByRole("alert");

    let resolve: (value: { ok: true }) => void = () => {};
    signUp.mockReturnValue(
      new Promise<{ ok: true }>((r) => {
        resolve = r;
      }),
    );
    submit();

    expect(screen.queryByRole("alert")).toBeNull();
    resolve({ ok: true });
  });
});
