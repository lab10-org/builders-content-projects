// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates its label with the input", () => {
    render(<TextField id="email" label="Email" />);

    // getByLabelText only resolves when the association really exists, which is
    // what makes the label clickable and announced.
    expect(screen.getByLabelText("Email")).toBeDefined();
  });

  it("shows the design's placeholder", () => {
    render(<TextField id="email" label="Email" placeholder="you@example.com" />);

    expect(screen.getByLabelText("Email").getAttribute("placeholder")).toBe(
      "you@example.com",
    );
  });

  it("reports what the user types", () => {
    const onChange = vi.fn();
    render(<TextField id="email" label="Email" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ana@example.com" },
    });

    expect(onChange).toHaveBeenCalledOnce();
  });

  it("defaults to a text input", () => {
    render(<TextField id="email" label="Email" />);

    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("text");
  });

  it("accepts a different input type", () => {
    render(<TextField id="email" label="Email" type="email" />);

    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
  });

  describe("without an error", () => {
    it("omits aria-describedby entirely rather than setting it empty", () => {
      render(<TextField id="email" label="Email" />);

      expect(
        screen.getByLabelText("Email").hasAttribute("aria-describedby"),
      ).toBe(false);
    });

    it("is not marked invalid", () => {
      render(<TextField id="email" label="Email" />);

      expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe(
        null,
      );
    });
  });

  describe("with an error", () => {
    it("renders the message", () => {
      render(
        <TextField id="email" label="Email" error="Enter a valid email address." />,
      );

      expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    });

    it("points the input at the message so it is announced", () => {
      render(<TextField id="email" label="Email" error="Bad email." />);

      const input = screen.getByLabelText("Email");
      const describedBy = input.getAttribute("aria-describedby");

      expect(describedBy).not.toBeNull();
      expect(document.getElementById(describedBy as string)?.textContent).toBe(
        "Bad email.",
      );
    });

    it("marks the input invalid", () => {
      render(<TextField id="email" label="Email" error="Bad email." />);

      expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe(
        "true",
      );
    });
  });

  it("renders trailing content inside the input box", () => {
    // The password reveal toggle lives inside the bordered box in the design,
    // not beside it.
    render(
      <TextField
        id="password"
        label="Password"
        trailing={<button type="button">Show</button>}
      />,
    );

    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show" });

    expect(input.parentElement?.contains(toggle)).toBe(true);
  });
});
