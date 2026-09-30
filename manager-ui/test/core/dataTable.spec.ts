import { describe, it, expect } from "vitest";
import type { DataTableColumn } from "~/types/ui/data-table";
import { dataTableText, pageSelectionState, toggleKeys } from "~/utils/dataTable";

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

// The selection is a list of row keys, so it outlives a page change: ticking a
// row of page 2 must keep the ones ticked on page 1, and unticking a page only
// drops that page's keys.
describe("toggleKeys", () => {
  it("adds keys once, keeping the ones already chosen on other pages", () => {
    expect(toggleKeys(["a", "b"], ["b", "c"], true)).toEqual(["a", "b", "c"]);
  });

  it("drops only the given keys", () => {
    expect(toggleKeys(["a", "b", "c", "d"], ["b", "d"], false)).toEqual(["a", "c"]);
  });

  it("leaves the selection alone when unticking keys that were not chosen", () => {
    expect(toggleKeys([1, 2], [3], false)).toEqual([1, 2]);
  });
});

describe("pageSelectionState", () => {
  it("is false when no row of the page is chosen, whatever other pages hold", () => {
    expect(pageSelectionState(["x", "y"], ["a", "b"])).toBe(false);
  });

  it("is indeterminate when part of the page is chosen", () => {
    expect(pageSelectionState(["a", "x"], ["a", "b"])).toBe("indeterminate");
  });

  it("is true when every row of the page is chosen", () => {
    expect(pageSelectionState(["a", "b", "x"], ["a", "b"])).toBe(true);
  });

  it("is false on an empty page", () => {
    expect(pageSelectionState(["a"], [])).toBe(false);
  });
});
