import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  activeVpsTool,
  isVpsTool,
  vpsTools,
  workspaceSection,
} from "../observability/vps-tools";
export function DashboardMobileNavigation({ owner }: { owner: boolean }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const section = workspaceSection(pathname);
  const selected =
    section === "vps" && owner
      ? `vps:${activeVpsTool(pathname) ?? "overview"}`
      : section === "settings"
        ? "settings"
        : "projects";
  return (
    <select
      aria-label="Workspace navigation"
      value={selected}
      onChange={(event) => {
        const value = event.target.value;
        const tool = value.replace(/^vps:/, "");
        if (owner && value.startsWith("vps:") && isVpsTool(tool))
          void navigate({ to: "/vps/$tool", params: { tool } });
        else if (value === "settings")
          void navigate({
            to: "/settings/$settingsPage",
            params: { settingsPage: "domains" },
          });
        else void navigate({ to: "/" });
      }}
      className="ml-auto min-w-0 max-w-32 border border-white/15 bg-black px-2 py-2 text-xs text-zinc-300 lg:hidden"
    >
      <option value="projects">Projects</option>
      {owner &&
        vpsTools.map((tool) => (
          <option key={tool.slug} value={`vps:${tool.slug}`}>
            {tool.label}
          </option>
        ))}
      <option value="settings">System settings</option>
    </select>
  );
}
