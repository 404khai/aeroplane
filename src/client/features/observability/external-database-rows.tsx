import { useEffect, useState } from "react";
import type {
  ExternalRows,
  ExternalTable,
} from "../../../shared/external-database";
import { DatabaseResultTable } from "../../components/modals/database-result-table";
import { inspection } from "./inspection-api";

export function ExternalDatabaseRows({
  id,
  tables,
}: {
  id: string;
  tables: ExternalTable[];
}) {
  const [table, setTable] = useState<ExternalTable | null>(tables[0] ?? null);
  const [result, setResult] = useState<ExternalRows | null>(null);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [descending, setDescending] = useState(false);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rowIndex, setRowIndex] = useState(0);
  useEffect(() => {
    if (!table) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void inspection
        .rows(id, {
          schema: table.schema,
          table: table.name,
          offset: String(offset),
          limit: "50",
          search,
          sort,
          descending: String(descending),
          filterColumn,
          filterValue,
        })
        .then((value) => {
          if (!cancelled) {
            setResult(value);
            setRowIndex(0);
          }
        })
        .catch((cause) => {
          if (!cancelled)
            setError(
              cause instanceof Error ? cause.message : "Rows unavailable",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, table, offset, search, sort, descending, filterColumn, filterValue]);
  const inputClass =
    "border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-300";
  const selectTable = (next: ExternalTable | null) => {
    setTable(next);
    setOffset(0);
    setSearch("");
    setSort("");
    setFilterColumn("");
    setFilterValue("");
    setResult(null);
  };
  return (
    <section className="space-y-4">
      <p className="text-xs text-zinc-500">
        Actual table rows · 50 per page · cells limited to 2,048 characters.
        Sensitive column names and JSON, arrays and binary values are omitted
        server-side; no reveal or SQL execution endpoint. Use a database role
        with access only to intended schemas and tables. Live pagination can
        shift when the application writes.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Schema and table"
          className={inputClass}
          value={table ? JSON.stringify(table) : ""}
          onChange={(e) => selectTable(JSON.parse(e.target.value))}
        >
          {tables.map((t) => (
            <option key={JSON.stringify(t)} value={JSON.stringify(t)}>
              {t.schema}.{t.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Search table rows"
          placeholder="Search visible columns"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          className={inputClass}
        />
        <select
          aria-label="Sort column"
          className={inputClass}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Primary key / first column</option>
          {result?.columns
            .filter((c) => !c.masked)
            .map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
        </select>
        <button
          className={inputClass}
          onClick={() => {
            setDescending(!descending);
            setOffset(0);
          }}
        >
          {descending ? "Descending" : "Ascending"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter column"
          className={inputClass}
          value={filterColumn}
          onChange={(e) => {
            setFilterColumn(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">No column filter</option>
          {result?.columns
            .filter((c) => !c.masked)
            .map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
        </select>
        <input
          aria-label="Exact filter value"
          placeholder="Equals (exact text)"
          value={filterValue}
          onChange={(e) => {
            setFilterValue(e.target.value);
            setOffset(0);
          }}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-xs text-zinc-400">
          Reading table…
        </p>
      )}
      {result && !loading && !error && (
        <>
          <div className="flex flex-wrap gap-2">
            {result.columns.map((c) => (
              <span
                key={c.name}
                className="border border-white/10 px-2 py-1 font-mono text-[10px] text-zinc-400"
              >
                {c.name} · {c.type}
                {c.primaryKey ? " · PK" : ""}
                {c.nullable ? " · nullable" : ""}
                {c.masked ? " · hidden" : ""}
              </span>
            ))}
          </div>
          <div className="max-h-96 overflow-auto">
            <DatabaseResultTable
              columns={result.columns.filter((c) => !c.masked)}
              rows={result.rows}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 50))}
              className="disabled:opacity-30"
            >
              ← Previous
            </button>
            <span>
              Rows {result.rows.length ? offset + 1 : 0}–
              {offset + result.rows.length}
            </span>
            <button
              disabled={!result.hasMore || offset >= 100000}
              onClick={() => setOffset(offset + 50)}
              className="disabled:opacity-30"
            >
              Next →
            </button>
          </div>
          {!!result.foreignKeys.length && (
            <div className="space-y-2 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
              <p>Foreign keys · PostgreSQL constraint evidence</p>
              <label>
                Navigate from row{" "}
                <select
                  aria-label="Foreign key source row"
                  className={inputClass}
                  value={rowIndex}
                  onChange={(e) => setRowIndex(Number(e.target.value))}
                >
                  {result.rows.map((_, i) => (
                    <option key={i} value={i}>
                      {offset + i + 1}
                    </option>
                  ))}
                </select>
              </label>
              {result.foreignKeys.map((fk) => {
                const composite =
                  result.foreignKeys.filter(
                    (f) => f.constraint === fk.constraint,
                  ).length > 1;
                const value = result.rows[rowIndex]?.[fk.column];
                return (
                  <div key={`${fk.constraint}-${fk.position}`}>
                    <button
                      disabled={
                        value == null || composite || value.length >= 2048
                      }
                      className="text-teal-300 underline disabled:text-zinc-600"
                      onClick={() => {
                        selectTable({ schema: fk.schema, name: fk.table });
                        setFilterColumn(fk.targetColumn);
                        setFilterValue(String(value));
                      }}
                    >
                      {fk.column} → {fk.schema}.{fk.table}.{fk.targetColumn}
                    </button>
                    {composite && (
                      <span>
                        {" "}
                        · composite key; open target table to inspect all key
                        columns
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {!tables.length && (
        <p className="text-xs text-zinc-400">No readable base tables found.</p>
      )}
    </section>
  );
}
