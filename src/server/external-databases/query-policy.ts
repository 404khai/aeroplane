import type { ExternalColumn } from "../../shared/external-database.js";
export const sensitiveColumn =
  /password|passwd|secret|token|credential|private|session|salt|hash|otp|recovery|mfa|two.?factor|key|cookie|connection.?string|authorization|verification|reset|signing|encryption|bearer|totp|pin.?code/i;
export const quoteIdentifier = (value: string) =>
  `"${value.replace(/"/g, '""')}"`;
export type BrowseOptions = {
  offset: number;
  limit: number;
  search: string;
  sort: string;
  descending: boolean;
  filterColumn: string;
  filterValue: string;
};
export function buildRowsQuery(
  schema: string,
  table: string,
  columns: ExternalColumn[],
  options: BrowseOptions,
) {
  const safe = columns.filter((c) => !c.masked);
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 100 ||
    !Number.isInteger(options.offset) ||
    options.offset < 0 ||
    options.offset > 100_000
  )
    throw new Error("Invalid page");
  if (!safe.length) return { text: "SELECT NULL WHERE false", values: [] };
  const values: (string | number)[] = [];
  const where: string[] = [];
  const bind = (value: string | number) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (options.search) {
    const param = bind(options.search.slice(0, 200));
    where.push(
      `(${safe.map((c) => `strpos(lower(${quoteIdentifier(c.name)}::text), lower(${param})) > 0`).join(" OR ")})`,
    );
  }
  if (options.filterColumn) {
    if (!safe.some((c) => c.name === options.filterColumn))
      throw new Error("Invalid filter column");
    where.push(
      `${quoteIdentifier(options.filterColumn)}::text = ${bind(options.filterValue.slice(0, 2048))}`,
    );
  }
  const sort =
    safe.find((c) => c.name === options.sort) ??
    safe.find((c) => c.primaryKey) ??
    safe[0];
  const order = [
    sort,
    ...safe.filter((c) => c.primaryKey && c.name !== sort.name),
  ];
  const text = `SELECT ${safe.map((c) => `left(${quoteIdentifier(c.name)}::text, 2048) AS ${quoteIdentifier(c.name)}`).join(", ")} FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} AS data ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order.map((c) => `data.${quoteIdentifier(c.name)} ${options.descending ? "DESC" : "ASC"} NULLS LAST`).join(", ")} LIMIT ${bind(options.limit + 1)} OFFSET ${bind(options.offset)}`;
  return { text, values };
}
