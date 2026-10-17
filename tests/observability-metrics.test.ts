import test from "node:test";
import assert from "node:assert/strict";
import {
  appendHistory,
  counterRate,
  cpuPercent,
  parseBytes,
} from "../src/server/observability/metrics-math.js";
import {
  hasReadOnlyMount,
  parseCpuStat,
  parseMemInfo,
  parseNetworkDev,
} from "../src/server/observability/host-parsers.js";
import { createHostCollector } from "../src/server/observability/host-collector.js";

test("CPU excludes guest counters, counts iowait as idle, and needs valid deltas", () => {
  assert.deepEqual(
    parseCpuStat("cpu  10 0 20 50 10 0 5 5 100 100\ncpu0 1\ncpu1 2"),
    { total: 100, idle: 60, count: 2 },
  );
  assert.equal(cpuPercent(undefined, { total: 100, idle: 60 }), null);
  assert.equal(
    cpuPercent({ total: 100, idle: 60 }, { total: 200, idle: 110 }),
    50,
  );
  assert.equal(
    cpuPercent({ total: 200, idle: 110 }, { total: 100, idle: 60 }),
    null,
  );
  assert.equal(
    cpuPercent({ total: 100, idle: 60 }, { total: 100, idle: 60 }),
    null,
  );
});
test("network rates use elapsed time and suppress resets and first samples", () => {
  assert.equal(counterRate(1000, 4000, 15000), 200);
  assert.equal(counterRate(undefined, 4000, 15000), null);
  assert.equal(counterRate(4000, 1000, 15000), null);
  assert.equal(counterRate(1000, 4000, 0), null);
  const line = (name: string, rx: number, tx: number) =>
    `${name}: ${rx} 0 0 0 0 0 0 0 ${tx} 0 0 0 0 0 0 0`;
  assert.deepEqual(
    parseNetworkDev(
      [
        line("lo", 999, 999),
        line("eth0", 200, 300),
        line("veth123", 500, 500),
        line("br-abc", 500, 500),
      ].join("\n"),
    ),
    { receive: 200, transmit: 300 },
  );
});
test("memory excludes available cache and byte parsing handles Docker units", () => {
  assert.deepEqual(parseMemInfo("MemTotal: 8000 kB\nMemAvailable: 3000 kB"), {
    total: 8192000,
    used: 5120000,
  });
  assert.throws(() => parseMemInfo("MemTotal: 8000 kB"));
  assert.equal(parseBytes("1.5 GiB"), 1.5 * 1024 ** 3);
  assert.equal(parseBytes("2MB"), 2000000);
  assert.equal(parseBytes("n/a"), null);
});
test("history prunes by age and count without mutating prior snapshots", () => {
  const original = [{ timestamp: 1 }, { timestamp: 20 }, { timestamp: 30 }];
  assert.deepEqual(appendHistory(original, { timestamp: 40 }, 25, 2), [
    { timestamp: 30 },
    { timestamp: 40 },
  ]);
  assert.equal(original.length, 3);
  let history: { timestamp: number }[] = [];
  for (let index = 0; index < 1000; index++)
    history = appendHistory(
      history,
      { timestamp: index * 15000 },
      3600000,
      240,
    );
  assert.equal(history.length, 240);
  assert.equal(history[0].timestamp, 760 * 15000);
});
test("unconfigured collector never claims process or container metrics as host measurements", async () => {
  const sample = await createHostCollector({})(123);
  assert.equal(sample.source, "unavailable");
  assert.equal(sample.current.cpuPercent, null);
  assert.equal(sample.current.diskTotalBytes, null);
  assert.equal(sample.current.memoryTotalBytes, null);
  assert.match(sample.messages[0], /not configured/);
});

test("mount mode rejects missing or writable host mounts instead of measuring container disk", async () => {
  assert.equal(
    hasReadOnlyMount(
      "36 25 0:31 / /host/root ro,relatime - ext4 /dev/vda1 rw",
      "/host/root",
    ),
    true,
  );
  assert.equal(
    hasReadOnlyMount(
      "36 25 0:31 / /host/root rw,relatime - ext4 /dev/vda1 rw",
      "/host/root",
    ),
    false,
  );
  assert.equal(hasReadOnlyMount("", "/host/root"), false);
  const sample = await createHostCollector({
    AEROPLANE_HOST_METRICS: "mounts",
  })(123);
  assert.equal(sample.current.diskTotalBytes, null);
  assert.match(sample.messages.join(" "), /Root disk unavailable/);
});
