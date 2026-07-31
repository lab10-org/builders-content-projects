// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signIn as signInAction } from "../../src/auth/actions";
import Login from "./page";

// Hoisted so `vi.mock` (which runs before the imports) can close over them.
const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("../../src/auth/actions", () => ({ signIn: vi.fn() }));

const signIn = vi.mocked(signInAction);

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  signIn.mockReset();
  signIn.mockResolvedValue({ ok: true });
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function submit({
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
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  });
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
  it("authenticates the normalized email, not the raw input (1.1)", async () => {
    render(<Login />);

    await submit({ email: "  Ana@Example.COM " });

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "s3cret",
      remember: false,
    });
  });

  it("continues to the next onboarding step (1.2)", async () => {
    render(<Login />);

    await submit();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/onboarding/profile"),
    );
  });

  // The cookies were written by the server during the action; without the
  // refresh the next render would still be the signed-out one.
  it("re-renders from the server so the new session is seen (1.2)", async () => {
    render(<Login />);

    await submit();

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it.each([true, false])(
    "passes the remember choice through as %s (3.3/3.4)",
    async (remember) => {
      render(<Login />);

      await submit({ remember });

      await waitFor(() =>
        expect(signIn).toHaveBeenCalledWith(
          expect.objectContaining({ remember }),
        ),
      );
    },
  );

  // 3.2: the cookies are the only record of who is signed in.
  it("writes nothing about the user to browser storage", async () => {
    render(<Login />);

    await submit();

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  // 1.6: the password goes to the action and nowhere else.
  it("sends the password to the action and to nothing else", async () => {
    render(<Login />);

    await submit({ password: "s3cret-pass" });

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(signIn.mock.calls[0][0].password).toBe("s3cret-pass");
    expect(push.mock.calls.flat().join(" ")).not.toContain("s3cret-pass");
    expect(JSON.stringify(localStorage)).not.toContain("s3cret-pass");
  });
});

describe("an invalid sign-in", () => {
  it("explains what is wrong with the email", async () => {
    render(<Login />);

    await submit({ email: "not-an-email" });

    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
  });

  it("explains a missing password", async () => {
    render(<Login />);

    await submit({ password: "" });

    expect(screen.getByText("Enter your password.")).toBeDefined();
  });

  // 1.3: a submission the form itself can reject never reaches the service.
  it("does not contact the auth service at all", async () => {
    render(<Login />);

    await submit({ email: "not-an-email" });

    expect(signIn).not.toHaveBeenCalled();
  });

  it("stays on the page", async () => {
    render(<Login />);

    await submit({ email: "not-an-email" });

    expect(push).not.toHaveBeenCalled();
  });

  it("stops annotating a field once it is corrected", async () => {
    // Errors are recomputed per submission rather than accumulated, so a fixed
    // field must lose its message.
    render(<Login />);

    await submit({ email: "not-an-email", password: "" });
    expect(screen.getByText("Enter a valid email address.")).toBeDefined();

    await submit({ email: "ana@example.com", password: "" });

    expect(screen.queryByText("Enter a valid email address.")).toBeNull();
    expect(screen.getByText("Enter your password.")).toBeDefined();
  });
});

describe("when the auth service rejects the sign-in", () => {
  const banner = {
    ok: false as const,
    failure: {
      kind: "banner" as const,
      message: "Invalid email or password.",
    },
  };

  it("announces the failure without moving focus (1.4, 4.7)", async () => {
    signIn.mockResolvedValue(banner);
    render(<Login />);

    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email or password.");
  });

  it("does not continue to the next step (1.4)", async () => {
    signIn.mockResolvedValue(banner);
    render(<Login />);

    await submit();

    await screen.findByRole("alert");
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  // 1.5: nothing the user typed is thrown away by a failure.
  it("leaves the typed values in place", async () => {
    signIn.mockResolvedValue(banner);
    render(<Login />);

    await submit({ email: "ana@example.com", password: "s3cret" });

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email").getAttribute("value")).toBe(
      "ana@example.com",
    );
    expect(screen.getByLabelText("Password").getAttribute("value")).toBe(
      "s3cret",
    );
  });

  it("lands a field failure on the field it names (4.3)", async () => {
    signIn.mockResolvedValue({
      ok: false,
      failure: {
        kind: "field",
        field: "password",
        message: "Password must be at least 6 characters.",
      },
    });
    render(<Login />);

    await submit();

    await screen.findByText("Password must be at least 6 characters.");
    expect(
      screen.getByLabelText("Password").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(push).not.toHaveBeenCalled();
  });

  // 4.8: a stale message must not describe the attempt in flight.
  it("clears the previous failure when a new attempt is submitted", async () => {
    signIn.mockResolvedValue(banner);
    render(<Login />);

    await submit();
    await screen.findByRole("alert");

    let resolve: (value: { ok: true }) => void = () => {};
    signIn.mockReturnValue(
      new Promise<{ ok: true }>((r) => {
        resolve = r;
      }),
    );
    await submit();

    expect(screen.queryByRole("alert")).toBeNull();

    // Settled inside `act`, so the state the resolution produces — the form's
    // in-flight guard coming off, the navigation — lands before the test ends.
    await act(async () => {
      resolve({ ok: true });
    });
  });
});
