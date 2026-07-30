// @vitest-environment jsdom
import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PasswordField } from "./PasswordField";

function toggle() {
  return screen.getByRole("button", { name: /show|hide/i });
}

describe("PasswordField", () => {
  it("hides the password by default", () => {
    render(<PasswordField id="password" label="Password" />);

    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password",
    );
  });

  it("reveals the password when the toggle is pressed", () => {
    render(<PasswordField id="password" label="Password" />);

    fireEvent.click(toggle());

    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
  });

  it("hides it again on a second press", () => {
    render(<PasswordField id="password" label="Password" />);

    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password",
    );
  });

  it("starts out offering to show, per the design", () => {
    render(<PasswordField id="password" label="Password" />);

    expect(screen.getByRole("button", { name: /show/i })).toBeDefined();
  });

  it("offers to hide once revealed", () => {
    // The label has to describe the *next* action, or it reads as a lie about
    // the current state.
    render(<PasswordField id="password" label="Password" />);

    fireEvent.click(toggle());

    expect(screen.getByRole("button", { name: /hide/i })).toBeDefined();
  });

  it("keeps the toggle out of the form's submit path", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordField id="password" label="Password" />
      </form>,
    );

    fireEvent.click(toggle());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves the typed value across a reveal", () => {
    render(<PasswordField id="password" label="Password" defaultValue="s3cret" />);

    fireEvent.click(toggle());

    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe(
      "s3cret",
    );
  });

  it("wires up an error like any other field", () => {
    render(
      <PasswordField id="password" label="Password" error="Enter your password." />,
    );

    const input = screen.getByLabelText("Password");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(input.getAttribute("aria-describedby") as string)
        ?.textContent,
    ).toBe("Enter your password.");
  });
});
