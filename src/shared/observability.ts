export type WorkloadKind = "external" | "managed" | "infrastructure";
export type ContainerUsage = {
  cpuPercent: number | null;
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
};
export type ObservedService = {
  topology?: ServiceTopology;
  id: string;
  name: string;
  service: string;
  state: string;
  health: string;
  restarts: number | null;
  uptimeSeconds: number | null;
  usage: ContainerUsage | null;
  detailAvailable: boolean;
};
export type ServiceTopology = {
  networks: string[];
  dependencies: string[];
  domains: { hostname: string; source: string }[];
  mounts: {
    name: string;
    destination: string;
    type: string;
    writable: boolean;
  }[];
  image: string;
};
export type ServiceSample = ContainerUsage & { timestamp: number };
export type Incident = {
  id: string;
  target: string;
  condition: string;
  openedAt: number;
  resolvedAt: number | null;
  acknowledgedAt: number | null;
};
export type ObservedProject = {
  id: string;
  name: string;
  kind: WorkloadKind;
  compose: boolean;
  managedSlug?: string;
  services: ObservedService[];
};
export type HostSample = {
  timestamp: number;
  cpuPercent: number | null;
  cpuCount: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  uptimeSeconds: number | null;
  networkReceiveBytesPerSecond: number | null;
  networkTransmitBytesPerSecond: number | null;
};
export type ObservabilitySnapshot = {
  sampledAt: number;
  intervalMs: number;
  retentionMs: number;
  docker: { available: boolean; message: string | null };
  projects: ObservedProject[];
  host: {
    source: "host-mounts" | "native-host" | "unavailable";
    messages: string[];
    current: HostSample;
    history: HostSample[];
  };
};
