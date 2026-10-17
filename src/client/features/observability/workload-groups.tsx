import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ObservedProject } from "../../../shared/observability";
import { ProjectCanvas } from "./project-canvas";
import { ServiceDetailPanel } from "./service-detail-panel";
const labels = {
  external: "Discovered · read-only",
  managed: "Aeroplane-managed",
  infrastructure: "Aeroplane infrastructure",
};
export function WorkloadGroups({ projects }: { projects: ObservedProject[] }) {
  const [selected, setSelected] = useState<string | undefined>();
  return (
    <section aria-labelledby="workloads-heading" className="space-y-4">
      <h2 id="workloads-heading" className="text-lg text-white">
        Project canvas
      </h2>
      <p className="text-sm text-zinc-400">
        Select a service to inspect metrics, logs, networks, routes, storage and
        database tables. Discovery never adopts or changes workloads. Running
        means the process is running; healthy requires a Docker health check.
      </p>
      {!projects.length && (
        <p className="border border-zinc-800 p-6 text-sm text-zinc-400">
          No Docker containers found, including stopped containers.
        </p>
      )}
      {(["external", "managed", "infrastructure"] as const).map((kind) => {
        const groups = projects.filter((p) => p.kind === kind);
        return (
          !!groups.length && (
            <div key={kind} className="space-y-3">
              <h3 className="pt-4 text-sm text-zinc-400">{labels[kind]}</h3>
              {groups.map((project) => {
                const service = project.services.find((s) => s.id === selected);
                return (
                  <article
                    key={project.id}
                    className="border border-zinc-800 bg-black/20"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-5 py-4">
                      <h4 className="text-white">{project.name}</h4>
                      <div className="flex gap-3 text-xs text-zinc-500">
                        {project.managedSlug && (
                          <Link
                            className="text-zinc-300 underline"
                            to="/$projectSlug"
                            params={{ projectSlug: project.managedSlug }}
                          >
                            Open managed project
                          </Link>
                        )}
                        <span>
                          {project.compose ? "Docker Compose" : "Docker"} ·{" "}
                          {project.services.length} containers
                        </span>
                      </div>
                    </header>
                    <ProjectCanvas
                      project={project}
                      selected={selected}
                      onSelect={(s) => setSelected(s.id)}
                    />
                    {service && (
                      <ServiceDetailPanel
                        key={service.id}
                        service={service}
                        onClose={() => setSelected(undefined)}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )
        );
      })}
    </section>
  );
}
