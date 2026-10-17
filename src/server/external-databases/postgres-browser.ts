import pg from "pg";
import type {
  ExternalColumn,
  ExternalForeignKey,
  ExternalRows,
  ExternalTable,
} from "../../shared/external-database.js";
import type { ConnectionConfig } from "./registration-store.js";
import {
  buildRowsQuery,
  sensitiveColumn,
  type BrowseOptions,
} from "./query-policy.js";

let active = 0;
export async function withReadOnlyDatabase<T>(
  config: ConnectionConfig,
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  if (active >= 4) throw new Error("Database browser busy");
  active++;
  const client = new pg.Client({
    ...config,
    ssl: config.tls ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 7000,
    options:
      "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000",
  });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const role = await client.query(
      "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user",
    );
    if (!role.rows.length || Object.values(role.rows[0]).some(Boolean))
      throw new Error("Use a restricted reader account");
    const result = await run(client);
    await client.query("ROLLBACK");
    return result;
  } finally {
    await client.end().catch(() => {});
    active--;
  }
}
export async function listTables(client: pg.Client): Promise<ExternalTable[]> {
  const result =
    await client.query(`SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND has_table_privilege(c.oid,'SELECT') ORDER BY 1,2 LIMIT 1000`);
  return result.rows;
}
export async function browseRows(
  client: pg.Client,
  schema: string,
  table: string,
  options: BrowseOptions,
): Promise<ExternalRows> {
  if (
    !(await listTables(client)).some(
      (t) => t.schema === schema && t.name === table,
    )
  )
    throw new Error("Table unavailable");
  const metadata = await client.query(
    `SELECT a.attname AS name, (t.typcategory IN ('A','C') OR (t.typcategory='U' AND t.typname <> 'uuid') OR t.typtype='d') AS structured, format_type(a.atttypid,a.atttypmod) AS type, NOT a.attnotnull AS nullable,
    EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisprimary AND a.attnum=ANY(i.indkey)) AS "primaryKey"
    FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LIMIT 256`,
    [schema, table],
  );
  const columns: ExternalColumn[] = metadata.rows.map((c) => ({
    name: c.name,
    type: c.type,
    nullable: c.nullable,
    primaryKey: c.primaryKey,
    masked:
      sensitiveColumn.test(c.name) ||
      c.structured ||
      /json|bytea|\[\]/i.test(c.type),
  }));
  const relationships = await client.query(
    `SELECT a.attname AS column, tn.nspname AS schema, tc.relname AS table, ta.attname AS "targetColumn", con.conname AS constraint, keys.ordinality::int AS position
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_class tc ON tc.oid=con.confrelid JOIN pg_namespace tn ON tn.oid=tc.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey,con.confkey) WITH ORDINALITY AS keys(source,target,ordinality)
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=keys.source JOIN pg_attribute ta ON ta.attrelid=tc.oid AND ta.attnum=keys.target
    WHERE con.contype='f' AND n.nspname=$1 AND c.relname=$2 ORDER BY con.conname,keys.ordinality LIMIT 256`,
    [schema, table],
  );
  const query = buildRowsQuery(schema, table, columns, options);
  const result = await client.query(query.text, query.values);
  return {
    columns,
    foreignKeys: relationships.rows as ExternalForeignKey[],
    rows: result.rows.slice(0, options.limit),
    hasMore: result.rows.length > options.limit,
    offset: options.offset,
    limit: options.limit,
  };
}
