// @vitest-environment jsdom
import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

/** Swallows jsdom's "not implemented: form submission" while still recording. */
function submitSpy() {
  return vi.fn((event: FormEvent) => event.preventDefault());
}

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Sign in</Button>);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  });

  it("does not submit the surrounding form unless asked to", () => {
    // Inside a <form> the HTML default for a button is "submit". The profile
    // footer puts Back next to Continue, so an implicit submit would let the
    // wrong button send the form.
    const onSubmit = submitSpy();
    render(
      <form onSubmit={onSubmit}>
        <Button>Back</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when explicitly typed as a submit button", () => {
    const onSubmit = submitSpy();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Sign in</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("forwards clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continue</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("exposes its disabled state to the browser and assistive tech", () => {
    // Asserted as the attribute rather than as a swallowed click: enforcement is
    // the browser's job, and this is what makes it do it.
    render(<Button disabled>Continue</Button>);

    expect(
      screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  describe("variants", () => {
    it("spans the full width as the login screen's block button", () => {
      render(<Button variant="block">Sign in</Button>);

      expect(screen.getByRole("button").className).toContain("w-full");
    });

    it("is a filled pill for the profile screen's primary action", () => {
      render(<Button variant="pill">Continue</Button>);

      const { className } = screen.getByRole("button");
      expect(className).toContain("rounded-full");
      expect(className).toContain("bg-accent");
    });

    it("carries no fill as the profile screen's secondary action", () => {
      render(<Button variant="ghost">Back</Button>);

      expect(screen.getByRole("button").className).not.toContain("bg-accent");
    });

    it("defaults to the block variant", () => {
      render(<Button>Sign in</Button>);

      expect(screen.getByRole("button").className).toContain("w-full");
    });
  });

  it("keeps caller classes alongside the variant's", () => {
    render(<Button className="mt-4">Sign in</Button>);

    const { className } = screen.getByRole("button");
    expect(className).toContain("mt-4");
    expect(className).toContain("w-full");
  });
});
