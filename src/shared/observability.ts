export type WorkloadKind = "external" | "managed" | "infrastructure";
export type ContainerUsage = {
  cpuPercent: number | null;
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
};
export type ObservedService = {
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
export type ObservedProject = {
  id: string;
  name: string;
  kind: WorkloadKind;
  compose: boolean;
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
