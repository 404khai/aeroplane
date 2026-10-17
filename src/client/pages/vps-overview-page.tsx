import { ResourceAlertsPanel } from "../features/observability/resource-alerts-panel";
import { StoragePanel } from "../features/observability/storage-panel";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { api } from "../api";
import type { ObservabilitySnapshot } from "../../shared/observability";
import { useAuthStatus } from "../components/auth/auth-context";
import { ProjectsDashboardSidebar } from "../features/projects/projects-dashboard-sidebar";
import { HostMetricsPanel } from "../features/observability/host-metrics-panel";
import { WorkloadGroups } from "../features/observability/workload-groups";
import { usePageTitle } from "../lib/page-title";

export function VpsOverviewPage() {
  usePageTitle("VPS overview");
  const auth = useAuthStatus();
  const owner = auth?.user?.role === "owner";
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(refresh, 15_000);
        return;
      }
      try {
        const result = await api.observability();
        if (!cancelled) {
          setSnapshot(result);
          setError("");
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load observability",
          );
      }
      if (!cancelled) timer = setTimeout(refresh, 15_000);
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [owner, retry]);
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
            <Link to="/" className="text-sm text-zinc-400 hover:text-white">
              ← Managed projects
            </Link>
            <h1 className="mt-4 text-3xl tracking-tight">VPS overview</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Read-only visibility into existing Docker workloads and configured
              host measurements.
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
                  {error}{" "}
                  <button
                    className="ml-3 underline"
                    onClick={() => setRetry((value) => value + 1)}
                  >
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
                    host and service history
                  </p>
                  <HostMetricsPanel host={snapshot.host} />
                  <ResourceAlertsPanel />
                  {snapshot.docker.message && (
                    <p
                      role="status"
                      className="border border-amber-500/20 p-4 text-sm text-amber-200"
                    >
                      {snapshot.docker.message}
                    </p>
                  )}
                  {snapshot.docker.available && (
                    <>
                      <WorkloadGroups projects={snapshot.projects} />
                      <details className="border border-zinc-800 p-5">
                        <summary className="cursor-pointer text-lg">
                          Detailed host storage
                        </summary>
                        <div className="mt-5">
                          <StoragePanel projects={snapshot.projects} />
                        </div>
                      </details>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
