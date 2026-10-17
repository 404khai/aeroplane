import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { inspection } from "./inspection-api";
import { bytes, duration } from "./metric-format";
import type {
  ServiceSample,
  ObservedService,
} from "../../../shared/observability";
export function ServiceMetricsPanel({ service }: { service: ObservedService }) {
  const [history, setHistory] = useState<ServiceSample[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      inspection
        .service(service.id)
        .then((result) => {
          if (!cancelled) {
            setHistory(result.history);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) setError("Metric history unavailable");
        });
    void refresh();
    const timer = setInterval(refresh, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [service.id]);
  return (
    <section className="space-y-4 text-xs text-zinc-400">
      <p>
        Uptime {duration(service.uptimeSeconds)} · restarts{" "}
        {service.restarts ?? "unknown"} · RAM limit{" "}
        {bytes(service.usage?.memoryLimitBytes ?? null)}
      </p>
      <p>
        Samples every 15 seconds. Up to 240 samples / one hour per container,
        held in server memory and cleared on restart. CPU is 100% per logical
        core. Gaps represent unknown measurements.
      </p>
      {error && <p role="alert">{error}</p>}
      {(
        [
          { key: "cpuPercent", label: "CPU %", color: "#4fb8b2" },
          { key: "memoryBytes", label: "RAM bytes", color: "#a1a1aa" },
        ] as const
      ).map((metric) => (
        <div key={metric.key}>
          <p>{metric.label}</p>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                  minTickGap={60}
                />
                <YAxis
                  width={75}
                  tickFormatter={(v) =>
                    metric.key === "memoryBytes" ? bytes(v) : String(v)
                  }
                />
                <Tooltip
                  labelFormatter={(v) =>
                    new Date(Number(v)).toLocaleTimeString()
                  }
                />
                <Line
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </section>
  );
}
