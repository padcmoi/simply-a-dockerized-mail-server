// A column's value as text. Read by all three parts of `DataTable`: the wrapper matches the search
// against it, and both renderings fall back to it for a cell the caller wrote no slot for. One
// definition, so a row that searches as "true" also reads as "true".
//
// A missing value is the empty string and not "null": the word would otherwise be a search term that
// matches every blank cell in the table.
// What a column is called when the search is narrowed to it: its own key, or the
// name the API knows it by where the two differ. One definition, so the value
// the scope select carries is the one a server-paged caller puts on the query.
export function dataTableSearchKey<T>(column: DataTableColumn<T>) {
  return column.searchKey ?? column.key;
}

export function dataTableText<T>(column: DataTableColumn<T>, row: T) {
  const value = column.value(row);
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function toggleKeys<K>(selected: K[], keys: K[], ticked: boolean) {
  if (ticked) return [...new Set([...selected, ...keys])];
  const dropped = new Set(keys);
  return selected.filter((key) => !dropped.has(key));
}

export function pageSelectionState<K>(selected: K[], pageKeys: K[]) {
  const chosen = new Set(selected);
  const ticked = pageKeys.filter((key) => chosen.has(key)).length;
  if (!ticked) return false;
  return ticked === pageKeys.length ? true : ("indeterminate" as const);
}
