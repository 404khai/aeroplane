import { useEffect, useState } from "react";
import type {
  ExternalDatabase,
  ExternalTable,
} from "../../../shared/external-database";
import { DatabaseRegistrationForm } from "./database-registration-form";
import { ExternalDatabaseRows } from "./external-database-rows";
import { inspection, inspectionRequest } from "./inspection-api";
export function ExternalDatabasePanel({ serviceId }: { serviceId: string }) {
  const [connections, setConnections] = useState<ExternalDatabase[]>([]);
  const [selected, setSelected] = useState("");
  const [tables, setTables] = useState<ExternalTable[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [register, setRegister] = useState(false);
  const [remove, setRemove] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void inspection
      .databases()
      .then((value) => {
        if (!cancelled) {
          const matching = value.connections.filter(
            (c) => c.serviceId === serviceId,
          );
          setConnections(matching);
          setSelected(matching[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Connections unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, version]);
  useEffect(() => {
    if (!selected) {
      setTables(null);
      return;
    }
    let cancelled = false;
    setTables(null);
    setError("");
    void inspection
      .tables(selected)
      .then((value) => {
        if (!cancelled) setTables(value.tables);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Tables unavailable",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs text-zinc-400">
        {!!connections.length && (
          <select
            aria-label="Registered database"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border border-zinc-800 bg-black p-2"
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.database}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => setRegister(!register)} className="underline">
          {register ? "Close registration" : "Register PostgreSQL connection"}
        </button>
        {selected && (
          <button onClick={() => setRemove(!remove)} className="underline">
            Remove registration
          </button>
        )}
      </div>
      {remove && (
        <div className="border border-amber-400/30 p-3 text-xs text-zinc-400">
          Remove the saved connection and its encrypted credentials? The
          database is unaffected.{" "}
          <button
            className="ml-2 text-white underline"
            onClick={() => {
              void inspectionRequest(`external-databases/${selected}`, {
                method: "DELETE",
              })
                .then(() => {
                  setVersion((v) => v + 1);
                  setRemove(false);
                })
                .catch(() => setError("Could not remove registration"));
            }}
          >
            Remove saved connection
          </button>
        </div>
      )}
      {register && (
        <DatabaseRegistrationForm
          serviceId={serviceId}
          onRegistered={() => {
            setVersion((v) => v + 1);
            setRegister(false);
          }}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {tables && selected && (
        <ExternalDatabaseRows key={selected} id={selected} tables={tables} />
      )}
      {!selected && !register && (
        <p className="text-sm text-zinc-500">
          No saved connection for this container. Register an existing
          PostgreSQL reader account to inspect schemas, tables, columns and
          rows.
        </p>
      )}
    </div>
  );
}
