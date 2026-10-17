import type { ObservedProject } from "../../../shared/observability";
import { bytes, duration, percent } from "./metric-format";

const labels = {
  external: "Discovered · read-only",
  managed: "Aeroplane-managed",
  infrastructure: "Aeroplane infrastructure",
};
export function WorkloadGroups({ projects }: { projects: ObservedProject[] }) {
  return (
    <section aria-labelledby="workloads-heading" className="space-y-4">
      <h2 id="workloads-heading" className="text-lg text-white">
        Service health
      </h2>
      <p className="text-sm text-zinc-400">
        Discovery never adopts or changes workloads. Running means Docker
        reports the process running; healthy requires a configured Docker health
        check. Container CPU uses 100% per logical core.
      </p>
      {projects.length === 0 && (
        <p className="border border-zinc-800 p-6 text-sm text-zinc-400">
          No Docker containers found, including stopped containers.
        </p>
      )}
      {(["external", "managed", "infrastructure"] as const).map((kind) => {
        const groups = projects.filter((project) => project.kind === kind);
        return (
          groups.length > 0 && (
            <div key={kind} className="space-y-3">
              <h3 className="pt-4 text-sm text-zinc-400">{labels[kind]}</h3>
              {groups.map((project) => (
                <article
                  key={project.id}
                  className="border border-zinc-800 bg-black/20"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-5 py-4">
                    <h4 className="break-all text-white">{project.name}</h4>
                    <span className="text-xs text-zinc-500">
                      {project.compose ? "Docker Compose" : "Docker"} ·{" "}
                      {project.services.length}{" "}
                      {project.services.length === 1
                        ? "container"
                        : "containers"}
                    </span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="text-xs text-zinc-500">
                        <tr>
                          {[
                            "Service / container",
                            "State",
                            "Health check",
                            "Restarts",
                            "Uptime",
                            "Container CPU",
                            "Container RAM",
                          ].map((label) => (
                            <th
                              key={label}
                              scope="col"
                              className="px-4 py-3 font-normal"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {project.services.map((service) => (
                          <tr
                            key={service.id}
                            className="border-t border-zinc-800/60 text-zinc-300"
                          >
                            <td className="max-w-72 break-all px-4 py-3">
                              <div>{service.service}</div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {service.name}
                              </div>
                              {!service.detailAvailable && (
                                <div className="text-xs text-amber-300">
                                  Details unavailable
                                </div>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 ${service.state === "running" ? "text-teal-300" : "text-amber-300"}`}
                            >
                              {service.state}
                            </td>
                            <td
                              className={`px-4 py-3 ${service.health === "unhealthy" ? "text-red-300" : ""}`}
                            >
                              {service.health === "none"
                                ? "Not configured"
                                : service.health}
                            </td>
                            <td className="px-4 py-3">
                              {service.restarts ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              {duration(service.uptimeSeconds)}
                            </td>
                            <td className="px-4 py-3">
                              {service.state !== "running"
                                ? "—"
                                : percent(service.usage?.cpuPercent ?? null)}
                            </td>
                            <td className="px-4 py-3">
                              {service.state !== "running"
                                ? "—"
                                : bytes(service.usage?.memoryBytes ?? null)}
                              {service.usage?.memoryLimitBytes ? (
                                <span className="block text-xs text-zinc-500">
                                  / {bytes(service.usage.memoryLimitBytes)}{" "}
                                  limit
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )
        );
      })}
    </section>
  );
}
