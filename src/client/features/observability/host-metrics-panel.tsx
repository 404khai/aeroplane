import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ObservabilitySnapshot } from "../../../shared/observability";
import { bytes, duration, percent } from "./metric-format";

export function HostMetricsPanel({
  host,
}: {
  host: ObservabilitySnapshot["host"];
}) {
  const sample = host.current;
  const memoryPercent =
    sample.memoryTotalBytes && sample.memoryUsedBytes !== null
      ? (sample.memoryUsedBytes / sample.memoryTotalBytes) * 100
      : null;
  const metrics = [
    [
      "Host CPU",
      percent(sample.cpuPercent),
      sample.cpuCount === null
        ? "Host CPU count unavailable"
        : `${sample.cpuCount} logical CPUs · 100% = whole host`,
    ],
    [
      "Host RAM",
      bytes(sample.memoryUsedBytes),
      `of ${bytes(sample.memoryTotalBytes)} · excludes reclaimable cache on Linux`,
    ],
    [
      "Host root disk",
      bytes(sample.diskUsedBytes),
      `of ${bytes(sample.diskTotalBytes)} · root filesystem only`,
    ],
    ["Host uptime", duration(sample.uptimeSeconds), "Since host boot"],
    [
      "Host network received",
      sample.networkReceiveBytesPerSecond === null
        ? "Unavailable"
        : `${bytes(sample.networkReceiveBytesPerSecond)}/s`,
      "Non-loopback host interfaces; virtual bridges excluded",
    ],
    [
      "Host network sent",
      sample.networkTransmitBytesPerSecond === null
        ? "Unavailable"
        : `${bytes(sample.networkTransmitBytesPerSecond)}/s`,
      "Rate across the sampling interval",
    ],
  ];
  const chart = host.history.map((point) => ({
    timestamp: point.timestamp,
    cpu: point.cpuPercent,
    memory:
      point.memoryTotalBytes && point.memoryUsedBytes !== null
        ? (point.memoryUsedBytes / point.memoryTotalBytes) * 100
        : null,
  }));
  return (
    <section aria-labelledby="host-metrics-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="host-metrics-heading" className="text-lg text-white">
          Host measurements
        </h2>
        <span className="font-mono text-xs text-zinc-500">
          Collector: {host.source}
        </span>
      </div>
      {host.messages.map((message) => (
        <p
          key={message}
          className="border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200"
        >
          {message}
        </p>
      ))}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="border border-zinc-800 bg-black/30 p-5">
            <h3 className="text-sm text-zinc-400">{label}</h3>
            <p className="mt-2 text-2xl tracking-tight text-white">{value}</p>
            <p className="mt-2 text-xs text-zinc-500">{hint}</p>
          </div>
        ))}
      </div>
      {host.source !== "unavailable" && (
        <div className="border border-zinc-800 p-5">
          <h3 className="text-sm text-zinc-300">
            Host CPU and RAM · last hour
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            CPU (teal), RAM (violet). RAM now: {percent(memoryPercent)}. History
            resets when Aeroplane restarts.
          </p>
          {chart.length < 2 ? (
            <p role="status" className="py-12 text-sm text-zinc-500">
              Collecting history…
            </p>
          ) : (
            <div
              className="mt-4 h-48"
              aria-label="Host CPU and RAM percentage history"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                    stroke="#71717a"
                    minTickGap={50}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    stroke="#71717a"
                    width={45}
                  />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(Number(value)).toLocaleTimeString()
                    }
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      color: "#fafafa",
                    }}
                  />
                  <Line
                    name="CPU %"
                    type="monotone"
                    dataKey="cpu"
                    stroke="#4fb8b2"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    name="RAM %"
                    type="monotone"
                    dataKey="memory"
                    stroke="#a78bfa"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
