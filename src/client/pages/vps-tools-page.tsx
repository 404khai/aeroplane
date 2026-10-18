import { useAuthStatus } from "../components/auth/auth-context";
import { ProjectsDashboardSidebar } from "../features/projects/projects-dashboard-sidebar";
import { usePageTitle } from "../lib/page-title";
import { useObservabilitySnapshot } from "../features/observability/use-observability-snapshot";
import { VpsToolContent } from "../features/observability/vps-tool-content";
import { vpsTools, type VpsTool } from "../features/observability/vps-tools";
export function VpsToolsPage({ tool }: { tool: VpsTool }) {
  const definition = vpsTools.find((item) => item.slug === tool)!;
  usePageTitle(definition.label);
  const auth = useAuthStatus();
  const owner = auth?.user?.role === "owner";
  const { snapshot, error, retry } = useObservabilitySnapshot(owner);
  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="grid min-h-dvh lg:grid-cols-[260px_minmax(0,1fr)]">
        <ProjectsDashboardSidebar
          currentUser={auth?.user ?? null}
          tools={[]}
          owner={owner}
          showSystemHealth={false}
        />
        <div className="min-w-0 space-y-8 bg-zinc-950 px-5 py-8 sm:px-8 lg:px-10">
          <header>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">
              VPS tools
            </p>
            <h1 className="mt-3 text-3xl tracking-tight">{definition.label}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {definition.description}
            </p>
          </header>
          {!owner ? (
            <p role="alert">
              Owner access is required to view host and external workload
              information.
            </p>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="border border-red-500/30 p-4 text-sm text-red-200"
                >
                  {error}
                  <button className="ml-3 underline" onClick={retry}>
                    Retry
                  </button>
                  {snapshot && (
                    <p className="mt-2">Showing the last successful sample.</p>
                  )}
                </div>
              )}
              {!snapshot && !error && (
                <p role="status" className="animate-pulse text-zinc-400">
                  Discovering Docker workloads and collecting host metrics…
                </p>
              )}
              {snapshot && (
                <>
                  <p className="text-xs text-zinc-500">
                    Sampled {new Date(snapshot.sampledAt).toLocaleString()} ·
                    refreshes every 15 seconds · up to one hour of in-memory
                    history
                  </p>
                  {snapshot.docker.message && tool !== "overview" && (
                    <p
                      role="status"
                      className="border border-amber-500/20 p-4 text-sm text-amber-200"
                    >
                      {snapshot.docker.message}
                    </p>
                  )}
                  <VpsToolContent tool={tool} snapshot={snapshot} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
