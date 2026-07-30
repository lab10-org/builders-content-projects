// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadTransactions } from "../../../src/storage/transactionStorage";
import KnowMe from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A `File` whose reported size the validator will actually read. */
function file(name: string, size: number): File {
  const handle = new File(["x"], name);
  Object.defineProperty(handle, "size", { value: size });
  return handle;
}

function drop(files: File[]) {
  fireEvent.drop(screen.getByRole("region", { name: "Upload statements" }), {
    dataTransfer: { files },
  });
}

function addTransaction({
  description = "Groceries — Whole Foods",
  amount = "142.30",
  category = "food",
  type,
}: {
  description?: string;
  amount?: string;
  category?: string;
  type?: "income" | "expense";
} = {}) {
  if (type === "income") {
    fireEvent.click(screen.getByRole("radio", { name: /Income/ }));
  }
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: description },
  });
  fireEvent.change(screen.getByLabelText("Value"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: category },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

describe("the page chrome", () => {
  it("puts the user on the third step", () => {
    render(<KnowMe />);

    expect(
      screen.getByText("Know Me").closest("li")?.getAttribute("aria-current"),
    ).toBe("step");
  });

  it("carries the design's heading and subtitle", () => {
    render(<KnowMe />);

    expect(screen.getByRole("heading", { name: "Know me" })).toBeDefined();
    expect(
      screen.getByText(/Upload your recent statements so Northstar/),
    ).toBeDefined();
  });
});

describe("the snapshot", () => {
  it("opens on the figures the design shows", async () => {
    render(<KnowMe />);

    expect(await screen.findByText("$48,920")).toBeDefined();
    expect(screen.getByText("23%")).toBeDefined();
    expect(screen.getByText("$7,450")).toBeDefined();
    expect(screen.getByText("$5,710")).toBeDefined();
  });

  it("captions each figure as the design does", async () => {
    render(<KnowMe />);

    for (const caption of [
      "Total balance",
      "Savings rate",
      "Monthly income",
      "Monthly spending",
    ]) {
      expect(await screen.findByText(caption)).toBeDefined();
    }
  });

  it("breaks spending down by category", async () => {
    render(<KnowMe />);
    const title = await screen.findByText("Spending by category");

    // Scoped: "Housing" also appears in the highlight beneath the bars.
    const bars = within(title.closest("div") as HTMLElement);

    expect(bars.getByText("Housing")).toBeDefined();
    expect(bars.getByText("$2,180")).toBeDefined();
  });

  it("accounts for the whole month, not just the four biggest categories", async () => {
    // The mockup's four bars sum to $3,990 against a stated $5,710 — every
    // category is listed here so the bars reconcile with the total.
    render(<KnowMe />);
    await screen.findByText("Spending by category");

    const rows = within(
      screen.getByText("Spending by category").closest("div") as HTMLElement,
    ).getAllByRole("listitem");

    expect(rows.length).toBeGreaterThan(4);
  });

  it("lists the highlights", async () => {
    render(<KnowMe />);

    expect(
      await screen.findByText("Spending is down 8% vs. last month."),
    ).toBeDefined();
    expect(
      screen.getByText("Housing is your top category at 38%."),
    ).toBeDefined();
    expect(screen.getByText("2 subscriptions cost $310 a month.")).toBeDefined();
  });

  it("marks the snapshot as generated", async () => {
    render(<KnowMe />);

    expect(await screen.findByText("Generated")).toBeDefined();
  });

  it("moves the figures when a transaction is added", async () => {
    render(<KnowMe />);
    await screen.findByText("$5,710");

    addTransaction({ amount: "290", category: "food" });

    // 5710 + 290 — the seed is recomputed with the new entry, not replaced.
    expect(await screen.findByText("$6,000")).toBeDefined();
  });
});

describe("uploading statements", () => {
  it("lists an accepted file with its real size", () => {
    render(<KnowMe />);

    drop([file("Chase_Checking_Jun.pdf", 1887437)]);

    expect(screen.getByText("Chase_Checking_Jun.pdf")).toBeDefined();
    expect(screen.getByText("1.8 MB")).toBeDefined();
  });

  it("counts what has been uploaded", () => {
    render(<KnowMe />);

    drop([file("a.pdf", 1000), file("b.csv", 2000)]);

    expect(screen.getByText("Uploaded (2)")).toBeDefined();
  });

  it("explains why a wrong format was turned away", () => {
    render(<KnowMe />);

    drop([file("notes.docx", 1000)]);

    expect(screen.getByRole("alert").textContent).toContain(
      "Unsupported format",
    );
    expect(screen.queryByText("notes.docx")).toBeNull();
  });

  it("explains why an oversized file was turned away", () => {
    render(<KnowMe />);

    drop([file("huge.pdf", 26 * 1024 * 1024)]);

    expect(screen.getByRole("alert").textContent).toContain("25 MB");
  });

  it("keeps the good file and rejects the bad one from the same drop", () => {
    render(<KnowMe />);

    drop([file("good.pdf", 1000), file("bad.docx", 1000)]);

    expect(screen.getByText("good.pdf")).toBeDefined();
    expect(screen.getByText("Uploaded (1)")).toBeDefined();
  });

  it("clears an old rejection once a later drop is clean", () => {
    render(<KnowMe />);

    drop([file("notes.docx", 1000)]);
    expect(screen.getByRole("alert")).toBeDefined();

    drop([file("ok.pdf", 1000)]);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("removes a file when asked", () => {
    render(<KnowMe />);
    drop([file("a.pdf", 1000)]);

    fireEvent.click(screen.getByRole("button", { name: "Remove a.pdf" }));

    expect(screen.queryByText("a.pdf")).toBeNull();
  });

  it("does not claim a file was parsed", () => {
    // Nothing reads the file, so the row says it is ready — not that it produced
    // any of the figures beside it.
    render(<KnowMe />);

    drop([file("a.pdf", 1000)]);

    expect(screen.getByText("Ready")).toBeDefined();
  });
});

describe("adding a transaction", () => {
  it("stores what was entered", () => {
    render(<KnowMe />);

    addTransaction();

    const stored = loadTransactions();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      type: "expense",
      amount: 142.3,
      currency: "USD",
      description: "Groceries — Whole Foods",
      category: "food",
    });
  });

  it("stamps it with today's date, since the form has no date field", () => {
    render(<KnowMe />);

    addTransaction();

    expect(loadTransactions()[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("records income when the toggle is switched", () => {
    render(<KnowMe />);

    addTransaction({ description: "Freelance project", amount: "1200", type: "income" });

    expect(loadTransactions()[0].type).toBe("income");
  });

  it("shows it under Recently added, with a signed amount", async () => {
    render(<KnowMe />);

    addTransaction({ description: "Freelance project", amount: "1200", type: "income" });

    expect(await screen.findByText("Freelance project")).toBeDefined();
    expect(screen.getByText("+$1,200.00")).toBeDefined();
    expect(screen.getByText("Income · USD")).toBeDefined();
  });

  it("signs an expense negative", async () => {
    render(<KnowMe />);

    addTransaction();

    expect(await screen.findByText("-$142.30")).toBeDefined();
  });

  it("clears the row after a clean submission", async () => {
    render(<KnowMe />);

    addTransaction();

    await screen.findByText("-$142.30");
    expect(screen.getByLabelText<HTMLInputElement>("Description").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Value").value).toBe("");
  });

  it("offers the category the Spanish form cannot", () => {
    render(<KnowMe />);

    expect(
      within(screen.getByLabelText("Category")).getByRole("option", {
        name: "Subscriptions",
      }),
    ).toBeDefined();
  });

  describe("when the entry is incomplete", () => {
    it("reports the missing amount and category", () => {
      render(<KnowMe />);

      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Something" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByLabelText("Value").getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(
        screen.getByLabelText("Category").getAttribute("aria-invalid"),
      ).toBe("true");
    });

    it("stores nothing", () => {
      render(<KnowMe />);

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(loadTransactions()).toEqual([]);
    });

    it("keeps what was typed", () => {
      render(<KnowMe />);

      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Something" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByLabelText<HTMLInputElement>("Description").value).toBe(
        "Something",
      );
    });
  });

  it("says so when the write fails, and adds nothing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<KnowMe />);

    addTransaction();

    expect(screen.getByRole("alert").textContent).toContain("Could not save");
    expect(screen.queryByText("-$142.30")).toBeNull();
  });
});

describe("navigation", () => {
  it("goes back to the profile step", () => {
    render(<KnowMe />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(push).toHaveBeenCalledWith("/onboarding/profile");
  });

  it("continues to the plan", () => {
    render(<KnowMe />);

    fireEvent.click(screen.getByRole("button", { name: "Continue to plan" }));

    expect(push).toHaveBeenCalledWith("/onboarding/plan");
  });
});

describe("demo data", () => {
  it("is never written to storage, so the expenses screen stays the user's", async () => {
    // The seed exists to make this screen open on the designed figures; it is not
    // the user's data and must not leak into `/`.
    render(<KnowMe />);
    await screen.findByText("$48,920");

    expect(loadTransactions()).toEqual([]);
  });
});
