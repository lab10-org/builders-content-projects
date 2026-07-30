"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  type TransactionDraft,
  TransactionForm,
} from "../../../src/components/TransactionForm";
import { BarList } from "../../../src/components/ui/BarList";
import { Button } from "../../../src/components/ui/Button";
import { Dropzone } from "../../../src/components/ui/Dropzone";
import { FileRow } from "../../../src/components/ui/FileRow";
import { HighlightList } from "../../../src/components/ui/HighlightList";
import { StatTile } from "../../../src/components/ui/StatTile";
import { Stepper } from "../../../src/components/ui/Stepper";
import { TransactionRow } from "../../../src/components/ui/TransactionRow";
import { Wordmark } from "../../../src/components/ui/Wordmark";
import { Icon } from "../../../src/components/ui/icons";
import { buildSeedTransactions } from "../../../src/domain/seedTransactions";
import { summarize } from "../../../src/domain/snapshot";
import {
  type Rejection,
  type StatementFile,
  acceptFiles,
} from "../../../src/domain/statementFile";
import {
  type Transaction,
  type ValidationError,
  createTransaction,
} from "../../../src/domain/transaction";
import {
  loadTransactions,
  saveTransactions,
} from "../../../src/storage/transactionStorage";
import { formatMoney, formatPercent } from "../../../src/format/money";

const STEPS = ["Account", "Profile", "Know Me", "Plan"];

const SAVE_ERROR_MESSAGE = "Could not save that transaction. Please try again.";

/** How many of the user's own entries the "Recently added" list shows. */
const RECENT_LIMIT = 4;

/** `YYYY-MM-DD` for today, in local time — not UTC, which can be a day off. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function KnowMe() {
  const router = useRouter();

  const [files, setFiles] = useState<StatementFile[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [stored, setStored] = useState<Transaction[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Read storage in a mount effect, never during render: `localStorage` does not
  // exist while Next.js renders this on the server.
  useEffect(() => {
    setStored(loadTransactions());
  }, []);

  /**
   * Demo data plus whatever the user has entered. The seed is never written to
   * storage, so the `/` expenses screen keeps showing only real entries — but the
   * figures here still respond to anything added.
   */
  const snapshot = useMemo(() => {
    const seed = buildSeedTransactions(today());
    return summarize([...seed, ...stored]);
  }, [stored]);

  function handleFiles(picked: File[]) {
    const result = acceptFiles(picked, files, () => crypto.randomUUID());
    setFiles((current) => [...current, ...result.accepted]);
    // Replaced, not accumulated, so a corrected second attempt clears the notice.
    setRejections(result.rejected);
  }

  function handleAdd(draft: TransactionDraft): boolean {
    const result = createTransaction({
      type: draft.type,
      description: draft.description,
      amount: draft.amount,
      currency: draft.currency,
      category: draft.category,
      // The design's form has no date field, so today's is supplied here rather
      // than the domain dropping its date requirement.
      date: today(),
    });

    if (!result.ok) {
      setErrors(result.errors);
      setSaveError(null);
      return false;
    }

    const next = [...stored, result.transaction];
    try {
      saveTransactions(next);
    } catch {
      // Nothing is added to the list either: a failed write must not leave the
      // screen claiming the transaction was recorded.
      setErrors([]);
      setSaveError(SAVE_ERROR_MESSAGE);
      return false;
    }

    setErrors([]);
    setSaveError(null);
    setStored(next);
    return true;
  }

  const recent = [...stored].reverse().slice(0, RECENT_LIMIT);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-5 lg:px-10">
        <Wordmark tone="brand" />
        <Stepper steps={STEPS} currentIndex={2} />
      </header>

      <main className="flex flex-1 justify-center px-6 py-9 lg:px-12">
        <div className="flex w-full max-w-[1080px] flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Upload tile */}
            <section className="flex flex-1 flex-col gap-5 rounded-2xl bg-surface p-7">
              <div className="flex flex-col gap-1.5">
                <h1 className="font-heading text-[24px] font-semibold text-text-primary">
                  Know me
                </h1>
                <p className="font-body text-[14px] leading-[1.4] text-text-secondary">
                  Upload your recent statements so Northstar can understand your
                  finances.
                </p>
              </div>

              <Dropzone onFiles={handleFiles} />

              {rejections.length > 0 && (
                <ul className="flex flex-col gap-1" role="alert">
                  {rejections.map((rejection) => (
                    <li
                      key={`${rejection.name}-${rejection.reason}`}
                      className="font-body text-[13px] text-danger"
                    >
                      {rejection.name}: {rejection.message}
                    </li>
                  ))}
                </ul>
              )}

              {files.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <h2 className="font-body text-[13px] font-semibold text-text-secondary">
                    Uploaded ({files.length})
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {files.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        onRemove={(id) =>
                          setFiles((current) =>
                            current.filter((entry) => entry.id !== id),
                          )
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Snapshot tile */}
            <section className="flex flex-col gap-[18px] rounded-2xl bg-surface p-7 lg:w-[400px] lg:shrink-0">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-[17px] font-semibold text-text-primary">
                  Your financial snapshot
                </h2>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1">
                  <Icon name="sparkles" className="size-3 text-accent" />
                  <span className="font-body text-[11px] font-medium text-accent">
                    Generated
                  </span>
                </span>
              </div>

              {snapshot === null ? (
                <p className="font-body text-[13px] text-text-muted">
                  Add a transaction to see your snapshot.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex gap-2.5">
                      <StatTile
                        tone="inverse"
                        value={formatMoney(snapshot.balance)}
                        caption="Total balance"
                      />
                      <StatTile
                        value={formatPercent(snapshot.savingsRate)}
                        caption="Savings rate"
                      />
                    </div>
                    <div className="flex gap-2.5">
                      <StatTile
                        value={formatMoney(snapshot.income)}
                        caption="Monthly income"
                      />
                      <StatTile
                        value={formatMoney(snapshot.spending)}
                        caption="Monthly spending"
                      />
                    </div>
                  </div>

                  {snapshot.byCategory.length > 0 && (
                    <BarList items={snapshot.byCategory} />
                  )}
                  <HighlightList highlights={snapshot.highlights} />
                </>
              )}
            </section>
          </div>

          {/* Manual entry tile */}
          <section className="flex flex-col gap-5 rounded-2xl bg-surface p-7">
            <TransactionForm onSubmit={handleAdd} errors={errors} />

            {saveError !== null && (
              <p role="alert" className="font-body text-[14px] text-danger">
                {saveError}
              </p>
            )}

            {recent.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h3 className="font-body text-[12px] font-semibold tracking-[0.5px] text-text-muted">
                  RECENTLY ADDED
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {recent.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <footer className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/onboarding/profile")}
            >
              <Icon name="arrow-left" className="size-4" />
              Back
            </Button>

            <Button variant="pill" onClick={() => router.push("/onboarding/plan")}>
              Continue to plan
              <Icon name="arrow-right" className="size-4" />
            </Button>
          </footer>
        </div>
      </main>
    </div>
  );
}
