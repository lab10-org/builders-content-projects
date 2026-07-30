// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" },
];

function setup({
  value = "balanced",
  onChange = vi.fn(),
}: { value?: string; onChange?: (value: string) => void } = {}) {
  render(
    <SegmentedControl
      name="risk"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      aria-labelledby="risk-question"
    />,
  );
  return { onChange };
}

describe("SegmentedControl", () => {
  it("is a radio group, because the three levels are mutually exclusive", () => {
    setup();

    expect(screen.getByRole("radiogroup")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("is tied to its question", () => {
    setup();

    expect(screen.getByRole("radiogroup").getAttribute("aria-labelledby")).toBe(
      "risk-question",
    );
  });

  it("marks the current level as checked", () => {
    setup({ value: "balanced" });

    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Balanced" }).checked,
    ).toBe(true);
  });

  it("reports the level the user picked", () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole("radio", { name: "Aggressive" }));

    expect(onChange).toHaveBeenCalledWith("aggressive");
  });

  it("fills only the selected segment", () => {
    setup({ value: "balanced" });

    const selected = screen.getByText("Balanced").closest("label");
    const other = screen.getByText("Conservative").closest("label");

    expect(selected?.className).toContain("bg-accent");
    expect(other?.className).not.toContain("bg-accent");
  });

  it("shares the width evenly between segments", () => {
    // The design's segments are all fill_container inside the track.
    setup();

    for (const label of ["Conservative", "Balanced", "Aggressive"]) {
      expect(screen.getByText(label).closest("label")?.className).toContain(
        "flex-1",
      );
    }
  });
});
