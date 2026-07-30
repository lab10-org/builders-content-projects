// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChipGroup } from "./ChipGroup";

const OPTIONS = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business" },
];

function setup({
  selected = [] as string[],
  onChange = vi.fn(),
}: { selected?: string[]; onChange?: (values: string[]) => void } = {}) {
  render(
    <ChipGroup
      options={OPTIONS}
      selected={selected}
      onChange={onChange}
      aria-labelledby="income-question"
    />,
  );
  return { onChange };
}

describe("ChipGroup", () => {
  it("uses checkboxes, because more than one source can apply", () => {
    setup();

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("is announced as a group tied to its question", () => {
    setup();

    expect(screen.getByRole("group").getAttribute("aria-labelledby")).toBe(
      "income-question",
    );
  });

  it("checks every selected value", () => {
    setup({ selected: ["salary", "business"] });

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Salary" }).checked,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Business" })
        .checked,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Freelance" })
        .checked,
    ).toBe(false);
  });

  it("adds a source when an unselected chip is picked", () => {
    const { onChange } = setup({ selected: ["salary"] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Freelance" }));

    expect(onChange).toHaveBeenCalledWith(["salary", "freelance"]);
  });

  it("removes a source when a selected chip is picked again", () => {
    const { onChange } = setup({ selected: ["salary", "freelance"] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Salary" }));

    expect(onChange).toHaveBeenCalledWith(["freelance"]);
  });

  it("keeps the caller's option order, not click order", () => {
    // Otherwise the stored profile would differ depending on which chip the user
    // happened to tap first.
    const { onChange } = setup({ selected: ["business"] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Salary" }));

    expect(onChange).toHaveBeenCalledWith(["salary", "business"]);
  });

  it("marks a selected chip with a check and an unselected one with a plus", () => {
    const { container } = render(
      <ChipGroup
        options={OPTIONS}
        selected={["salary"]}
        onChange={vi.fn()}
        aria-labelledby="income-question"
      />,
    );

    // One glyph per chip either way, so count is not the signal — the selected
    // chip's row must carry the accent fill the design gives it.
    expect(screen.getByText("Salary").closest("label")?.className).toContain(
      "border-accent",
    );
    expect(screen.getByText("Freelance").closest("label")?.className).toContain(
      "border-border",
    );
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });

  it("wraps instead of overflowing", () => {
    // The design draws two fixed rows only because Pencil cannot wrap; six chips
    // on one line would overflow a narrow viewport.
    setup();

    expect(screen.getByRole("group").className).toContain("flex-wrap");
  });
});
