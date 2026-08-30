// One column descriptor for `DataTable`, read by both of its renderings: the
// table on a wide screen and the cards below it. Declaring a column twice, once
// per rendering, is exactly what the component exists to avoid.
export interface DataTableColumn<T> {
  // Identifies the column and names its cell slot.
  key: string;
  label: string;
  // What the column IS: the value sorting compares, searching matches and the
  // cell falls back to. An accessor and not a field name, so the row keeps its
  // own type: `row[key]` would force every caller's interface to carry a string
  // index signature, and the compiler would stop catching a misspelt column.
  //
  // How the column LOOKS is the caller's `#<key>` slot, which is optional and
  // independent: a cell can render a badge while still sorting on the boolean
  // behind it.
  value: (row: T) => string | number | boolean | Date | null | undefined;
  // Sorting and searching are opt-OUT: a column carries text until it says
  // otherwise, and a column nobody can sort or search is the exception.
  sortable?: boolean;
  searchable?: boolean;
  // Heads its card on a narrow screen. One per table; the others become
  // label/value pairs underneath. Falls back to the first column.
  primary?: boolean;
  // Kept in the table, dropped from the cards. For columns that only make sense
  // beside the others.
  hideOnCard?: boolean;
  class?: string;
}
