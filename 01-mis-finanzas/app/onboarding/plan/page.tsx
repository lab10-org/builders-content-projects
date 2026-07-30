"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AllocationBar } from "../../../src/components/ui/AllocationBar";
import { Button } from "../../../src/components/ui/Button";
import { StackedBarChart } from "../../../src/components/ui/StackedBarChart";
import { Stepper } from "../../../src/components/ui/Stepper";
import { Wordmark } from "../../../src/components/ui/Wordmark";
import { Icon } from "../../../src/components/ui/icons";
import {
  GOALS,
  type FinancialProfile,
} from "../../../src/domain/financialProfile";
import { buildPlan } from "../../../src/domain/plan";
import { buildSeedTransactions } from "../../../src/domain/seedTransactions";
import { summarize } from "../../../src/domain/snapshot";
import { loadProfile } from "../../../src/storage/profileStorage";
import { loadTransactions } from "../../../src/storage/transactionStorage";
import { formatMoney } from "../../../src/format/money";

const STEPS = ["Account", "Profile", "Know Me", "Plan"];

/** Wording and glyph per plan state, so none of them is a recoloured other. */
const STATUS = {
  reached: { label: "Goal reached", icon: "circle-check" },
  "on-track": { label: "On track", icon: "trending-up" },
  "at-risk": { label: "Needs a change", icon: "triangle-alert" },
} as const;

/**
 * Used when the user reaches this screen without having completed step 2 — a
 * direct link, or cleared storage. Balanced with a single salary is the same
 * default the profile form starts from, so the plan is still coherent rather
 * than blank.
 */
const FALLBACK_PROFILE: FinancialProfile = {
  goal: "emergency-fund",
  riskTolerance: "balanced",
  incomeSources: ["salary"],
};

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function goalLabel(goal: FinancialProfile["goal"]): string {
  return GOALS.find((entry) => entry.value === goal)?.label ?? "your goal";
}

export default function PlanScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [stored, setStored] = useState<ReturnType<typeof loadTransactions>>([]);

  // Both reads happen on mount, never during render: `localStorage` does not
  // exist while Next.js renders this on the server.
  useEffect(() => {
    setProfile(loadProfile());
    setStored(loadTransactions());
  }, []);

  const plan = useMemo(() => {
    const snapshot = summarize([...buildSeedTransactions(today()), ...stored]);
    if (snapshot === null) return null;

    return buildPlan(profile ?? FALLBACK_PROFILE, snapshot);
  }, [profile, stored]);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-5 lg:px-10">
        <Wordmark tone="brand" />
        <Stepper steps={STEPS} currentIndex={3} />
      </header>

      <main className="flex flex-1 justify-center px-6 py-7 lg:px-12">
        <div className="flex w-full max-w-[1344px] flex-col gap-[22px]">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-[30px] font-semibold text-text-primary">
              Your personalized plan
            </h1>
            <p className="font-body text-[15px] text-text-secondary">
              Here is how to allocate your income each month so you reach your
              goal on schedule.
            </p>
          </div>

          {plan === null ? (
            <p className="rounded-2xl bg-surface p-7 font-body text-[14px] text-text-muted">
              Add a transaction on the previous step to build your plan.
            </p>
          ) : (
            <>
              {/* Goal hero */}
              <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-surface-inverse p-7">
                <div className="flex flex-col gap-2">
                  <span className="font-body text-[12px] font-semibold tracking-[1px] text-surface-sage">
                    YOUR GOAL
                  </span>
                  <h2 className="font-heading text-[24px] font-semibold text-text-inverse">
                    {goalLabel(plan.goal)}
                  </h2>
                  <p className="font-body text-[14px] text-surface-sage">
                    Target {formatMoney(plan.target)}
                    {plan.targetDate !== null && ` · by ${plan.targetDate}`}
                    {plan.status === "reached" && " · already funded"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-data text-[26px] font-semibold text-text-inverse">
                      {formatMoney(plan.monthlyTarget)}
                    </span>
                    <span className="font-body text-[12px] text-surface-sage">
                      Monthly target
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-data text-[26px] font-semibold text-text-inverse">
                      {plan.monthsToGoal ?? "—"}
                    </span>
                    <span className="font-body text-[12px] text-surface-sage">
                      Months to goal
                    </span>
                  </div>

                  {/*
                    Icon plus label, never colour alone, and each state gets its
                    own wording rather than a recoloured "On track".
                  */}
                  <span className="flex items-center gap-2 rounded-full bg-accent px-[14px] py-2">
                    <Icon
                      name={STATUS[plan.status].icon}
                      className="size-[15px] text-text-inverse"
                    />
                    <span className="font-body text-[13px] font-semibold text-text-inverse">
                      {STATUS[plan.status].label}
                    </span>
                  </span>
                </div>
              </section>

              <div className="flex flex-col gap-5 lg:flex-row">
                <section className="flex-1 rounded-2xl bg-surface p-7">
                  <StackedBarChart months={plan.projection} />
                </section>

                <div className="flex flex-col gap-5 lg:w-[380px] lg:shrink-0">
                  <section className="flex flex-col gap-[18px] rounded-2xl bg-surface p-6">
                    <div className="flex flex-col gap-1">
                      <h2 className="font-heading text-[16px] font-semibold text-text-primary">
                        This month&apos;s allocation
                      </h2>
                      <p className="font-body text-[13px] text-text-muted">
                        Based on {formatMoney(plan.allocation.income)} monthly
                        income
                      </p>
                    </div>
                    <AllocationBar allocation={plan.allocation} />
                  </section>

                  <section className="flex flex-1 flex-col gap-3.5 rounded-2xl bg-surface-soft p-6">
                    <h2 className="font-heading text-[16px] font-semibold text-text-primary">
                      How to stay on track
                    </h2>
                    <ul className="flex flex-col gap-3.5">
                      {plan.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2.5">
                          <Icon
                            name="circle-check"
                            className="mt-px size-[18px] shrink-0 text-accent"
                          />
                          <span className="font-body text-[13px] leading-[1.4] text-text-secondary">
                            {tip}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </>
          )}

          <footer className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/onboarding/know-me")}
            >
              <Icon name="arrow-left" className="size-4" />
              Back
            </Button>

            <Button
              variant="pill"
              className="px-[26px] py-3.5"
              onClick={() => router.push("/")}
            >
              Finish &amp; go to dashboard
              <Icon name="arrow-right" className="size-[17px]" />
            </Button>
          </footer>
        </div>
      </main>
    </div>
  );
}
