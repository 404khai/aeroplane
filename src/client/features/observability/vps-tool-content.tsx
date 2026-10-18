import type { ObservabilitySnapshot } from "../../../shared/observability";
import { HostMetricsPanel } from "./host-metrics-panel";
import { ResourceAlertsPanel } from "./resource-alerts-panel";
import { StoragePanel } from "./storage-panel";
import { WorkloadGroups } from "./workload-groups";
import { VpsServiceTool } from "./vps-service-tool";
import type { VpsTool } from "./vps-tools";
export function VpsToolContent({
  tool,
  snapshot,
}: {
  tool: VpsTool;
  snapshot: ObservabilitySnapshot;
}) {
  if (tool === "overview") return <HostMetricsPanel host={snapshot.host} />;
  if (tool === "alerts") return <ResourceAlertsPanel />;
  if (!snapshot.docker.available)
    return (
      <p
        role="status"
        className="border border-amber-500/20 p-5 text-sm text-amber-200"
      >
        Docker inspection is unavailable. This tool will be available when
        Docker discovery recovers.
      </p>
    );
  if (tool === "projects")
    return <WorkloadGroups projects={snapshot.projects} />;
  if (tool === "storage") return <StoragePanel projects={snapshot.projects} />;
  return <VpsServiceTool key={tool} tool={tool} projects={snapshot.projects} />;
}
