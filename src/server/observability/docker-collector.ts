import { parseTopology, topologyFormat } from "./topology.js";
import type { ContainerUsage } from "../../shared/observability.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  detailFormat,
  listFormat,
  parseContainerList,
  parseContainerStats,
  type ContainerDetail,
} from "./docker-discovery.js";

const execute = promisify(execFile);
export async function dockerRead(args: string[]) {
  const { stdout } = await execute("docker", args, {
    timeout: 8000,
    maxBuffer: 4 * 1024 * 1024,
    encoding: "utf8",
  });
  return stdout;
}

export async function collectDocker(read = dockerRead) {
  const all = parseContainerList(
    await read(["ps", "--all", "--no-trunc", "--format", listFormat]),
  );
  const rows = all.slice(0, 500);
  const details = new Map<string, ContainerDetail>();
  // A single bounded inspect call avoids spawning a process for every container.
  // Docker may return partial selected output when a container disappears between calls.
  if (rows.length) {
    try {
      let output: string;
      try {
        output = await read([
          "inspect",
          "--type",
          "container",
          "--format",
          detailFormat,
          ...rows.map((row) => row.id),
        ]);
      } catch (error) {
        output =
          typeof (error as { stdout?: unknown }).stdout === "string"
            ? (error as { stdout: string }).stdout
            : "";
      }
      for (const line of output.trim().split("\n").filter(Boolean)) {
        const detail = JSON.parse(line) as ContainerDetail & { id: string };
        if (rows.some((row) => row.id === detail.id))
          details.set(detail.id, detail);
      }
    } catch {
      /* Report unavailable detail on individual services. */
    }
  }
  const topology = new Map<
    string,
    import("../../shared/observability.js").ServiceTopology
  >();
  if (rows.length) {
    try {
      let output = "";
      try {
        output = await read([
          "inspect",
          "--type",
          "container",
          "--format",
          topologyFormat,
          ...rows.map((row) => row.id),
        ]);
      } catch (error) {
        output =
          typeof (error as { stdout?: unknown }).stdout === "string"
            ? (error as { stdout: string }).stdout
            : "";
      }
      for (const [id, value] of parseTopology(output)) {
        if (rows.some((row) => row.id === id)) topology.set(id, value);
      }
    } catch {
      /* Detail panel explicitly shows unknown topology. */
    }
  }
  let usage = new Map<string, ContainerUsage>();
  let statsAvailable = true;
  const running = rows.filter((row) => row.state === "running");
  if (running.length) {
    try {
      usage = parseContainerStats(
        await read([
          "stats",
          "--no-stream",
          "--no-trunc",
          "--format",
          "{{json .}}",
          ...running.map((row) => row.id),
        ]),
      );
    } catch {
      statsAvailable = false;
    }
  }
  const messages = [
    all.length > 500 ? "Discovery limited to 500 containers." : "",
    !statsAvailable ? "Container resource metrics unavailable." : "",
    details.size < rows.length
      ? "Some service details are unavailable; containers may have changed during discovery."
      : "",
  ].filter(Boolean);
  return {
    rows,
    details,
    usage,
    topology,
    message: messages.join(" ") || null,
  };
}
