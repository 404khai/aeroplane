import { useState } from "react";
import { inspectionRequest } from "./inspection-api";

export function DatabaseRegistrationForm({
  serviceId,
  onRegistered,
}: {
  serviceId: string;
  onRegistered: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4 border border-zinc-800 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = new FormData(form);
        setBusy(true);
        setError("");
        try {
          await inspectionRequest("external-databases", {
            method: "POST",
            body: JSON.stringify({
              name: fields.get("name"),
              serviceId,
              host: fields.get("host"),
              port: Number(fields.get("port")),
              database: fields.get("database"),
              user: fields.get("user"),
              password: fields.get("password"),
              tls: fields.get("tls") === "on",
            }),
          });
          form.reset();
          onRegistered();
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Registration failed",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-white">
        Connect an existing PostgreSQL database
      </p>
      <p className="text-xs text-zinc-500">
        Provide an existing restricted reader account and a host reachable from
        Aeroplane (for example, its existing Docker DNS name on a shared
        network). This stores a connection only; it never migrates, adopts or
        restarts a workload. Privileged accounts are rejected. Every query runs
        in a read-only transaction. Credentials are encrypted with
        AEROPLANE_SECRET_KEY.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { name: "name", label: "Connection name" },
          { name: "host", label: "Database host" },
          { name: "port", label: "Port", value: "5432", type: "number" },
          { name: "database", label: "Database" },
          { name: "user", label: "Reader username" },
          { name: "password", label: "Reader password", type: "password" },
        ].map((field) => (
          <label key={field.name} className="text-xs text-zinc-400">
            {field.label}
            <input
              required
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={field.value}
              autoComplete="off"
              maxLength={field.name === "password" ? 4096 : 253}
              className="mt-1 w-full border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input name="tls" type="checkbox" defaultChecked />
        Verify TLS certificate (disable only for a trusted private database
        network)
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="border border-white/20 bg-white/10 px-4 py-2 text-xs text-white disabled:opacity-50"
      >
        {busy
          ? "Testing connection…"
          : "Test and register read-only connection"}
      </button>
    </form>
  );
}
