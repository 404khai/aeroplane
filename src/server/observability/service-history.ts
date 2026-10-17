import type {
  ObservabilitySnapshot,
  ServiceSample,
} from "../../shared/observability.js";

export function createServiceHistory() {
  const history = new Map<string, ServiceSample[]>();
  return {
    record(snapshot: ObservabilitySnapshot) {
      const cutoff = snapshot.sampledAt - snapshot.retentionMs;
      for (const [id, samples] of history) {
        const retained = samples.filter((s) => s.timestamp >= cutoff);
        if (!retained.length) history.delete(id);
        else history.set(id, retained);
      }
      for (const project of snapshot.projects)
        for (const service of project.services) {
          const sample = {
            timestamp: snapshot.sampledAt,
            cpuPercent: service.usage?.cpuPercent ?? null,
            memoryBytes: service.usage?.memoryBytes ?? null,
            memoryLimitBytes: service.usage?.memoryLimitBytes ?? null,
          };
          history.set(
            service.id,
            [...(history.get(service.id) ?? []), sample].slice(-240),
          );
        }
      // Container churn must not make retention unbounded.
      while (history.size > 500) history.delete(history.keys().next().value!);
    },
    get(id: string) {
      return history.get(id) ?? [];
    },
  };
}
