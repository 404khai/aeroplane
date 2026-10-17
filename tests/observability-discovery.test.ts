import test from "node:test";
import assert from "node:assert/strict";
import {
  detailFormat,
  listFormat,
  groupContainers,
  parseContainerList,
  parseContainerStats,
  type ContainerSummary,
} from "../src/server/observability/docker-discovery.js";

const row = (
  id: string,
  name: string,
  project = "",
  service = "",
): ContainerSummary => ({
  id,
  name,
  project,
  service,
  state: "running",
  role: "",
});
test("parses allowlisted summaries and rejects malformed IDs", () => {
  const data = {
    ...row("a".repeat(64), "example-api-1", "example", "api"),
    Env: ["SECRET=must-not-escape"],
  };
  assert.deepEqual(parseContainerList(JSON.stringify(data)), [
    row("a".repeat(64), "example-api-1", "example", "api"),
  ]);
  assert.deepEqual(parseContainerList(""), []);
  assert.throws(() =>
    parseContainerList(JSON.stringify({ ...data, id: "--help" })),
  );
  assert.throws(() => parseContainerList("not-json"));
  assert.doesNotMatch(listFormat + detailFormat, /\.Config|\.Env|\.Log/);
  assert.doesNotMatch(detailFormat, /json \.State[}\s]/);
});
test("groups Compose replicas, standalone and infrastructure without claiming external workloads", () => {
  const rows = [
    row("a", "example-api-1", "example", "api"),
    row("b", "example-api-2", "example", "api"),
    { ...row("c", "old-worker"), state: "exited" },
    row("d", "deploy-caddy", "deploy"),
    row("e", "deploy-known"),
    row("f", "deploy-unknown"),
    { ...row("g", "custom-proxy", "deploy"), role: "infrastructure" },
  ];
  const groups = groupContainers(
    rows,
    new Map([
      [
        "a",
        {
          state: "running",
          startedAt: "2026-01-01T00:00:00Z",
          restarts: 3,
          health: "unhealthy",
        },
      ],
    ]),
    new Map(),
    [{ name: "deploy-known", projectId: "p1", projectName: "Managed" }],
    Date.parse("2026-01-01T01:00:00Z"),
  );
  assert.equal(
    groups.find((group) => group.name === "example")?.services.length,
    2,
  );
  const service = groups.find((group) => group.name === "example")!.services[0];
  assert.equal(service.uptimeSeconds, 3600);
  assert.equal(service.health, "unhealthy");
  assert.equal(service.restarts, 3);
  assert.equal(
    groups.find((group) => group.kind === "infrastructure")?.services.length,
    2,
  );
  assert.equal(
    groups.find((group) => group.kind === "managed")?.name,
    "Managed",
  );
  const standalone = groups.find(
    (group) => group.name === "Standalone containers",
  )!;
  assert.equal(standalone.kind, "external");
  assert.equal(standalone.services.length, 2);
  assert.equal(
    standalone.services.find((service) => service.name === "old-worker")
      ?.uptimeSeconds,
    null,
  );
});
test("stopped services have no stale resource usage and missing details remain unknown", () => {
  const groups = groupContainers(
    [{ ...row("a", "old"), state: "exited" }],
    new Map(),
    new Map([["a", { cpuPercent: 12, memoryBytes: 10, memoryLimitBytes: 20 }]]),
    [],
    Date.now(),
  );
  assert.equal(groups[0].services[0].usage, null);
  assert.equal(groups[0].services[0].health, "unknown");
  assert.equal(groups[0].services[0].restarts, null);
});
test("container CPU can exceed one core and memory handles binary units", () => {
  const stats = parseContainerStats(
    JSON.stringify({ ID: "abc", CPUPerc: "245.5%", MemUsage: "10MiB / 2GiB" }),
  );
  assert.deepEqual(stats.get("abc"), {
    cpuPercent: 245.5,
    memoryBytes: 10 * 1024 ** 2,
    memoryLimitBytes: 2 * 1024 ** 3,
  });
});
