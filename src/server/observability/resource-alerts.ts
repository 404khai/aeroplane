import { randomUUID } from "node:crypto";
import type {
  Incident,
  ObservabilitySnapshot,
} from "../../shared/observability.js";

export function createAlertTracker() {
  const pending = new Map<string, number>();
  const restarts = new Map<string, number>();
  let incidents: Incident[] = [];
  let previousSampleAt: number | undefined;
  return {
    record(snapshot: ObservabilitySnapshot) {
      if (
        previousSampleAt != null &&
        snapshot.sampledAt - previousSampleAt > 45_000
      )
        pending.clear();
      previousSampleAt = snapshot.sampledAt;
      const conditions = new Map<
        string,
        { target: string; condition: string; immediate?: boolean }
      >();
      const add = (target: string, condition: string, immediate = false) =>
        conditions.set(`${target}:${condition}`, {
          target,
          condition,
          immediate,
        });
      for (const project of snapshot.projects)
        for (const service of project.services) {
          if (service.health === "unhealthy")
            add(service.name, "Docker health check unhealthy");
          if (
            service.usage?.cpuPercent != null &&
            service.usage.cpuPercent >= 90
          )
            add(service.name, "CPU ≥ 90% of one core");
          if (
            service.usage?.memoryLimitBytes &&
            service.usage.memoryBytes != null &&
            service.usage.memoryBytes / service.usage.memoryLimitBytes >= 0.9
          )
            add(service.name, "RAM ≥ 90% of container limit");
          const previous = restarts.get(service.id);
          if (
            previous != null &&
            service.restarts != null &&
            service.restarts > previous
          )
            add(service.name, "Container restarted", true);
          if (service.restarts != null)
            restarts.set(service.id, service.restarts);
        }
      const host = snapshot.host.current;
      if (
        host.diskTotalBytes &&
        host.diskUsedBytes != null &&
        host.diskUsedBytes / host.diskTotalBytes >= 0.9
      )
        add("Host", "Disk ≥ 90% used");
      if (
        host.memoryTotalBytes &&
        host.memoryUsedBytes != null &&
        host.memoryUsedBytes / host.memoryTotalBytes >= 0.9
      )
        add("Host", "RAM ≥ 90% used");
      for (const [key, condition] of conditions) {
        const since = pending.get(key) ?? snapshot.sampledAt;
        pending.set(key, since);
        if (
          (condition.immediate || snapshot.sampledAt - since >= 60_000) &&
          !incidents.some(
            (i) => `${i.target}:${i.condition}` === key && !i.resolvedAt,
          )
        ) {
          incidents.push({
            id: randomUUID(),
            target: condition.target,
            condition: condition.condition,
            openedAt: snapshot.sampledAt,
            resolvedAt: null,
            acknowledgedAt: null,
          });
        }
      }
      for (const key of pending.keys())
        if (!conditions.has(key)) pending.delete(key);
      for (const incident of incidents) {
        // An outage is unknown, not evidence that an alert has recovered.
        const service = snapshot.projects
          .flatMap((p) => p.services)
          .find((s) => s.name === incident.target);
        const known =
          incident.target === "Host"
            ? incident.condition.startsWith("Disk")
              ? host.diskTotalBytes != null && host.diskUsedBytes != null
              : host.memoryTotalBytes != null && host.memoryUsedBytes != null
            : snapshot.docker.available &&
              service != null &&
              (incident.condition.startsWith("CPU")
                ? service.usage?.cpuPercent != null
                : incident.condition.startsWith("RAM")
                  ? service.usage?.memoryBytes != null &&
                    Boolean(service.usage?.memoryLimitBytes)
                  : incident.condition.startsWith("Docker")
                    ? ["healthy", "unhealthy"].includes(service.health)
                    : service.restarts != null);
        if (
          !incident.resolvedAt &&
          known &&
          !conditions.has(`${incident.target}:${incident.condition}`)
        )
          incident.resolvedAt = snapshot.sampledAt;
      }
      const currentIds = new Set(
        snapshot.projects.flatMap((p) => p.services.map((s) => s.id)),
      );
      for (const id of restarts.keys())
        if (!currentIds.has(id)) restarts.delete(id);
      incidents = incidents.slice(-200);
    },
    list: () => incidents,
    acknowledge(id: string) {
      const incident = incidents.find((i) => i.id === id);
      if (incident) incident.acknowledgedAt = Date.now();
      return Boolean(incident);
    },
  };
}
