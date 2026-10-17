import { readFile, statfs } from "node:fs/promises";
import { cpus, freemem, totalmem, uptime } from "node:os";
import type {
  HostSample,
  ObservabilitySnapshot,
} from "../../shared/observability.js";
import { counterRate, cpuPercent } from "./metrics-math.js";
import {
  hasReadOnlyMount,
  parseCpuStat,
  parseMemInfo,
  parseNetworkDev,
} from "./host-parsers.js";

type Baseline = {
  timestamp: number;
  cpu?: { total: number; idle: number };
  network?: { receive: number; transmit: number };
};
export function createHostCollector(env = process.env) {
  let previous: Baseline | undefined;
  const mounts = env.AEROPLANE_HOST_METRICS === "mounts";
  const native = env.AEROPLANE_HOST_METRICS === "native";
  const source: ObservabilitySnapshot["host"]["source"] = mounts
    ? "host-mounts"
    : native
      ? "native-host"
      : "unavailable";
  return async function collectHost(timestamp: number) {
    const current: HostSample = {
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
    };
    const messages: string[] = [];
    const next: Baseline = { timestamp };
    if (!mounts && !native) {
      return {
        source,
        messages: [
          "Host metrics are not configured. Enable verified host mounts or native-host collection; container measurements are shown separately.",
        ],
        current,
      };
    }
    const mountInfo = mounts
      ? await readFile("/proc/self/mountinfo", "utf8").catch(() => "")
      : "";
    const requireMount = (path: string) => {
      if (mounts && !hasReadOnlyMount(mountInfo, path))
        throw new Error("Required read-only mount missing");
    };
    const proc = mounts ? "/host/proc" : "/proc";
    const attempt = async (label: string, action: () => Promise<void>) => {
      try {
        await action();
      } catch {
        messages.push(
          `${label} unavailable from the configured host collector.`,
        );
      }
    };
    await Promise.all([
      attempt("CPU", async () => {
        requireMount("/host/proc");
        if (native && process.platform !== "linux") {
          const cores = cpus();
          next.cpu = {
            idle: cores.reduce((sum, core) => sum + core.times.idle, 0),
            total: cores.reduce(
              (sum, core) =>
                sum + Object.values(core.times).reduce((a, b) => a + b, 0),
              0,
            ),
          };
          current.cpuCount = cores.length;
        } else {
          const parsed = parseCpuStat(await readFile(`${proc}/stat`, "utf8"));
          next.cpu = parsed;
          current.cpuCount = parsed.count;
        }
        current.cpuPercent = cpuPercent(previous?.cpu, next.cpu);
      }),
      attempt("RAM", async () => {
        requireMount("/host/proc");
        const memory =
          native && process.platform !== "linux"
            ? { total: totalmem(), used: totalmem() - freemem() }
            : parseMemInfo(await readFile(`${proc}/meminfo`, "utf8"));
        current.memoryTotalBytes = memory.total;
        current.memoryUsedBytes = memory.used;
      }),
      attempt("Uptime", async () => {
        requireMount("/host/proc");
        const value = native
          ? uptime()
          : Number((await readFile(`${proc}/uptime`, "utf8")).split(/\s+/)[0]);
        if (!Number.isFinite(value)) throw new Error("Invalid uptime");
        current.uptimeSeconds = value;
      }),
      attempt("Root disk", async () => {
        requireMount("/host/root");
        const disk = await statfs(mounts ? "/host/root" : "/");
        current.diskTotalBytes = disk.blocks * disk.bsize;
        current.diskUsedBytes = (disk.blocks - disk.bfree) * disk.bsize;
      }),
      attempt("Network", async () => {
        requireMount("/host/proc");
        // PID 1 belongs to the host when /proc is bind-mounted, even with private container networking.
        next.network = parseNetworkDev(
          await readFile(`${proc}/1/net/dev`, "utf8"),
        );
        current.networkReceiveBytesPerSecond = counterRate(
          previous?.network?.receive,
          next.network.receive,
          timestamp - (previous?.timestamp ?? timestamp),
        );
        current.networkTransmitBytesPerSecond = counterRate(
          previous?.network?.transmit,
          next.network.transmit,
          timestamp - (previous?.timestamp ?? timestamp),
        );
      }),
    ]);
    previous = next;
    if (
      current.cpuPercent === null ||
      current.networkReceiveBytesPerSecond === null
    )
      messages.push(
        "Rate measurements need two valid samples; counters reset after collector or host restart.",
      );
    return { source, messages, current };
  };
}
