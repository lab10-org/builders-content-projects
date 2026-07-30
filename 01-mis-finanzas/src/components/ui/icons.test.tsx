// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ICON_NAMES, Icon, type IconName } from "./icons";

/** The icons the mockup actually uses; anything else is dead weight. */
const EXPECTED: IconName[] = [
  "compass",
  "star",
  "check",
  "eye",
  "eye-off",
  "arrow-left",
  "arrow-right",
  "plus",
  "cloud-upload",
  "folder-open",
  "file-text",
  "circle-check",
  "x",
  "sparkles",
  "trending-up",
  "trending-down",
  "chart-pie",
  "triangle-alert",
  "chevron-down",
];

function renderIcon(name: IconName) {
  const { container } = render(<Icon name={name} />);
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error(`<Icon name="${name}"> rendered no <svg>`);
  return svg;
}

describe("ICON_NAMES", () => {
  it("covers exactly the icons used by the design", () => {
    expect([...ICON_NAMES].sort()).toEqual([...EXPECTED].sort());
  });
});

describe("Icon", () => {
  it.each(EXPECTED)("renders drawable geometry for %s", (name) => {
    const svg = renderIcon(name);

    // Guards against an entry that exists but draws nothing — the failure mode
    // a snapshot-free test would otherwise miss.
    const shapes = svg.querySelectorAll("path, circle, line");
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const geometry = shape.getAttribute("d") ?? shape.getAttribute("r");
      expect(geometry).not.toBe("");
      expect(geometry).not.toBeNull();
    }
  });

  it.each(EXPECTED)("scales %s within a 24-unit viewBox", (name) => {
    // Every lucide glyph is authored on a 24x24 grid. A mismatched viewBox
    // would silently crop or shrink one icon relative to its neighbours.
    expect(renderIcon(name).getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("takes its colour from the surrounding text colour", () => {
    // The design expresses icon colour as a fill token per instance, which in
    // code becomes "inherit whatever text colour the parent sets".
    expect(renderIcon("check").getAttribute("stroke")).toBe("currentColor");
  });

  it("hides itself from assistive technology by default", () => {
    // Every icon in both screens sits next to a visible text label, so exposing
    // it would only produce duplicate announcements.
    expect(renderIcon("check").getAttribute("aria-hidden")).toBe("true");
  });

  it("becomes an image with an accessible name when given a title", () => {
    const { container } = render(<Icon name="eye" title="Show password" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.querySelector("title")?.textContent).toBe("Show password");
  });

  it("applies the caller's classes so size comes from the call site", () => {
    // Sizes in the design range from 13px to 28px; the icon itself must not
    // hardcode one of them.
    const { container } = render(<Icon name="star" className="size-[13px]" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "size-[13px]",
    );
  });
});
