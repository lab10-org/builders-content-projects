"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../../../src/components/ui/Button";
import { ChipGroup } from "../../../src/components/ui/ChipGroup";
import {
  QuestionCard,
  questionLabelId,
} from "../../../src/components/ui/QuestionCard";
import { RadioGroup } from "../../../src/components/ui/RadioGroup";
import { SegmentedControl } from "../../../src/components/ui/SegmentedControl";
import { Stepper } from "../../../src/components/ui/Stepper";
import { Wordmark } from "../../../src/components/ui/Wordmark";
import { Icon } from "../../../src/components/ui/icons";
import {
  GOALS,
  INCOME_SOURCES,
  RISK_LEVELS,
  type Goal,
  type IncomeSource,
  type ProfileError,
  type ProfileField,
  type RiskLevel,
  describeRisk,
  validateProfile,
} from "../../../src/domain/financialProfile";
import { loadProfile, saveProfile } from "../../../src/storage/profileStorage";

/** The four onboarding steps from the design's stepper. */
const STEPS = ["Account", "Profile", "Know Me", "Plan"];

const SAVE_ERROR_MESSAGE =
  "Could not save your answers. Please try again.";

/**
 * Balanced is preselected because the design shows it selected and a segmented
 * control has no empty state to render. Goal and income sources start empty on
 * purpose: preselecting an answer to a question about the user's own priorities
 * would bias it, and the mockup only shows them filled in because it depicts a
 * completed form.
 */
const DEFAULT_RISK: RiskLevel = "balanced";

export default function Profile() {
  const router = useRouter();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [riskTolerance, setRiskTolerance] = useState<RiskLevel>(DEFAULT_RISK);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [errors, setErrors] = useState<ProfileError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Read storage in a mount effect, never during render: `localStorage` does not
  // exist while Next.js renders this on the server. Restoring matters because
  // step 3 can send the user back here.
  useEffect(() => {
    const stored = loadProfile();
    if (stored === null) return;

    setGoal(stored.goal);
    setRiskTolerance(stored.riskTolerance);
    setIncomeSources(stored.incomeSources);
  }, []);

  function errorFor(field: ProfileField): string | undefined {
    return errors.find((error) => error.field === field)?.message;
  }

  function handleSubmit() {
    const result = validateProfile({ goal, riskTolerance, incomeSources });
    if (!result.ok) {
      // Recomputed per submission rather than accumulated, so an answered
      // question stops being flagged. No write was attempted, so an earlier save
      // failure no longer describes anything on screen.
      setErrors(result.errors);
      setSaveError(null);
      return;
    }

    try {
      saveProfile(result.profile);
    } catch {
      // Nothing navigates: a failed write must not advance the user past answers
      // that were never stored.
      setErrors([]);
      setSaveError(SAVE_ERROR_MESSAGE);
      return;
    }

    setErrors([]);
    setSaveError(null);
    router.push("/onboarding/know-me");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-5 lg:px-10">
        <Wordmark tone="default" />
        <Stepper steps={STEPS} currentIndex={1} />
      </header>

      <main className="flex flex-1 justify-center px-6 py-8 lg:px-10">
        <form
          noValidate
          className="flex w-full max-w-[760px] flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-[30px] font-semibold text-text-primary">
              Tell us about your finances
            </h1>
            <p className="font-body text-[16px] text-text-secondary">
              A few quick questions help us tailor your plan and recommendations
              to what matters most to you.
            </p>
          </div>

          <QuestionCard
            id="goal"
            question="What is your primary financial goal?"
            hint="Choose the one that best describes your focus right now."
          >
            <RadioGroup
              name="goal"
              options={GOALS}
              value={goal}
              onChange={(value) => setGoal(value as Goal)}
              aria-labelledby={questionLabelId("goal")}
            />
            <FieldError message={errorFor("goal")} />
          </QuestionCard>

          <QuestionCard id="risk" question="What is your risk tolerance?">
            <SegmentedControl
              name="risk"
              options={RISK_LEVELS}
              value={riskTolerance}
              onChange={(value) => setRiskTolerance(value as RiskLevel)}
              aria-labelledby={questionLabelId("risk")}
            />
            {/* Describes whichever level is selected, so the trade-off the user
                is choosing is always spelled out. */}
            <p className="font-body text-[13px] text-text-muted">
              {describeRisk(riskTolerance)}
            </p>
          </QuestionCard>

          <QuestionCard
            id="income"
            question="What are your main income sources?"
            hint="Select all that apply."
          >
            <ChipGroup
              options={INCOME_SOURCES}
              selected={incomeSources}
              onChange={(values) => setIncomeSources(values as IncomeSource[])}
              aria-labelledby={questionLabelId("income")}
            />
            <FieldError message={errorFor("incomeSources")} />
          </QuestionCard>

          {saveError !== null && (
            <p role="alert" className="font-body text-[14px] text-danger">
              {saveError}
            </p>
          )}

          <footer className="flex items-center justify-between py-1">
            <Button variant="ghost" onClick={() => router.push("/login")}>
              <Icon name="arrow-left" className="size-4" />
              Back
            </Button>

            <Button type="submit" variant="pill">
              Continue
              <Icon name="arrow-right" className="size-4" />
            </Button>
          </footer>
        </form>
      </main>
    </div>
  );
}

/**
 * The design has no error state for these questions, so this is authored: the
 * same 13px scale as the hints, in the danger token.
 */
function FieldError({ message }: { message?: string }) {
  if (message === undefined) return null;

  return <p className="font-body text-[13px] text-danger">{message}</p>;
}
