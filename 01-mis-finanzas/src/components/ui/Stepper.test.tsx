// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper } from "./Stepper";

const STEPS = ["Account", "Profile", "Know Me", "Plan"];

function setup(currentIndex = 1) {
  return render(<Stepper steps={STEPS} currentIndex={currentIndex} />);
}

describe("Stepper", () => {
  it("lists every step in order", () => {
    setup();

    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(4);
    for (const [index, step] of STEPS.entries()) {
      expect(items[index].textContent).toContain(step);
    }
  });

  it("marks where the user is", () => {
    setup(1);

    const current = screen.getByText("Profile").closest("li");

    expect(current?.getAttribute("aria-current")).toBe("step");
  });

  it("marks only one step as current", () => {
    setup(1);

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "step");

    expect(current).toHaveLength(1);
  });

  it("replaces the number with a check on finished steps", () => {
    setup(1);

    const done = screen.getByText("Account").closest("li");

    expect(within(done as HTMLElement).queryByText("1")).toBeNull();
    expect(done?.querySelector("svg")).not.toBeNull();
  });

  it("numbers the current and upcoming steps", () => {
    setup(1);

    for (const [step, number] of [
      ["Profile", "2"],
      ["Know Me", "3"],
      ["Plan", "4"],
    ]) {
      const item = screen.getByText(step).closest("li");
      expect(within(item as HTMLElement).getByText(number)).toBeDefined();
    }
  });

  it("shows no checks when the user is on the first step", () => {
    const { container } = setup(0);

    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("tints the connector behind the user but not ahead of them", () => {
    // The design fills the connector after the completed step with accent and
    // leaves the rest in border grey.
    const { container } = setup(1);
    const connectors = [...container.querySelectorAll("[data-connector]")];

    expect(connectors).toHaveLength(3);
    expect(connectors[0].className).toContain("bg-accent");
    expect(connectors[1].className).toContain("bg-border");
    expect(connectors[2].className).toContain("bg-border");
  });

  it("announces overall progress for small screens", () => {
    // Below `lg` the dots collapse to a text summary; it has to say the same
    // thing the dots do.
    setup(1);

    expect(screen.getByText("Step 2 of 4")).toBeDefined();
  });
});
