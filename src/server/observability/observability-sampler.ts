import type {
  ObservabilitySnapshot,
  HostSample,
} from "../../shared/observability.js";
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
  } = {},
) {
  const collectHost = collectors.host ?? createHostCollector();
  const sampleDocker = collectors.docker ?? collectDocker;
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
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
