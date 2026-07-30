// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROFILE_KEY, loadProfile } from "../../../src/storage/profileStorage";
import Profile from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function choose(name: string) {
  fireEvent.click(screen.getByRole("radio", { name }));
}

function toggleSource(name: string) {
  fireEvent.click(screen.getByRole("checkbox", { name }));
}

function continueOn() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

/** Fills in the one answer that has no default, leaving the rest as rendered. */
function answerEverything() {
  choose("Pay off debt");
  toggleSource("Salary");
}

describe("the page chrome", () => {
  it("shows the wordmark and the four-step tracker", () => {
    render(<Profile />);

    expect(screen.getByText("Northstar")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("says the user is on the profile step", () => {
    render(<Profile />);

    expect(
      screen.getByText("Profile").closest("li")?.getAttribute("aria-current"),
    ).toBe("step");
  });

  it("carries the design's heading and subtitle", () => {
    render(<Profile />);

    expect(
      screen.getByRole("heading", { name: "Tell us about your finances" }),
    ).toBeDefined();
    expect(screen.getByText(/A few quick questions/)).toBeDefined();
  });
});

describe("the three questions", () => {
  it("asks all of them", () => {
    render(<Profile />);

    for (const question of [
      "What is your primary financial goal?",
      "What is your risk tolerance?",
      "What are your main income sources?",
    ]) {
      expect(screen.getByRole("heading", { name: question })).toBeDefined();
    }
  });

  it("shows the hints the design specifies", () => {
    render(<Profile />);

    expect(
      screen.getByText("Choose the one that best describes your focus right now."),
    ).toBeDefined();
    expect(screen.getByText("Select all that apply.")).toBeDefined();
  });

  it("starts with no goal chosen, so the answer is the user's", () => {
    render(<Profile />);

    const chosen = screen
      .getAllByRole<HTMLInputElement>("radio")
      .filter((radio) => radio.checked && radio.getAttribute("name") === "goal");

    expect(chosen).toHaveLength(0);
  });

  it("starts with no income source chosen", () => {
    render(<Profile />);

    for (const box of screen.getAllByRole<HTMLInputElement>("checkbox")) {
      expect(box.checked).toBe(false);
    }
  });

  it("defaults risk tolerance to balanced, as the design shows it", () => {
    render(<Profile />);

    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Balanced" }).checked,
    ).toBe(true);
  });
});

describe("the risk descriptor", () => {
  it("describes the balanced default in the design's words", () => {
    render(<Profile />);

    expect(
      screen.getByText(
        "Balanced — a mix of growth and stability, accepting moderate ups and downs for steady long-term returns.",
      ),
    ).toBeDefined();
  });

  it("follows the level the user picks", () => {
    render(<Profile />);

    choose("Aggressive");

    expect(screen.getByText(/^Aggressive —/)).toBeDefined();
    expect(screen.queryByText(/^Balanced —/)).toBeNull();
  });
});

describe("continuing with a complete profile", () => {
  it("stores what the user answered", () => {
    render(<Profile />);

    answerEverything();
    toggleSource("Investments");
    continueOn();

    expect(loadProfile()).toEqual({
      goal: "pay-off-debt",
      riskTolerance: "balanced",
      incomeSources: ["salary", "investments"],
    });
  });

  it("moves on to the next step", () => {
    render(<Profile />);

    answerEverything();
    continueOn();

    expect(push).toHaveBeenCalledWith("/onboarding/know-me");
  });
});

describe("continuing with an incomplete profile", () => {
  it("asks for the missing goal", () => {
    render(<Profile />);

    toggleSource("Salary");
    continueOn();

    expect(screen.getByText("Choose the goal that fits you best.")).toBeDefined();
  });

  it("asks for a missing income source", () => {
    render(<Profile />);

    choose("Pay off debt");
    continueOn();

    expect(
      screen.getByText("Select at least one income source."),
    ).toBeDefined();
  });

  it("stores nothing", () => {
    render(<Profile />);

    continueOn();

    expect(loadProfile()).toBeNull();
  });

  it("stays on the page", () => {
    render(<Profile />);

    continueOn();

    expect(push).not.toHaveBeenCalled();
  });

  it("stops complaining about a question once it is answered", () => {
    render(<Profile />);

    continueOn();
    expect(screen.getByText("Choose the goal that fits you best.")).toBeDefined();

    choose("Pay off debt");
    continueOn();

    expect(screen.queryByText("Choose the goal that fits you best.")).toBeNull();
    expect(screen.getByText("Select at least one income source.")).toBeDefined();
  });
});

describe("going back", () => {
  it("returns to the previous step", () => {
    render(<Profile />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(push).toHaveBeenCalledWith("/login");
  });

  it("does not submit the form on the way", () => {
    render(<Profile />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(loadProfile()).toBeNull();
  });
});

describe("returning to the page", () => {
  it("restores the answers already given", () => {
    // Otherwise stepping back from a later step would silently blank the form.
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        goal: "retirement",
        riskTolerance: "aggressive",
        incomeSources: ["rental"],
      }),
    );

    render(<Profile />);

    expect(
      screen.getByRole<HTMLInputElement>("radio", {
        name: "Prepare for retirement",
      }).checked,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Aggressive" }).checked,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Rental" }).checked,
    ).toBe(true);
  });

  it("falls back to the defaults when nothing was stored", () => {
    render(<Profile />);

    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Balanced" }).checked,
    ).toBe(true);
  });
});

describe("when the profile cannot be stored", () => {
  it("says so instead of pretending it saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Profile />);

    answerEverything();
    continueOn();

    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("does not move on", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Profile />);

    answerEverything();
    continueOn();

    expect(push).not.toHaveBeenCalled();
  });
});
