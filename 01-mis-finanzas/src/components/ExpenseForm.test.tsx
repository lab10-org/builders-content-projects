// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CATEGORIES, type ExpenseInput } from "../domain/expense";
import { ExpenseForm } from "./ExpenseForm";

const VALUES = {
  amount: "25000",
  date: "2026-07-02",
  description: "Almuerzo con cliente",
  category: "Comida",
} as const;

function fillValidValues() {
  fireEvent.change(screen.getByLabelText("Monto"), {
    target: { value: VALUES.amount },
  });
  fireEvent.change(screen.getByLabelText("Fecha"), {
    target: { value: VALUES.date },
  });
  fireEvent.change(screen.getByLabelText("Descripción"), {
    target: { value: VALUES.description },
  });
  fireEvent.change(screen.getByLabelText("Categoría"), {
    target: { value: VALUES.category },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
}

function inputs() {
  return {
    amount: screen.getByLabelText("Monto") as HTMLInputElement,
    date: screen.getByLabelText("Fecha") as HTMLInputElement,
    description: screen.getByLabelText("Descripción") as HTMLInputElement,
    category: screen.getByLabelText("Categoría") as HTMLSelectElement,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("category options [2.2]", () => {
  it("offers exactly the fixed list, with no extra and none missing", () => {
    render(<ExpenseForm onSubmit={() => true} />);

    const select = screen.getByLabelText("Categoría");
    const values = within(select)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value)
      .filter((value) => value !== ""); // a non-category placeholder is allowed

    expect(values).toEqual([...CATEGORIES]);
  });
});

describe("submitting [1.1]", () => {
  it("calls onSubmit once with the four field values as typed", () => {
    const onSubmit = vi.fn((_values: ExpenseInput) => true);
    render(<ExpenseForm onSubmit={onSubmit} />);

    fillValidValues();
    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      amount: "25000", // the input's string; T2 accepts numeric strings
      date: "2026-07-02",
      description: "Almuerzo con cliente",
      category: "Comida",
    });
  });

  it("does not navigate away (the submit event's default is prevented)", () => {
    render(<ExpenseForm onSubmit={() => true} />);

    fillValidValues();
    const form = screen
      .getByRole("button", { name: "Registrar" })
      .closest("form");
    const event = new Event("submit", { bubbles: true, cancelable: true });
    act(() => {
      form?.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });
});

describe("reset contract", () => {
  it("clears every input when onSubmit returns true", () => {
    render(<ExpenseForm onSubmit={() => true} />);

    fillValidValues();
    submit();

    const field = inputs();
    expect(field.amount.value).toBe("");
    expect(field.date.value).toBe("");
    expect(field.description.value).toBe("");
    expect(field.category.value).toBe("");
  });

  it("keeps every typed value when onSubmit returns false", () => {
    render(<ExpenseForm onSubmit={() => false} />);

    fillValidValues();
    submit();

    const field = inputs();
    expect(field.amount.value).toBe(VALUES.amount);
    expect(field.date.value).toBe(VALUES.date);
    expect(field.description.value).toBe(VALUES.description);
    expect(field.category.value).toBe(VALUES.category);
  });

  it("submits invalid values too — the domain, not the browser, validates", () => {
    const onSubmit = vi.fn((_values: ExpenseInput) => false);
    render(<ExpenseForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: "-5" },
    });
    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      amount: "-5",
      description: "",
      category: "",
    });
  });
});

/**
 * Resolves the message an input points at through `aria-describedby`.
 * Returns `null` when the input carries no such link.
 *
 * The message copy itself comes from the domain's `ValidationError.message`
 * (T3 only guarantees it is non-empty), so the tests assert the *link* and that
 * it resolves to non-empty text — never the copy.
 */
function describedByText(input: HTMLElement): string | null {
  const id = input.getAttribute("aria-describedby");
  if (id === null) return null;
  return document.getElementById(id)?.textContent ?? "";
}

