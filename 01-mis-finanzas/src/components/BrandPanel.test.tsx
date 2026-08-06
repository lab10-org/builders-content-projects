// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandPanel } from "./BrandPanel";

describe("BrandPanel", () => {
  it("carries the wordmark, the tagline and the supporting copy", () => {
    render(<BrandPanel />);

    expect(screen.getByText("Northstar")).toBeDefined();
    expect(
      screen.getByText("Build the financial future you deserve."),
    ).toBeDefined();
    expect(screen.getByText(/turns everyday money decisions/)).toBeDefined();
  });

  it("lists the three reassurances in order", () => {
    render(<BrandPanel />);

    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "Bank-level encryption on every connection",
      "No hidden fees, ever",
      "Cancel anytime — your data stays yours",
    ]);
  });

  // The display copy must stay a <p>: the panel renders *before* the form in
  // the DOM, so a heading here would open the page above its only <h1>.
  it("opens no heading of its own", () => {
    render(<BrandPanel />);

    expect(screen.queryAllByRole("heading")).toEqual([]);
  });
});
