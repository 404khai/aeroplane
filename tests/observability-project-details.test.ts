import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTopology,
  topologyFormat,
} from "../src/server/observability/topology.js";
import { createServiceHistory } from "../src/server/observability/service-history.js";
import { createAlertTracker } from "../src/server/observability/resource-alerts.js";
import {
  redactLogText,
  readServiceLogs,
} from "../src/server/observability/service-logs.js";
import { inspectStorage } from "../src/server/observability/storage-inspection.js";
import type {
  ObservabilitySnapshot,
  ObservedService,
} from "../src/shared/observability.js";
const service: ObservedService = {
  id: "a".repeat(64),
  name: "sample-api-1",
  service: "api",
  state: "running",
  health: "healthy",
  restarts: 0,
  uptimeSeconds: 100,
  detailAvailable: true,
  usage: { cpuPercent: 95, memoryBytes: 950, memoryLimitBytes: 1000 },
};
function snapshot(
  timestamp: number,
  services = [service],
): ObservabilitySnapshot {
  return {
    sampledAt: timestamp,
    intervalMs: 15000,
    retentionMs: 3600000,
    docker: { available: true, message: null },
    projects: [
      {
        id: "external:compose:sample",
        name: "sample",
        kind: "external",
        compose: true,
        services,
      },
    ],
    host: {
      source: "unavailable",
      messages: [],
      history: [],
      current: {
        timestamp,
        cpuPercent: null,
        cpuCount: null,
        memoryUsedBytes: null,
        memoryTotalBytes: null,
        diskUsedBytes: null,
        diskTotalBytes: null,
        uptimeSeconds: null,
        networkReceiveBytesPerSecond: null,
        networkTransmitBytesPerSecond: null,
      },
    },
  };
}
test("topology separates shared network membership from explicit dependency evidence", () => {
  const parsed = parseTopology(
    JSON.stringify({
      id: service.id,
      image: "postgres:17",
      networks: ["shared", null],
      mounts: [
        {
          name: "db",
          destination: "/var/lib/postgresql/data",
          type: "volume",
          writable: true,
        },
        null,
      ],
      depends: "db:service_healthy:false,cache:service_started:false",
      host: "https://app.example.test secret=never invalid/path",
    }),
  );
  assert.deepEqual(parsed.get(service.id)?.networks, ["shared"]);
  assert.deepEqual(parsed.get(service.id)?.dependencies, ["db", "cache"]);
  assert.deepEqual(
    parsed.get(service.id)?.domains.map((d) => d.hostname),
    ["app.example.test"],
  );
  assert.deepEqual(
    parseTopology(
      JSON.stringify({
        id: service.id,
        networks: ["shared"],
        mounts: [],
        image: "api",
      }),
    ).get(service.id)?.dependencies,
    [],
  );
  assert.doesNotMatch(
    topologyFormat,
    /Config.Env|\.Source|json \.Config.Labels|json \.NetworkSettings/,
  );
});
test("service history bounds samples, IDs, age and preserves unknown gaps", () => {
  const history = createServiceHistory();
  for (let i = 0; i < 260; i++) history.record(snapshot(i * 15000));
  assert.equal(history.get(service.id).length, 240);
  history.record(snapshot(4000000, [{ ...service, usage: null }]));
  assert.equal(history.get(service.id).at(-1)?.cpuPercent, null);
  history.record(snapshot(8000000, []));
  assert.deepEqual(history.get(service.id), []);
});
test("alerts require sustained conditions, preserve incidents on unknown stats and track ack/recovery/restarts", () => {
  const alerts = createAlertTracker();
  for (let t = 0; t < 60000; t += 15000) alerts.record(snapshot(t));
  assert.equal(alerts.list().length, 0);
  alerts.record(snapshot(60000));
  assert.equal(alerts.list().length, 2);
  alerts.record(snapshot(75000, [{ ...service, usage: null }]));
  assert.ok(alerts.list().every((i) => i.resolvedAt === null));
  assert.equal(alerts.acknowledge(alerts.list()[0].id), true);
  alerts.record(
    snapshot(90000, [
      {
        ...service,
        restarts: 1,
        usage: { cpuPercent: 1, memoryBytes: 100, memoryLimitBytes: 1000 },
      },
    ]),
  );
  assert.equal(alerts.list().filter((i) => i.resolvedAt).length, 2);
  assert.equal(alerts.list().at(-1)?.condition, "Container restarted");
});
test("unknown host disk and health do not resolve existing incidents", () => {
  const alerts = createAlertTracker();
  const data = snapshot(0, [{ ...service, health: "unhealthy", usage: null }]);
  data.host.current.diskTotalBytes = 100;
  data.host.current.diskUsedBytes = 95;
  for (let sampledAt = 0; sampledAt <= 60000; sampledAt += 15000)
    alerts.record({ ...data, sampledAt });
  alerts.record(
    snapshot(75000, [{ ...service, health: "unknown", usage: null }]),
  );
  assert.equal(alerts.list().filter((i) => i.resolvedAt).length, 0);
});
test("logs reject CLI injection and redact common credential patterns", () => {
  assert.throws(() => readServiceLogs("--privileged"), /Invalid container/);
  assert.equal(
    redactLogText('password="abc def" token=abc postgres://user:pass@db/app'),
    "password=[redacted] token=[redacted] postgres://[redacted]@db/app",
  );
});
test("storage response selects safe fields and never leaks container commands, mountpoints or labels", async () => {
  const storage = await inspectStorage(async (args) =>
    args.includes("--verbose")
      ? JSON.stringify({
          Volumes: [
            {
              Name: "sample",
              Size: "1GB",
              Driver: "local",
              Links: "1",
              Mountpoint: "private-path",
              Labels: "private-token",
            },
          ],
          Images: [
            {
              ID: "abc",
              Repository: "postgres",
              Tag: "17",
              Size: "100MB",
              Containers: "1",
            },
          ],
          Containers: [{ Command: "private-password" }],
        })
      : JSON.stringify({
          Type: "Images",
          TotalCount: "1",
          Active: "1",
          Size: "100MB",
          Reclaimable: "0B",
        }),
  );
  assert.equal(storage.volumes[0].size, "1GB");
  assert.doesNotMatch(JSON.stringify(storage), /private-/);
});

test("a sampling gap resets sustained alert timing", () => {
  const alerts = createAlertTracker();
  alerts.record(snapshot(0));
  alerts.record(snapshot(120000));
  assert.equal(alerts.list().length, 0);
});
