import { useState } from "react";
import type { ObservedProject } from "../../../shared/observability";
import type { VpsTool } from "./vps-tools";
import { ExternalDatabasePanel } from "./external-database-panel";
import { ServiceLogsPanel } from "./service-logs-panel";
import { ServiceMetricsPanel } from "./service-metrics-panel";
import { ServiceRoutesPanel } from "./service-routes-panel";
export function VpsServiceTool({
  tool,
  projects,
}: {
  tool: Extract<VpsTool, "databases" | "logs" | "metrics" | "certificates">;
  projects: ObservedProject[];
}) {
  const [selected, setSelected] = useState("");
  const groups = [...projects].sort(
    (a, b) =>
      Number(a.kind !== "external") - Number(b.kind !== "external") ||
      a.name.localeCompare(b.name),
  );
  const services = groups.flatMap((project) => project.services);
  const preferred =
    tool === "databases"
      ? services.find((service) =>
          /postgres|timescale|postgis/i.test(service.topology?.image ?? ""),
        )
      : tool === "certificates"
        ? services.find((service) => service.topology?.domains.length)
        : undefined;
  const current =
    services.find((service) => service.id === selected) ??
    preferred ??
    services.find((service) => service.state === "running") ??
    services[0];
  if (!current)
    return (
      <p className="border border-zinc-800 p-5 text-sm text-zinc-400">
        No Docker services are available to inspect.
      </p>
    );
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 border border-zinc-800 bg-black/20 p-4">
        <label htmlFor="inspected-service" className="text-xs text-zinc-400">
          Service
        </label>
        <select
          id="inspected-service"
          value={current.id}
          onChange={(event) => setSelected(event.target.value)}
          className="max-w-full min-w-0 border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
        >
          {groups.map((project) => (
            <optgroup
              key={project.id}
              label={`${project.name} · ${project.kind}`}
            >
              {project.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.service} · {service.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="text-xs text-zinc-500">
          {current.state} ·{" "}
          {current.health === "none" ? "no health check" : current.health}
        </span>
      </div>
      <div
        key={`${tool}:${current.id}`}
        className="border border-zinc-800 bg-black/20 p-5"
      >
        {tool === "databases" && (
          <ExternalDatabasePanel serviceId={current.id} />
        )}
        {tool === "logs" && <ServiceLogsPanel id={current.id} />}
        {tool === "metrics" && <ServiceMetricsPanel service={current} />}
        {tool === "certificates" && <ServiceRoutesPanel service={current} />}
      </div>
    </section>
  );
}
