import type {
  ContainerUsage,
  ObservedProject,
  WorkloadKind,
} from "../../shared/observability.js";
import { parseBytes } from "./metrics-math.js";

// Only these selected fields cross the process boundary. Never request Config.Env or health logs.
export const listFormat =
  '{"id":{{json .ID}},"name":{{json .Names}},"state":{{json .State}},"project":{{json (.Label "com.docker.compose.project")}},"service":{{json (.Label "com.docker.compose.service")}},"role":{{json (.Label "io.aeroplane.role")}}}';
export const detailFormat =
  '{"id":{{json .Id}},"state":{{json .State.Status}},"startedAt":{{json .State.StartedAt}},"restarts":{{json .RestartCount}},"health":{{if (index .State "Health")}}{{json .State.Health.Status}}{{else}}"none"{{end}}}';
export type ContainerSummary = {
  id: string;
  name: string;
  state: string;
  project: string;
  service: string;
  role: string;
};
export type ContainerDetail = {
  state: string;
  startedAt: string;
  restarts: number;
  health: string;
};
export type ManagedContainer = {
  name: string;
  projectId: string;
  projectName: string;
  domains?: string[];
  projectSlug?: string;
};

export function parseContainerList(output: string): ContainerSummary[] {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const row = JSON.parse(line);
      for (const key of ["id", "name", "state", "project", "service", "role"]) {
        if (typeof row[key] !== "string")
          throw new Error("Invalid Docker summary");
      }
      if (!/^[a-f0-9]{12,64}$/.test(row.id))
        throw new Error("Invalid container ID");
      return {
        id: row.id,
        name: row.name,
        state: row.state,
        project: row.project,
        service: row.service,
        role: row.role,
      };
    });
}

export function groupContainers(
  rows: ContainerSummary[],
  details: Map<string, ContainerDetail>,
  usage: Map<string, ContainerUsage>,
  managed: ManagedContainer[],
  now: number,
): ObservedProject[] {
  const groups = new Map<string, ObservedProject>();
  const known = new Map(managed.map((item) => [item.name, item]));
  for (const row of rows) {
    const owned = known.get(row.name);
    // Names identify upstream's existing infrastructure; the explicit label supports custom names.
    const infrastructure =
      row.role === "infrastructure" ||
      ["aeroplane", "deploy-caddy", "deploy-buildkit"].includes(row.name);
    const kind: WorkloadKind = owned
      ? "managed"
      : infrastructure
        ? "infrastructure"
        : "external";
    const name =
      owned?.projectName ??
      (infrastructure
        ? "Aeroplane infrastructure"
        : row.project || "Standalone containers");
    const id = `${kind}:${owned?.projectId ?? (infrastructure ? "infrastructure" : row.project ? `compose:${row.project}` : "standalone")}`;
    const group = groups.get(id) ?? {
      id,
      name,
      kind,
      managedSlug: owned?.projectSlug,
      compose: !owned && !infrastructure && Boolean(row.project),
      services: [],
    };
    const detail = details.get(row.id);
    const state = detail?.state ?? row.state;
    const start = Date.parse(detail?.startedAt ?? "");
    group.services.push({
      id: row.id,
      name: row.name,
      service: row.service || row.name,
      state,
      health: detail?.health ?? "unknown",
      restarts: detail?.restarts ?? null,
      uptimeSeconds:
        state === "running" && Number.isFinite(start) && start > 0
          ? Math.max(0, (now - start) / 1000)
          : null,
      usage: state === "running" ? (usage.get(row.id) ?? null) : null,
      detailAvailable: Boolean(detail),
    });
    groups.set(id, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((group) => ({
      ...group,
      services: group.services.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function parseContainerStats(
  output: string,
): Map<string, ContainerUsage> {
  const result = new Map<string, ContainerUsage>();
  for (const line of output.trim().split("\n").filter(Boolean)) {
    const row = JSON.parse(line) as {
      ID: string;
      CPUPerc: string;
      MemUsage: string;
    };
    const [used, limit] = row.MemUsage.split("/");
    const cpu = Number.parseFloat(row.CPUPerc);
    result.set(row.ID, {
      cpuPercent: Number.isFinite(cpu) && cpu >= 0 ? cpu : null,
      memoryBytes: parseBytes(used ?? ""),
      memoryLimitBytes: parseBytes(limit ?? ""),
    });
  }
  return result;
}
