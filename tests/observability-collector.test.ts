import test from "node:test";
import assert from "node:assert/strict";
import { collectDocker } from "../src/server/observability/docker-collector.js";

const id = "a".repeat(64);
const summary = JSON.stringify({
  id,
  name: "sample-api-1",
  state: "running",
  project: "sample",
  service: "api",
  role: "",
});
const detail = JSON.stringify({
  id,
  state: "running",
  startedAt: "2026-01-01T00:00:00Z",
  restarts: 2,
  health: "healthy",
});
test("collection uses only four bounded read operations with selected inspect fields", async () => {
  const commands: string[][] = [];
  const result = await collectDocker(async (args) => {
    commands.push(args);
    if (args[0] === "ps") return summary;
    if (args[0] === "inspect") return detail;
    if (args[0] === "stats")
      return JSON.stringify({
        ID: id,
        CPUPerc: "1.5%",
        MemUsage: "1MiB / 1GiB",
      });
    throw new Error("Unexpected command");
  });
  assert.deepEqual(
    commands.map((args) => args[0]),
    ["ps", "inspect", "inspect", "stats"],
  );
  assert.ok(commands[0].includes("--all"));
  assert.ok(commands[1].includes("--format"));
  assert.ok(commands[3].includes("--no-stream"));
  assert.equal(result.details.get(id)?.health, "healthy");
  assert.equal(result.usage.get(id)?.memoryBytes, 1024 ** 2);
});
test("disappearing containers preserve available detail and stats failure is generic", async () => {
  const result = await collectDocker(async (args) => {
    if (args[0] === "ps") return summary;
    if (args[0] === "inspect")
      throw Object.assign(new Error("private daemon error"), {
        stdout: detail,
      });
    throw new Error("private daemon error");
  });
  assert.equal(result.details.get(id)?.restarts, 2);
  assert.equal(result.usage.size, 0);
  assert.match(result.message!, /resource metrics unavailable/);
  assert.doesNotMatch(result.message!, /private/);
});
test("empty discovery skips inspect/stats and daemon failure propagates for the sampler", async () => {
  const commands: string[] = [];
  const result = await collectDocker(async (args) => {
    commands.push(args[0]);
    return "";
  });
  assert.equal(result.rows.length, 0);
  assert.deepEqual(commands, ["ps"]);
  await assert.rejects(
    collectDocker(async () => {
      throw new Error("unavailable");
    }),
  );
});
test("large hosts are capped and report truncation", async () => {
  const summaries = Array.from({ length: 501 }, (_, index) =>
    JSON.stringify({
      id: index.toString(16).padStart(64, "0"),
      name: `stopped-${index}`,
      state: "exited",
      project: "",
      service: "",
      role: "",
    }),
  ).join("\n");
  const result = await collectDocker(async (args) =>
    args[0] === "ps" ? summaries : "",
  );
  assert.equal(result.rows.length, 500);
  assert.match(result.message!, /500 containers/);
});

test("partial topology survives container churn without requesting bind source paths", async () => {
  const topology = JSON.stringify({
    id,
    image: "postgres:17",
    networks: ["shared", null],
    mounts: [
      { name: null, destination: "/data", type: "bind", writable: true },
      null,
    ],
    depends: "",
  });
  const result = await collectDocker(async (args) => {
    if (args[0] === "ps") return summary;
    if (
      args[0] === "inspect" &&
      args.some((arg) => arg.includes('"networks"'))
    ) {
      assert.ok(args.some((arg) => arg.includes('index . "Name"')));
      throw Object.assign(new Error("container disappeared"), {
        stdout: topology,
      });
    }
    if (args[0] === "inspect") return detail;
    return "";
  });
  assert.equal(result.topology.get(id)?.mounts[0].name, "bind mount");
  assert.deepEqual(result.topology.get(id)?.dependencies, []);
});
