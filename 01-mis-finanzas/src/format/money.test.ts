import { describe, expect, it } from "vitest";

import { formatMoney, formatPercent, formatSignedMoney } from "./money";

describe("formatMoney", () => {
  it.each([
    [48920, "$48,920"],
    [7450, "$7,450"],
    [420, "$420"],
    [0, "$0"],
    [1650, "$1,650"],
  ])("renders %i as %s, as the design does", (amount, expected) => {
    expect(formatMoney(amount)).toBe(expected);
  });

  it("rounds rather than showing cents", () => {
    expect(formatMoney(5710.49)).toBe("$5,710");
    expect(formatMoney(5710.5)).toBe("$5,711");
  });

  it("puts the sign before the symbol for a negative total", () => {
    expect(formatMoney(-150)).toBe("-$150");
  });

  it("does not emit NaN", () => {
    expect(formatMoney(Number.NaN)).toBe("$0");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("$0");
  });
});

describe("formatSignedMoney", () => {
  it("renders income with a plus and cents", () => {
    expect(formatSignedMoney(1200, "income")).toBe("+$1,200.00");
  });

  it("renders an expense with a minus and cents", () => {
    expect(formatSignedMoney(142.3, "expense")).toBe("-$142.30");
  });

  it("takes the sign from the type, never from the stored amount", () => {
    // Amounts are always stored positive, so a negative here is corrupt input —
    // it must not flip an expense into looking like income.
    expect(formatSignedMoney(-142.3, "expense")).toBe("-$142.30");
    expect(formatSignedMoney(-1200, "income")).toBe("+$1,200.00");
  });

  it("always shows two decimals", () => {
    expect(formatSignedMoney(5, "expense")).toBe("-$5.00");
    expect(formatSignedMoney(1234.5, "income")).toBe("+$1,234.50");
  });

  it("does not emit NaN", () => {
    expect(formatSignedMoney(Number.NaN, "expense")).toBe("-$0.00");
  });
});

describe("formatPercent", () => {
  it.each([
    [0.23, "23%"],
    [0.38, "38%"],
    [0, "0%"],
    [1, "100%"],
  ])("renders %f as %s", (fraction, expected) => {
    expect(formatPercent(fraction)).toBe(expected);
  });

  it("keeps a negative rate visible instead of hiding it", () => {
    expect(formatPercent(-0.12)).toBe("-12%");
  });

  it("does not emit NaN", () => {
    expect(formatPercent(Number.NaN)).toBe("0%");
  });
});
