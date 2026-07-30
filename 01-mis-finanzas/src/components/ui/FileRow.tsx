import { type StatementFile, formatBytes } from "../../domain/statementFile";
import { Icon } from "./icons";

/**
 * One row of the "Uploaded" list: icon tile, name and size, a status pill, and a
 * remove control.
 *
 * NOTE: the design shows a third row mid-upload ("2.1 MB · uploading…", "63%").
 * There is no backend to upload to, so every accepted file is simply `Ready`;
 * animating a fake progress bar would assert something untrue about where the
 * file went.
 */
export function FileRow({
  file,
  onRemove,
}: {
  file: StatementFile;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-soft">
        <Icon name="file-text" className="size-[18px] text-accent" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-body text-[14px] font-medium text-text-primary">
          {file.name}
        </span>
        <span className="font-body text-[12px] text-text-muted">
          {formatBytes(file.bytes)}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-sage px-2.5 py-[5px]">
        <Icon name="circle-check" className="size-[13px] text-accent" />
        <span className="font-body text-[12px] font-medium text-accent">
          Ready
        </span>
      </span>

      <button
        type="button"
        onClick={() => onRemove(file.id)}
        // Named per file: a list of identical "Remove" buttons is unusable with a
        // screen reader.
        aria-label={`Remove ${file.name}`}
        className="shrink-0 cursor-pointer rounded-full p-1 text-text-muted transition-colors hover:bg-surface-soft hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="x" className="size-[18px]" />
      </button>
    </li>
  );
}
