/**
 * The rules behind the "Know me" upload tile.
 *
 * Files are accepted, listed and counted — never read. Nothing here parses a
 * statement: without a backend there is nothing to send them to, and inventing a
 * parse result would be worse than showing none.
 */

/** From the design's caption: "Supported formats: PDF, CSV, XLSX · up to 25 MB". */
export const SUPPORTED_EXTENSIONS = ["pdf", "csv", "xlsx"] as const;

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** What the file input should offer, derived so the two cannot drift apart. */
export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");

export interface StatementFile {
  id: string;
  name: string;
  bytes: number;
}

export type RejectionReason =
  | "unsupported-format"
  | "too-large"
  | "already-added";

export interface Rejection {
  name: string;
  reason: RejectionReason;
  message: string;
}

export interface AcceptResult {
  accepted: StatementFile[];
  rejected: Rejection[];
}

/** English, matching the screen. */
const MESSAGES: Record<RejectionReason, string> = {
  "unsupported-format": "Unsupported format — use PDF, CSV or XLSX.",
  "too-large": "File is over 25 MB.",
  "already-added": "Already added.",
};

/**
 * The lowercase extension of a filename, or `null` when there is none.
 *
 * `lastIndexOf` rather than `split`, so `Q2.2026.statement.csv` reads as `csv`
 * and not as `2026`. A leading-dot name like `.csv` has no extension — it is a
 * hidden file whose whole name is `.csv`.
 */
function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function isSupportedName(name: string): boolean {
  const extension = extensionOf(name);
  return (
    extension !== null &&
    (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)
  );
}

/**
 * Renders a size the way the design does: "642 KB", "1.8 MB".
 *
 * Binary units (1 KB = 1024 B), which is what a file manager shows. MB keeps one
 * decimal; anything smaller is rounded to whole units, since "1.8 KB" of
 * precision is noise at that scale.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;

  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Two files are the same statement if both name and size match. */
function isSameFile(a: { name: string; bytes: number }, b: StatementFile) {
  return a.name === b.name && a.bytes === b.bytes;
}

/**
 * Sorts a dropped or picked batch into what the list accepts and what it turns
 * away, checked against `existing` so a second drop of the same statement does
 * not double it up.
 *
 * `nextId` is injected rather than generated here so the caller controls
 * identity — the UI passes `crypto.randomUUID`, tests pass a counter.
 */
export function acceptFiles(
  incoming: readonly { name: string; size: number }[],
  existing: readonly StatementFile[],
  nextId: () => string,
): AcceptResult {
  const accepted: StatementFile[] = [];
  const rejected: Rejection[] = [];

  for (const file of incoming) {
    const candidate = { name: file.name, bytes: file.size };

    // Order matters: a 40 MB .docx is reported as the wrong format, which is the
    // more actionable of the two problems.
    if (!isSupportedName(file.name)) {
      rejected.push(reject(file.name, "unsupported-format"));
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push(reject(file.name, "too-large"));
      continue;
    }
    // Compared against what is already accepted *in this batch* too, so dropping
    // the same file twice at once is caught.
    if (
      existing.some((entry) => isSameFile(candidate, entry)) ||
      accepted.some((entry) => isSameFile(candidate, entry))
    ) {
      rejected.push(reject(file.name, "already-added"));
      continue;
    }

    accepted.push({ id: nextId(), name: file.name, bytes: file.size });
  }

  return { accepted, rejected };
}

function reject(name: string, reason: RejectionReason): Rejection {
  return { name, reason, message: MESSAGES[reason] };
}
