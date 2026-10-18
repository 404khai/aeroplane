import {
  AlertCircleIcon,
  CloudServerIcon,
  DashboardSquare02Icon,
  DatabaseIcon,
  FolderCodeIcon,
  HardDriveIcon,
  ShieldUserIcon,
  VideoConsoleIcon,
} from "@hugeicons/core-free-icons";

export const vpsTools = [
  {
    slug: "overview",
    label: "VPS overview",
    icon: CloudServerIcon,
    description: "Host health, resources and availability.",
  },
  {
    slug: "projects",
    label: "Project canvas",
    icon: FolderCodeIcon,
    description:
      "Discovered and managed workloads, with explicit topology evidence.",
  },
  {
    slug: "databases",
    label: "Databases",
    icon: DatabaseIcon,
    description:
      "Connect to existing PostgreSQL databases and browse their tables and rows.",
  },
  {
    slug: "logs",
    label: "Logs",
    icon: VideoConsoleIcon,
    description: "Bounded live logs from a selected Docker service.",
  },
  {
    slug: "metrics",
    label: "Metrics",
    icon: DashboardSquare02Icon,
    description: "CPU and RAM history for a selected service.",
  },
  {
    slug: "alerts",
    label: "Alerts",
    icon: AlertCircleIcon,
    description:
      "Resource and health incidents, recovery and acknowledgements.",
  },
  {
    slug: "certificates",
    label: "Certificates",
    icon: ShieldUserIcon,
    description: "Existing routes, certificate visibility and TLS expiry.",
  },
  {
    slug: "storage",
    label: "Storage",
    icon: HardDriveIcon,
    description: "Docker volumes, images, references and reclaimable storage.",
  },
] as const;
export type VpsTool = (typeof vpsTools)[number]["slug"];
export function isVpsTool(value: unknown): value is VpsTool {
  return vpsTools.some((tool) => tool.slug === value);
}
export function activeVpsTool(pathname: string): VpsTool | undefined {
  if (
    pathname === "/settings/vps-overview" ||
    pathname === "/vps" ||
    pathname === "/vps/"
  )
    return "overview";
  const match = /^\/vps\/([^/]+)\/?$/.exec(pathname);
  return match && isVpsTool(match[1]) ? match[1] : undefined;
}
export function workspaceSection(pathname: string) {
  if (activeVpsTool(pathname) || pathname.startsWith("/vps/")) return "vps";
  return /^\/settings(?:\/|$)/.test(pathname) ? "settings" : "projects";
}
