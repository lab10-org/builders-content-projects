// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Wordmark } from "./Wordmark";

describe("Wordmark", () => {
  it("names the product", () => {
    render(<Wordmark />);

    expect(screen.getByText("Northstar")).toBeDefined();
  });

  it("draws a mark beside the name", () => {
    const { container } = render(<Wordmark />);

    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("reads dark-on-light in the onboarding header", () => {
    const { container } = render(<Wordmark tone="default" />);

    expect(container.firstElementChild?.className).toContain("text-text-primary");
  });

  it("reads light-on-teal in the login brand panel", () => {
    const { container } = render(<Wordmark tone="inverse" />);

    expect(container.firstElementChild?.className).toContain("text-text-inverse");
  });

  it("is not a control, so it never lands in the tab order", () => {
    // The design shows a static mark; making it focusable would add a stop that
    // leads nowhere.
    render(<Wordmark />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
