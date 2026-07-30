// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_KEY, loadSession } from "../../src/storage/sessionStorage";
import Login from "./page";

// Hoisted so `vi.mock` (which runs before the imports) can close over it.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signIn({
  email = "ana@example.com",
  password = "s3cret",
  remember = false,
}: { email?: string; password?: string; remember?: boolean } = {}) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  if (remember) {
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("the brand panel", () => {
  it("carries the design's tagline and supporting copy", () => {
    render(<Login />);

    expect(
      screen.getByText("Build the financial future you deserve."),
    ).toBeDefined();
    expect(screen.getByText(/turns everyday money decisions/)).toBeDefined();
  });

  it("does not put a heading before the page's own h1", () => {
    // The tagline renders above "Welcome back" in the DOM, so marking it up as a
    // heading would open the document with an <h2>.
    render(<Login />);

    const headings = screen.getAllByRole("heading");

    expect(headings).toHaveLength(1);
    expect(headings[0].tagName).toBe("H1");
    expect(headings[0].textContent).toBe("Welcome back");
  });

  it("lists all three reassurances as a list, not loose text", () => {
    render(<Login />);

    const points = screen.getAllByRole("listitem");

    expect(points.map((point) => point.textContent)).toEqual([
      "Bank-level encryption on every connection",
      "No hidden fees, ever",
      "Cancel anytime — your data stays yours",
    ]);
  });

  it("names the product", () => {
    render(<Login />);

    expect(screen.getByText("Northstar")).toBeDefined();
  });
});

describe("a valid sign-in", () => {
  it("records who signed in", () => {
    render(<Login />);

    signIn();

    expect(loadSession()).toEqual({ email: "ana@example.com" });
  });

  it("stores the normalized email, not the raw input", () => {
    render(<Login />);

    signIn({ email: "  Ana@Example.COM  " });

    expect(loadSession()).toEqual({ email: "ana@example.com" });
  });

  it("continues to the next onboarding step", () => {
    render(<Login />);

    signIn();

    expect(push).toHaveBeenCalledWith("/onboarding/profile");
  });

  it("persists the session across restarts when remember is checked", () => {
    render(<Login />);

    signIn({ remember: true });

    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it("keeps the session to the tab when remember is left unchecked", () => {
    render(<Login />);

    signIn({ remember: false });

    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe("an invalid sign-in", () => {
  it("explains what is wrong with the email", () => {
    render(<Login />);

    signIn({ email: "not-an-email" });

    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
  });

  it("explains a missing password", () => {
    render(<Login />);

    signIn({ password: "" });

    expect(screen.getByText("Enter your password.")).toBeDefined();
  });

  it("signs nobody in", () => {
    render(<Login />);

    signIn({ email: "not-an-email" });

    expect(loadSession()).toBeNull();
  });

  it("stays on the page", () => {
    render(<Login />);

    signIn({ email: "not-an-email" });

    expect(push).not.toHaveBeenCalled();
  });

  it("stops annotating a field once it is corrected", () => {
    // Errors are recomputed per submission rather than accumulated, so a fixed
    // field must lose its message.
    render(<Login />);

    signIn({ email: "not-an-email", password: "" });
    expect(screen.getByText("Enter a valid email address.")).toBeDefined();

    signIn({ email: "ana@example.com", password: "" });

    expect(screen.queryByText("Enter a valid email address.")).toBeNull();
    expect(screen.getByText("Enter your password.")).toBeDefined();
  });
});

describe("when the session cannot be stored", () => {
  it("tells the user instead of pretending it worked", () => {
    // Private-mode Safari and a full quota both make setItem throw.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Login />);

    signIn();

    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("does not continue to the next step", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Login />);

    signIn();

    expect(push).not.toHaveBeenCalled();
  });

  it("drops the failure notice once a later attempt is merely invalid", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Login />);

    signIn();
    expect(screen.getByRole("alert")).toBeDefined();

    signIn({ email: "not-an-email" });

    // No write was even attempted this time, so the old failure no longer
    // describes anything on screen.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
