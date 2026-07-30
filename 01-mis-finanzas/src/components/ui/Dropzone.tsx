import { type DragEvent, useRef, useState } from "react";

import {
  ACCEPT_ATTRIBUTE,
  SUPPORTED_EXTENSIONS,
} from "../../domain/statementFile";
import { Icon } from "./icons";
import { cx } from "./cx";

/**
 * The upload target: a 2px accent-dashed-free bordered panel with an icon
 * circle, a title, the formats caption and a "Browse files" pill.
 *
 * Both routes in — dropping and picking — end at the same `onFiles` callback, so
 * the caller has one path to validate. Nothing is read from the files here.
 */
export function Dropzone({
  onFiles,
  className,
}: {
  onFiles: (files: File[]) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    // Without this the browser navigates to the dropped file, replacing the app.
    event.preventDefault();
    setDragging(false);
    onFiles([...event.dataTransfer.files]);
  }

  return (
    <div
      // A region rather than a button: it contains its own button, and nesting
      // interactive elements would make the inner one unreachable.
      role="region"
      aria-label="Upload statements"
      onDragOver={(event) => {
        // Also required — the drop event never fires without it.
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cx(
        // Grows to fill the tile (which is as tall as the snapshot beside it) but
        // capped, so an empty list does not turn into a 600px void.
        "flex min-h-[280px] max-h-[440px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 p-10 text-center transition-colors",
        dragging ? "border-accent bg-surface-soft" : "border-accent bg-surface",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-soft">
        <Icon name="cloud-upload" className="size-7 text-accent" />
      </span>

      <p className="font-heading text-[17px] font-medium text-text-primary">
        Drag &amp; drop your statements
      </p>
      <p className="font-body text-[13px] text-text-muted">
        Supported formats: {SUPPORTED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}{" "}
        · up to 25 MB
      </p>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-[18px] py-2.5 font-body text-[14px] font-medium text-text-inverse shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="folder-open" className="size-4" />
        Browse files
      </button>

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        // Labelled for the accessibility tree even though the visible affordance
        // is the button above.
        aria-label="Choose statement files"
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          // Reset, so picking the same file twice still fires a change event and
          // the caller gets to report "already added".
          event.target.value = "";
        }}
      />
    </div>
  );
}
