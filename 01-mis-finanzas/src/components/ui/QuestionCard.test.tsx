// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuestionCard, questionLabelId } from "./QuestionCard";

describe("QuestionCard", () => {
  it("presents the question as a heading", () => {
    render(<QuestionCard id="goal" question="What is your primary financial goal?" />);

    expect(
      screen.getByRole("heading", {
        name: "What is your primary financial goal?",
      }),
    ).toBeDefined();
  });

  it("shows the hint when the design supplies one", () => {
    render(
      <QuestionCard
        id="goal"
        question="What is your primary financial goal?"
        hint="Choose the one that best describes your focus right now."
      />,
    );

    expect(
      screen.getByText("Choose the one that best describes your focus right now."),
    ).toBeDefined();
  });

  it("renders no hint paragraph when there is none", () => {
    // The risk-tolerance card has a question with no hint; an empty <p> would
    // still take up the card's 14px gap.
    const { container } = render(
      <QuestionCard id="risk" question="What is your risk tolerance?" />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders its controls", () => {
    render(
      <QuestionCard id="goal" question="Goal?">
        <button type="button">An option</button>
      </QuestionCard>,
    );

    expect(screen.getByRole("button", { name: "An option" })).toBeDefined();
  });

  it("labels its heading with the id its control group will point at", () => {
    // This is the contract that lets a radiogroup inside the card be announced
    // with its question — the two must agree on the id.
    render(<QuestionCard id="goal" question="Goal?" />);

    expect(screen.getByRole("heading", { name: "Goal?" }).id).toBe(
      questionLabelId("goal"),
    );
  });
});
