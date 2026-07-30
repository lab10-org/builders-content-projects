import { type InputHTMLAttributes, useState } from "react";

import { Icon } from "./icons";
import { TextField } from "./TextField";

/**
 * A `TextField` whose trailing slot holds the design's reveal toggle: eye icon
 * at 16px in text-muted plus a 13px/500 label in text-secondary, 6px apart.
 *
 * Whether the password is visible is local state on purpose — it is a display
 * concern the form has no reason to own or persist.
 */
export function PasswordField(
  props: {
    id: string;
    label: string;
    error?: string;
    className?: string;
  } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "id" | "className" | "type"
  >,
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TextField
      {...props}
      type={revealed ? "text" : "password"}
      trailing={
        <button
          // Not a submit button: revealing a password must never send the form.
          type="button"
          onClick={() => setRevealed((current) => !current)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 font-body text-[13px] font-medium text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {/* The icon shows the *current* state, the label the next action. */}
          <Icon
            name={revealed ? "eye" : "eye-off"}
            className="size-4 text-text-muted"
          />
          {revealed ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
