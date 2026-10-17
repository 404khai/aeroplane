import test from "node:test";
import assert from "node:assert/strict";
import { createObservabilitySampler } from "../src/server/observability/observability-sampler.js";
import { createHostCollector } from "../src/server/observability/host-collector.js";

test("clients share a single initial sample and reuse its bounded snapshot", async () => {
  let resolve!: () => void;
  const barrier = new Promise<void>((done) => {
    resolve = done;
  });
  let dockerCalls = 0;
  const sampler = createObservabilitySampler(() => [], {
    host: createHostCollector({}),
    docker: async () => {
      dockerCalls++;
      await barrier;
      return { rows: [], details: new Map(), usage: new Map(), message: null };
    },
  });
  try {
    const first = sampler.getSnapshot();
    const second = sampler.getSnapshot();
    assert.equal(dockerCalls, 1);
    resolve();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a, b);
    assert.equal(await sampler.getSnapshot(), a);
    assert.equal(dockerCalls, 1);
    assert.equal(a.host.history.length, 1);
    assert.equal(a.intervalMs, 15000);
    assert.equal(a.retentionMs, 3600000);
  } finally {
    sampler.stop();
  }
});
test("Docker outage preserves host collection with generic diagnostics", async () => {
  const host = await createHostCollector({})(123);
  const sampler = createObservabilitySampler(() => [], {
    host: async () => ({
      ...host,
      current: {
        ...host.current,
        memoryTotalBytes: 8000,
        memoryUsedBytes: 3000,
      },
    }),
    docker: async () => {
      throw new Error("sensitive daemon configuration");
    },
  });
  try {
    const snapshot = await sampler.getSnapshot();
    assert.equal(snapshot.docker.available, false);
    assert.equal(snapshot.host.current.memoryTotalBytes, 8000);
    assert.deepEqual(snapshot.projects, []);
    assert.doesNotMatch(JSON.stringify(snapshot), /sensitive/);
  } finally {
    sampler.stop();
  }
});
