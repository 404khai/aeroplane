import type {
  ObservabilitySnapshot,
  HostSample,
} from "../../shared/observability.js";
import { createServiceHistory } from "./service-history.js";
import { createAlertTracker } from "./resource-alerts.js";
import { collectDocker } from "./docker-collector.js";
import { groupContainers, type ManagedContainer } from "./docker-discovery.js";
import { createHostCollector } from "./host-collector.js";
import { appendHistory } from "./metrics-math.js";

export const sampleIntervalMs = 15_000;
export const retentionMs = 60 * 60 * 1000;
const historyLimit = 240;

// One in-flight sample per process, independent of client count. Start lazily after owner access.
export function createObservabilitySampler(
  managedContainers: () => ManagedContainer[],
  collectors: {
    docker?: typeof collectDocker;
    host?: ReturnType<typeof createHostCollector>;
    routes?: () => { serviceId: string; hostname: string }[];
  } = {},
) {
  const collectHost = collectors.host ?? createHostCollector();
  const sampleDocker = collectors.docker ?? collectDocker;
  const services = createServiceHistory();
  const alerts = createAlertTracker();
  let stopped = false;
  let history: HostSample[] = [];
  let snapshot: ObservabilitySnapshot | undefined;
  let inFlight: Promise<ObservabilitySnapshot> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sample = async (): Promise<ObservabilitySnapshot> => {
    const sampledAt = Date.now();
    const [host, docker] = await Promise.all([
      collectHost(sampledAt),
      sampleDocker()
        .then((data) => ({ data, available: true, message: data.message }))
        .catch(() => ({
          data: null,
          available: false,
          message:
            "Docker is unavailable. Check the Docker CLI, daemon and socket access.",
        })),
    ]);
    history = appendHistory(history, host.current, retentionMs, historyLimit);
    snapshot = {
      sampledAt,
      intervalMs: sampleIntervalMs,
      retentionMs,
      docker: { available: docker.available, message: docker.message },
      projects: docker.data
        ? groupContainers(
            docker.data.rows,
            docker.data.details,
            docker.data.usage,
            managedContainers(),
            sampledAt,
          )
        : [],
      host: { ...host, history },
    };
    const managed = managedContainers();
    const routes = collectors.routes?.() ?? [];
    for (const project of snapshot.projects)
      for (const service of project.services) {
        service.topology =
          docker.data && "topology" in docker.data
            ? docker.data.topology?.get(service.id)
            : undefined;
      }
    for (const project of snapshot.projects)
      for (const service of project.services) {
        const declarations = routes.filter((r) => r.serviceId === service.id);
        if (declarations.length && service.topology)
          service.topology.domains.push(
            ...declarations.map((r) => ({
              hostname: r.hostname,
              source: "Owner-declared route · not independently verified",
            })),
          );
        const configured =
          managed.find((m) => m.name === service.name)?.domains ?? [];
        if (configured.length && service.topology)
          service.topology.domains.push(
            ...configured.map((hostname) => ({
              hostname,
              source: "Aeroplane domain configuration",
            })),
          );
      }
    services.record(snapshot);
    alerts.record(snapshot);
    return snapshot;
  };
  const run = () => {
    if (!inFlight) {
      inFlight = sample().finally(() => {
        inFlight = undefined;
        if (stopped) return;
        timer = setTimeout(() => {
          void run().catch(() => {
            /* Next scheduled sample retries. */
          });
        }, sampleIntervalMs);
        timer.unref();
      });
    }
    return inFlight;
  };
  return {
    getSnapshot: () => (snapshot ? Promise.resolve(snapshot) : run()),
    serviceHistory: services.get,
    incidents: alerts.list,
    acknowledge: alerts.acknowledge,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
