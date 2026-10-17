import { useState } from "react";
import type { ObservedService } from "../../../shared/observability";
import { ServiceMetricsPanel } from "./service-metrics-panel";
import { ServiceLogsPanel } from "./service-logs-panel";
import { ServiceRoutesPanel } from "./service-routes-panel";
import { StoragePanel } from "./storage-panel";
import { ExternalDatabasePanel } from "./external-database-panel";
const tabs = [
  "Metrics",
  "Logs",
  "Networks & routes",
  "Storage",
  "Database",
] as const;
export function ServiceDetailPanel({
  service,
  onClose,
}: {
  service: ObservedService;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Metrics");
  return (
    <section
      aria-label={`${service.service} details`}
      className="border-t border-zinc-700 bg-zinc-950 p-5"
    >
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-white">{service.service}</h3>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">
            {service.name} · {service.id.slice(0, 12)}
          </p>
        </div>
        <button
          aria-label="Close service details"
          className="text-sm text-zinc-400 hover:text-white"
          onClick={onClose}
        >
          Close ×
        </button>
      </header>
      <div
        role="tablist"
        aria-label="Service detail"
        className="my-5 flex gap-4 overflow-x-auto border-b border-zinc-800"
      >
        {tabs.map((value) => (
          <button
            role="tab"
            aria-selected={tab === value}
            aria-controls="service-detail-content"
            key={value}
            onClick={() => setTab(value)}
            className={`whitespace-nowrap border-b-2 pb-3 text-xs ${tab === value ? "border-white text-white" : "border-transparent text-zinc-500"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div id="service-detail-content" role="tabpanel">
        {tab === "Metrics" && <ServiceMetricsPanel service={service} />}
        {tab === "Logs" && <ServiceLogsPanel id={service.id} />}
        {tab === "Networks & routes" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">
              Shared networks:{" "}
              {service.topology?.networks.join(", ") ||
                "unknown / none reported"}
              . Declared Compose dependencies:{" "}
              {service.topology?.dependencies.join(", ") || "none discovered"}.
            </p>
            <ServiceRoutesPanel service={service} />
          </div>
        )}
        {tab === "Storage" && <StoragePanel service={service} />}
        {tab === "Database" && <ExternalDatabasePanel serviceId={service.id} />}
      </div>
    </section>
  );
}
