import { applyDecorators } from "@nestjs/common";
import { ApiQuery } from "@nestjs/swagger";

// Shared Swagger query params for every paginated list endpoint (see
// pagination.validation.ts). `limit` absent = legacy unpaginated array,
// kept for internal-only consumers (dashboards, pickers) -- not part of
// the documented public contract, so it isn't called out below.
export const ApiPaginationQuery = (sortableColumns: readonly string[]) =>
  applyDecorators(
    ApiQuery({ name: "limit", required: false, enum: [10, 25, 50], description: "Page size" }),
    ApiQuery({ name: "offset", required: false, type: Number, description: "Rows to skip" }),
    ApiQuery({ name: "search", required: false, type: String, description: "Free-text filter" }),
    ApiQuery({
      name: "sortDir",
      required: false,
      enum: ["asc", "desc"],
      description: "asc = ascending, desc = descending (default)",
    }),
    ApiQuery({
      name: "sortBy",
      required: false,
      enum: sortableColumns,
      description: "Column to sort by; falls back to the endpoint's default when absent or unrecognized",
    })
  );

export function paginatedExample<T>(itemExample: T, total = 1) {
  return { items: [itemExample], total };
}