describe("validation messages [1.6]", () => {
  const AMOUNT_ERROR = {
    field: "amount",
    message: "El monto debe ser un número mayor que cero.",
  } as const;
  const DESCRIPTION_ERROR = {
    field: "description",
    message: "La descripción no puede estar vacía.",
  } as const;

  it("links a message to each invalid field and to no other", () => {
    render(
      <ExpenseForm
        onSubmit={() => false}
        errors={[AMOUNT_ERROR, DESCRIPTION_ERROR]}
      />,
    );

    const field = inputs();
    expect(describedByText(field.amount)).not.toBe(null);
    expect((describedByText(field.amount) ?? "").trim().length).toBeGreaterThan(
      0,
    );
    expect(describedByText(field.description)).not.toBe(null);
    expect(
      (describedByText(field.description) ?? "").trim().length,
    ).toBeGreaterThan(0);

    expect(field.date.getAttribute("aria-describedby")).toBeNull();
    expect(field.category.getAttribute("aria-describedby")).toBeNull();
  });

  it("renders no message links at all when there are no errors", () => {
    render(<ExpenseForm onSubmit={() => false} />);

    const field = inputs();
    for (const input of Object.values(field)) {
      expect(input.getAttribute("aria-describedby")).toBeNull();
    }
  });

  it("keeps the typed values while showing errors", () => {
    render(<ExpenseForm onSubmit={() => false} errors={[AMOUNT_ERROR]} />);

    fillValidValues();
    submit();

    expect(inputs().amount.value).toBe(VALUES.amount);
    expect(inputs().description.value).toBe(VALUES.description);
  });
});

describe("save error [4.6]", () => {
  const SAVE_ERROR = "No se pudo guardar el gasto. Vuelve a intentarlo.";

  it("shows the save-error message when given one", () => {
    render(<ExpenseForm onSubmit={() => false} saveError={SAVE_ERROR} />);

    expect(screen.getByText(SAVE_ERROR)).toBeDefined();
  });

  it("shows no save-error message by default", () => {
    render(<ExpenseForm onSubmit={() => false} />);

    expect(screen.queryByText(SAVE_ERROR)).toBeNull();
  });
});

/**
 * A `fetch`-shaped success. The implementation checks `res.ok` before reading
 * the payload, so a bare `{ category }` would fail the happy path for the wrong
 * reason.
 */
function fetchOk(category: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ category }),
  }));
}

function suggestButton() {
  return screen.getByRole("button", { name: "Sugerir" }) as HTMLButtonElement;
}

describe("AI suggestion [3.2, 3.5, 3.6]", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the description and prefills the category [3.2]", async () => {
    const fetchMock = fetchOk("Comida");
    vi.stubGlobal("fetch", fetchMock);
    const onSubmit = vi.fn((_values: ExpenseInput) => true);
    render(<ExpenseForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Almuerzo con cliente" },
    });
    fireEvent.click(suggestButton());

    // The state update lands only after the fetch promise resolves.
    await screen.findByDisplayValue("Comida");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/suggest-category");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "Almuerzo con cliente",
    });

    // Suggesting must not submit the expense.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("leaves the suggested category editable [3.3]", async () => {
    vi.stubGlobal("fetch", fetchOk("Comida"));
    render(<ExpenseForm onSubmit={() => true} />);

    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Almuerzo con cliente" },
    });
    fireEvent.click(suggestButton());
    await screen.findByDisplayValue("Comida");

    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "Transporte" },
    });

    expect(inputs().category.value).toBe("Transporte");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])("does not call fetch for a %s description [3.5]", async (_label, text) => {
    const fetchMock = fetchOk("Comida");
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseForm onSubmit={() => true} />);

    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: text },
    });
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "Salud" },
    });
    fireEvent.click(suggestButton());

    expect(fetchMock).not.toHaveBeenCalled();
    // The user's current choice is untouched and still editable.
    expect(inputs().category.value).toBe("Salud");
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "Ocio" },
    });
    expect(inputs().category.value).toBe("Ocio");
  });

  it.each([
    [
      "a rejected fetch (network failure / timeout)",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    ],
    [
      "a 502 response",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: "No se pudo obtener una sugerencia." }),
      })),
    ],
  ])("keeps the form usable after %s [3.6]", async (_label, fetchMock) => {
    vi.stubGlobal("fetch", fetchMock);
    const onSubmit = vi.fn((_values: ExpenseInput) => true);
    render(<ExpenseForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Almuerzo con cliente" },
    });
    fireEvent.click(suggestButton());

    // No failure path may leave the button disabled.
    await waitFor(() => expect(suggestButton().disabled).toBe(false));

    // Manual registration still works — the real proof of "does not block".
    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: "25000" },
    });
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-07-02" },
    });
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "Transporte" },
    });
    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      amount: "25000",
      category: "Transporte",
    });
  });
});
