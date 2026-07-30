import { describe, expect, it } from "vitest";

import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  SUPPORTED_EXTENSIONS,
  type StatementFile,
  acceptFiles,
  formatBytes,
  isSupportedName,
} from "./statementFile";

/** Deterministic ids, so assertions can name them. */
function counter() {
  let next = 0;
  return () => `f${++next}`;
}

function file(name: string, size = 1024) {
  return { name, size };
}

describe("supported formats", () => {
  it("is exactly the three the design lists", () => {
    expect([...SUPPORTED_EXTENSIONS]).toEqual(["pdf", "csv", "xlsx"]);
  });

  it("caps files at the 25 MB the design states", () => {
    expect(MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
  });

  it("offers the same list to the file picker", () => {
    expect(ACCEPT_ATTRIBUTE).toBe(".pdf,.csv,.xlsx");
  });
});

describe("isSupportedName", () => {
  it.each([
    "Chase_Checking_Jun.pdf",
    "Amex_Statement_Q2.csv",
    "Fidelity_401k.xlsx",
  ])("accepts %s", (name) => {
    expect(isSupportedName(name)).toBe(true);
  });

  it("ignores case in the extension", () => {
    expect(isSupportedName("STATEMENT.PDF")).toBe(true);
  });

  it("reads the last extension, not the first dotted segment", () => {
    expect(isSupportedName("Q2.2026.statement.csv")).toBe(true);
  });

  it.each([
    ["a wrong format", "notes.docx"],
    ["no extension", "statement"],
    ["a trailing dot", "statement."],
    ["a hidden file whose whole name looks like one", ".csv"],
    ["an empty name", ""],
    ["an extension that only contains the word", "csv"],
  ])("rejects %s", (_case, name) => {
    expect(isSupportedName(name)).toBe(false);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [657408, "642 KB"],
    [1887437, "1.8 MB"],
    [2202010, "2.1 MB"],
  ])("renders %i as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("keeps one decimal for megabytes, as the design shows", () => {
    expect(formatBytes(25 * 1024 * 1024)).toBe("25.0 MB");
  });

  it("does not crash on nonsense", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
  });
});

describe("acceptFiles", () => {
  it("accepts a supported file and records its real size", () => {
    const result = acceptFiles([file("Chase.pdf", 1887437)], [], counter());

    expect(result.accepted).toEqual([
      { id: "f1", name: "Chase.pdf", bytes: 1887437 },
    ]);
    expect(result.rejected).toEqual([]);
  });

  it("accepts a whole batch at once", () => {
    const result = acceptFiles(
      [file("a.pdf"), file("b.csv"), file("c.xlsx")],
      [],
      counter(),
    );

    expect(result.accepted.map((entry) => entry.name)).toEqual([
      "a.pdf",
      "b.csv",
      "c.xlsx",
    ]);
  });

  it("turns away an unsupported format with a reason the UI can show", () => {
    const result = acceptFiles([file("notes.docx")], [], counter());

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      {
        name: "notes.docx",
        reason: "unsupported-format",
        message: "Unsupported format — use PDF, CSV or XLSX.",
      },
    ]);
  });

  it("turns away a file over the size cap", () => {
    const result = acceptFiles(
      [file("huge.pdf", MAX_FILE_BYTES + 1)],
      [],
      counter(),
    );

    expect(result.rejected[0].reason).toBe("too-large");
    expect(result.rejected[0].message).toContain("25 MB");
  });

  it("accepts a file exactly at the cap", () => {
    const result = acceptFiles([file("edge.pdf", MAX_FILE_BYTES)], [], counter());

    expect(result.accepted).toHaveLength(1);
  });

  it("reports the format problem first for a file that fails both checks", () => {
    // The wrong format is the more actionable of the two.
    const result = acceptFiles(
      [file("huge.docx", MAX_FILE_BYTES + 1)],
      [],
      counter(),
    );

    expect(result.rejected[0].reason).toBe("unsupported-format");
  });

  it("keeps the good files and reports only the bad ones", () => {
    const result = acceptFiles(
      [file("a.pdf"), file("notes.docx"), file("b.csv")],
      [],
      counter(),
    );

    expect(result.accepted.map((entry) => entry.name)).toEqual([
      "a.pdf",
      "b.csv",
    ]);
    expect(result.rejected.map((entry) => entry.name)).toEqual(["notes.docx"]);
  });

  describe("duplicates", () => {
    const EXISTING: StatementFile[] = [
      { id: "x", name: "Chase.pdf", bytes: 1000 },
    ];

    it("turns away a file already in the list", () => {
      const result = acceptFiles([file("Chase.pdf", 1000)], EXISTING, counter());

      expect(result.accepted).toEqual([]);
      expect(result.rejected[0].reason).toBe("already-added");
    });

    it("allows a same-named file of a different size", () => {
      // A re-exported statement covering a longer period is a different file.
      const result = acceptFiles([file("Chase.pdf", 2000)], EXISTING, counter());

      expect(result.accepted).toHaveLength(1);
    });

    it("catches a file duplicated inside one batch", () => {
      const result = acceptFiles(
        [file("a.pdf", 10), file("a.pdf", 10)],
        [],
        counter(),
      );

      expect(result.accepted).toHaveLength(1);
      expect(result.rejected[0].reason).toBe("already-added");
    });
  });

  it("gives every accepted file a distinct id", () => {
    const result = acceptFiles(
      [file("a.pdf", 1), file("b.pdf", 2), file("c.pdf", 3)],
      [],
      counter(),
    );

    const ids = result.accepted.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("handles an empty selection", () => {
    expect(acceptFiles([], [], counter())).toEqual({
      accepted: [],
      rejected: [],
    });
  });
});
