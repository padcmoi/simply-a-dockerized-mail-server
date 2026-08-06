import { describe, it, expect } from "vitest";
import type { DataTableColumn } from "~/types/data-table";
import { dataTableText } from "~/utils/dataTable";

interface Row {
  name: string;
  count: number;
  active: boolean;
  seenAt: Date | null;
  note?: string | null;
}

const row: Row = { name: "alice", count: 3, active: false, seenAt: new Date("2026-08-05T10:00:00.000Z"), note: null };

function textOf(value: DataTableColumn<Row>["value"]) {
  return dataTableText({ key: "x", label: "X", value }, row);
}

// One definition of what a column reads as, shared by the three parts of the
// table: the search matches against it, and both renderings fall back to it for
// a cell nobody wrote a template for. A row that searches as "false" has to read
// as "false" too.
describe("dataTableText", () => {
  it("writes a string, a number and a boolean as they read", () => {
    expect(textOf((r) => r.name)).toBe("alice");
    expect(textOf((r) => r.count)).toBe("3");
    expect(textOf((r) => r.active)).toBe("false");
  });

  it("writes a date in a form that sorts and searches the same everywhere", () => {
    expect(textOf((r) => r.seenAt)).toBe("2026-08-05T10:00:00.000Z");
  });

  // Never the word "null": it would be a search term matching every blank cell
  // of the table.
  it("writes a missing value as nothing at all", () => {
    expect(textOf((r) => r.note)).toBe("");
    expect(textOf(() => undefined)).toBe("");
  });
});
