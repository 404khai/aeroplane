import { FolderCodeIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import { Link, useLocation } from "@tanstack/react-router";
import type { AuthUser, ToolCheck } from "../../api";
import { SignOutButton } from "../../components/auth/sign-out-button";
import { BrandMark } from "../../components/ui/brand-mark";
import { AppIcon } from "../../components/ui/primitives";
import { SystemHealthPill } from "./system-health-pill";

export type DashboardSidebarItem = {
  id: string;
  label: string;
  icon: unknown;
  active: boolean;
  attention?: boolean;
  onSelect: () => void;
};

function userInitials(user: AuthUser | null) {
  const source = user?.name || user?.email || "A";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProjectsDashboardSidebar({
  currentUser,
  tools,
  owner,
  showSystemHealth = true,
  contextLabel,
  contextItems = [],
}: {
  currentUser: AuthUser | null;
  tools: ToolCheck[];
  owner: boolean;
  showSystemHealth?: boolean;
  contextLabel?: string;
  contextItems?: DashboardSidebarItem[];
}) {
  const overview = useLocation().pathname === "/settings/vps-overview";
  return (
    <aside className="relative z-20 flex items-center border-b border-white/10 bg-black px-5 py-4 lg:sticky lg:top-0 lg:h-dvh lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center border border-white/20 bg-white/10">
          <BrandMark className="h-[18px] w-[18px] brightness-0 invert" />
        </span>
        <div>
          <div className="font-hero text-sm tracking-[-0.02em] text-white">
            aeroplane
          </div>
          <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.25em] text-zinc-500">
            Control plane
          </div>
        </div>
      </div>

      <nav
        aria-label="Dashboard"
        className="mt-10 hidden min-h-0 flex-1 overflow-y-auto lg:block"
      >
        <p className="mb-3 px-3 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-600">
          Workspace
        </p>
        <Link
          to="/"
          aria-current={overview ? undefined : "page"}
          className={`flex h-11 items-center gap-3 border-l-2 px-3 transition hover:bg-white/15 ${overview ? "border-transparent text-zinc-500" : "border-white bg-white/10 text-white"}`}
        >
          <AppIcon icon={FolderCodeIcon} size={16} />
          <span className="text-sm">Projects</span>
        </Link>
        {owner && (
          <Link
            to="/settings/$settingsPage"
            params={{ settingsPage: "vps-overview" }}
            aria-current={overview ? "page" : undefined}
            className={`mt-1 flex h-11 items-center gap-3 px-3 text-sm ${overview ? "border-l-2 border-white bg-white/10 text-white" : "text-zinc-500 hover:text-white"}`}
          >
            VPS overview
          </Link>
        )}
        <Link
          to="/settings/$settingsPage"
          params={{ settingsPage: "domains" }}
          className="mt-1 flex h-11 w-full items-center gap-3 px-3 text-zinc-500 transition hover:bg-white/5 hover:text-white"
        >
          <AppIcon icon={Settings01Icon} size={16} />
          <span className="text-sm">System settings</span>
        </Link>

        {contextItems.length > 0 ? (
          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="mb-3 truncate px-3 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-600">
              {contextLabel || "Service"}
            </p>
            <div className="space-y-1">
              {contextItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    item.active
                      ? "flex h-10 w-full items-center gap-3 bg-white/10 px-3 text-left text-sm text-white"
                      : "flex h-10 w-full items-center gap-3 px-3 text-left text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white"
                  }
                  onClick={item.onSelect}
                  aria-current={item.active ? "page" : undefined}
                >
                  <AppIcon icon={item.icon} size={15} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.attention ? (
                    <span className="h-1.5 w-1.5 bg-amber-400" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      {owner && (
        <Link
          to="/settings/$settingsPage"
          params={{ settingsPage: "vps-overview" }}
          className="ml-auto px-3 text-xs text-teal-300 lg:hidden"
        >
          VPS overview
        </Link>
      )}
      <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:mt-auto lg:block">
        {owner && showSystemHealth ? (
          <div className="hidden lg:block">
            <SystemHealthPill tools={tools} />
          </div>
        ) : null}

        <div className="flex items-center gap-3 lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
          <span className="grid h-9 w-9 flex-none place-items-center bg-white text-xs text-black">
            {userInitials(currentUser)}
          </span>
          <span className="hidden min-w-0 flex-1 lg:block">
            <span className="block truncate text-xs text-white">
              {currentUser?.name || "Aeroplane user"}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-600">
              {currentUser?.role || "Member"}
            </span>
          </span>
          <SignOutButton className="border-white/10 bg-transparent hover:border-white/25 hover:bg-white/5 hover:text-white" />
        </div>
      </div>
    </aside>
  );
}
