// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup } from "./RadioGroup";

const OPTIONS = [
  { value: "emergency-fund", label: "Build an emergency fund" },
  { value: "pay-off-debt", label: "Pay off debt" },
  { value: "big-purchase", label: "Save for a big purchase" },
];

function setup({
  value = null,
  onChange = vi.fn(),
}: { value?: string | null; onChange?: (value: string) => void } = {}) {
  render(
    <RadioGroup
      name="goal"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      aria-labelledby="goal-question"
    />,
  );
  return { onChange };
}

describe("RadioGroup", () => {
  it("offers every option as a radio", () => {
    setup();

    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("is announced as a radio group tied to its question", () => {
    setup();

    expect(
      screen.getByRole("radiogroup").getAttribute("aria-labelledby"),
    ).toBe("goal-question");
  });

  it("selects nothing until the user chooses", () => {
    setup();

    for (const radio of screen.getAllByRole<HTMLInputElement>("radio")) {
      expect(radio.checked).toBe(false);
    }
  });

  it("marks the current value as checked", () => {
    setup({ value: "pay-off-debt" });

    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Pay off debt" })
        .checked,
    ).toBe(true);
  });

  it("checks exactly one option at a time", () => {
    setup({ value: "pay-off-debt" });

    const checked = screen
      .getAllByRole<HTMLInputElement>("radio")
      .filter((radio) => radio.checked);

    expect(checked).toHaveLength(1);
  });

  it("reports the value the user picked", () => {
    const { onChange } = setup();

    fireEvent.click(
      screen.getByRole("radio", { name: "Save for a big purchase" }),
    );

    expect(onChange).toHaveBeenCalledWith("big-purchase");
  });

  it("can be chosen by clicking the row's text, not just the dot", () => {
    // The 20px dot is a small target; the whole row has to be clickable.
    const { onChange } = setup();

    fireEvent.click(screen.getByText("Pay off debt"));

    expect(onChange).toHaveBeenCalledWith("pay-off-debt");
  });

  it("draws a checkmark only inside the selected dot", () => {
    const { container } = render(
      <RadioGroup
        name="goal"
        options={OPTIONS}
        value="pay-off-debt"
        onChange={vi.fn()}
        aria-labelledby="goal-question"
      />,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("groups the radios under one name so the browser enforces single choice", () => {
    setup();

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.getAttribute("name")).toBe("goal");
    }
  });
});
