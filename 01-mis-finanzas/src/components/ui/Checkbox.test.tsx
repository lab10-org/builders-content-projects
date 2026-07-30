// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("is a real checkbox, so it announces its role and state", () => {
    render(<Checkbox id="remember" label="Remember me" checked={false} />);

    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeDefined();
  });

  it("reflects the unchecked state", () => {
    render(<Checkbox id="remember" label="Remember me" checked={false} />);

    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(false);
  });

  it("reflects the checked state", () => {
    render(<Checkbox id="remember" label="Remember me" checked />);

    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(true);
  });

  it("reports the value it is being toggled to", () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        id="remember"
        label="Remember me"
        checked={false}
        onCheckedChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reports being toggled back off", () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        id="remember"
        label="Remember me"
        checked
        onCheckedChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("toggles when the label text is clicked", () => {
    // The 18px box is a small target; the label has to be part of it.
    const onChange = vi.fn();
    render(
      <Checkbox
        id="remember"
        label="Remember me"
        checked={false}
        onCheckedChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Remember me"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("draws a checkmark only when checked", () => {
    const { container: unchecked } = render(
      <Checkbox id="a" label="Remember me" checked={false} />,
    );
    expect(unchecked.querySelector("svg")).toBeNull();

    const { container: checked } = render(
      <Checkbox id="b" label="Remember me" checked />,
    );
    expect(checked.querySelector("svg")).not.toBeNull();
  });
});
