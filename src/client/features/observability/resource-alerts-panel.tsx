import { useEffect, useState } from "react";
import type { Incident } from "../../../shared/observability";
import { inspection } from "./inspection-api";
export function ResourceAlertsPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState("");
  const refresh = () =>
    inspection
      .alerts()
      .then((value) => {
        setIncidents(value.incidents);
        setError("");
      })
      .catch(() => setError("Alerts unavailable"));
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      inspection
        .alerts()
        .then((value) => {
          if (!cancelled) {
            setIncidents(value.incidents);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) setError("Alerts unavailable");
        });
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="space-y-3 border border-zinc-800 p-5">
      <h2 className="text-lg">Resource and health alerts</h2>
      <p className="text-xs text-zinc-500">
        In-app delivery only. CPU ≥90% of one core, RAM ≥90% of limit, host
        RAM/disk ≥90% and unhealthy Docker checks must persist for 60 seconds.
        Restart increments open immediately. Checks start when an owner first
        opens observability. Up to 200 incidents in memory; restart clears
        history and acknowledgements. Unknown measurements do not indicate
        recovery.
      </p>
      {error && (
        <p role="alert" className="text-sm text-amber-300">
          {error}
        </p>
      )}
      {!incidents.length && (
        <p className="text-sm text-zinc-400">
          No recorded incidents. This is not proof all measurements are
          available.
        </p>
      )}
      {[...incidents].reverse().map((incident) => (
        <div
          key={incident.id}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 text-xs"
        >
          <div>
            <p
              className={
                incident.resolvedAt ? "text-zinc-500" : "text-amber-300"
              }
            >
              {incident.target} · {incident.condition}
            </p>
            <p className="mt-1 text-zinc-500">
              Opened {new Date(incident.openedAt).toLocaleString()} ·{" "}
              {incident.resolvedAt
                ? `resolved ${new Date(incident.resolvedAt).toLocaleTimeString()}`
                : "open / recovery not confirmed"}{" "}
              · {incident.acknowledgedAt ? "acknowledged" : "unacknowledged"}
            </p>
          </div>
          {!incident.acknowledgedAt && (
            <button
              className="text-zinc-300 underline"
              onClick={() => {
                void inspection
                  .acknowledge(incident.id)
                  .then(refresh)
                  .catch(() => setError("Acknowledgement failed"));
              }}
            >
              Acknowledge
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
