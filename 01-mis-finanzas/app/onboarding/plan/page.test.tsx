// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROFILE_KEY } from "../../../src/storage/profileStorage";
import { TRANSACTIONS_KEY } from "../../../src/storage/transactionStorage";
import PlanScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});

function storeProfile(goal: string) {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      goal,
      riskTolerance: "balanced",
      incomeSources: ["salary"],
    }),
  );
}

describe("the page chrome", () => {
  it("puts the user on the fourth step", () => {
    render(<PlanScreen />);

    expect(
      screen.getByText("Plan").closest("li")?.getAttribute("aria-current"),
    ).toBe("step");
  });

  it("carries the design's heading and subtitle", () => {
    render(<PlanScreen />);

    expect(
      screen.getByRole("heading", { name: "Your personalized plan" }),
    ).toBeDefined();
    expect(
      screen.getByText(/how to allocate your income each month/),
    ).toBeDefined();
  });
});

describe("the goal hero", () => {
  it("names the goal the user chose in step 2", async () => {
    storeProfile("retirement");
    render(<PlanScreen />);

    expect(
      await screen.findByRole("heading", { name: "Prepare for retirement" }),
    ).toBeDefined();
  });

  it("falls back to a coherent plan when no profile was stored", () => {
    // Reaching this screen directly must not produce a blank hero.
    render(<PlanScreen />);

    expect(
      screen.getByRole("heading", { name: "Build an emergency fund" }),
    ).toBeDefined();
  });

  it("states the target", () => {
    render(<PlanScreen />);

    expect(screen.getByText(/^Target \$[\d,]+/)).toBeDefined();
  });

  it("dates the goal once there is a gap left to close", async () => {
    // Retirement is 24x income, which the seeded balance does not already cover.
    storeProfile("retirement");
    render(<PlanScreen />);

    expect(await screen.findByText(/· by \w+ \d{4}$/)).toBeDefined();
  });

  it("shows the monthly target and the month count", () => {
    render(<PlanScreen />);

    expect(screen.getByText("Monthly target")).toBeDefined();
    expect(screen.getByText("Months to goal")).toBeDefined();
  });

  it("says the goal is already funded rather than a month away", () => {
    // The seeded balance ($48,920) covers a six-month emergency fund ($24,960).
    // The mockup shows "30 months to goal" beside that same balance, which its
    // own numbers cannot support.
    render(<PlanScreen />);

    expect(screen.getByText("Goal reached")).toBeDefined();
    expect(screen.getByText(/already funded/)).toBeDefined();
  });

  it("reports being on track with a label, not just a colour", async () => {
    storeProfile("retirement");
    render(<PlanScreen />);

    expect(await screen.findByText("On track")).toBeDefined();
  });
});

describe("the twelve-month chart", () => {
  it("draws one bar per month", () => {
    render(<PlanScreen />);

    // Each bar is an img with its three values in the label.
    expect(screen.getAllByRole("img")).toHaveLength(12);
  });

  it("names every month's three values, so none is colour-only", () => {
    render(<PlanScreen />);

    for (const bar of screen.getAllByRole("img")) {
      const label = bar.getAttribute("aria-label") ?? "";
      expect(label).toMatch(/needs \$/);
      expect(label).toMatch(/wants \$/);
      expect(label).toMatch(/savings \$/);
    }
  });

  it("carries a legend for the three series", () => {
    render(<PlanScreen />);

    const figure = screen.getByRole("figure");
    for (const label of ["Needs", "Wants", "Savings"]) {
      expect(within(figure).getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("ships a table twin so every value is readable without the chart", () => {
    render(<PlanScreen />);

    const table = screen.getByRole("table");
    // A header row plus twelve months.
    expect(within(table).getAllByRole("row")).toHaveLength(13);
  });

  it("labels the axis with month names", () => {
    render(<PlanScreen />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("rowheader")).toHaveLength(12);
  });
});

describe("this month's allocation", () => {
  it("states the income it is based on", () => {
    render(<PlanScreen />);

    expect(screen.getByText(/Based on \$7,450 monthly income/)).toBeDefined();
  });

  it("lists each tier with an amount and a share", () => {
    render(<PlanScreen />);

    const allocation = screen
      .getByText("This month's allocation")
      .closest("section") as HTMLElement;
    const rows = within(allocation).getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.textContent).toMatch(/\$[\d,]+/);
      expect(row.textContent).toMatch(/\d+%/);
    }
  });

  it("splits the whole of income between the three tiers", () => {
    // The amounts adding up to income is the domain's job and is tested there;
    // what matters here is that the shares the user reads cover 100%.
    render(<PlanScreen />);

    const allocation = screen
      .getByText("This month's allocation")
      .closest("section") as HTMLElement;
    // Queried as their own elements: a row's concatenated textContent reads
    // "Needs$4,10055%", where no regex can tell the amount from the share.
    const shares = within(allocation)
      .getAllByText(/^\d+%$/)
      .map((node) => Number(node.textContent?.replace("%", "")));

    expect(shares).toHaveLength(3);
    // Within a point of 100, since each share is rounded independently.
    expect(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 100)).toBeLessThanOrEqual(1);
  });

  it("names the three tiers", () => {
    render(<PlanScreen />);

    const allocation = screen
      .getByText("This month's allocation")
      .closest("section") as HTMLElement;

    for (const tier of ["Needs", "Wants", "Savings"]) {
      expect(within(allocation).getByText(tier)).toBeDefined();
    }
  });
});

describe("the tips", () => {
  it("lists how to stay on track", () => {
    render(<PlanScreen />);

    const tips = screen
      .getByText("How to stay on track")
      .closest("section") as HTMLElement;

    expect(within(tips).getAllByRole("listitem").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("names the transfer to automate once there is a goal left to fund", async () => {
    storeProfile("retirement");
    render(<PlanScreen />);

    expect(
      await screen.findByText(
        /Automate a \$[\d,]+ transfer to savings each payday\./,
      ),
    ).toBeDefined();
  });

  it("does not tell a user with a funded goal to save harder", () => {
    render(<PlanScreen />);

    expect(screen.getByText(/fully funded/)).toBeDefined();
    expect(screen.queryByText(/Automate a \$/)).toBeNull();
  });

  it("keeps the design's closing reassurance", () => {
    render(<PlanScreen />);

    expect(
      screen.getByText("We recheck your plan every 6 months and adjust."),
    ).toBeDefined();
  });
});

describe("navigation", () => {
  it("goes back to the Know me step", () => {
    render(<PlanScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(push).toHaveBeenCalledWith("/onboarding/know-me");
  });

  it("finishes into the app's existing screen", () => {
    render(<PlanScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Finish & go to dashboard" }),
    );

    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("responding to the user's own transactions", () => {
  it("raises the income the allocation is based on", async () => {
    localStorage.setItem(
      TRANSACTIONS_KEY,
      JSON.stringify([
        {
          id: "user-1",
          type: "income",
          amount: 1000,
          currency: "USD",
          date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15`,
          description: "Bonus",
          category: "other",
        },
      ]),
    );

    render(<PlanScreen />);

    expect(
      await screen.findByText(/Based on \$8,450 monthly income/),
    ).toBeDefined();
  });
});
