import type {
  ObservedProject,
  ObservedService,
} from "../../../shared/observability";
import { bytes, percent } from "./metric-format";

export function ProjectCanvas({
  project,
  selected,
  onSelect,
}: {
  project: ObservedProject;
  selected?: string;
  onSelect: (service: ObservedService) => void;
}) {
  const positions = new Map(
    project.services.map((service, i) => [
      service.id,
      { x: (i % 3) * 310 + 24, y: Math.floor(i / 3) * 205 + 24 },
    ]),
  );
  const edges = project.services.flatMap((service) =>
    (service.topology?.dependencies ?? []).flatMap((dependency) => {
      const target = project.services.find((s) => s.service === dependency);
      return target ? [{ from: service.id, to: target.id, dependency }] : [];
    }),
  );
  const networks = [
    ...new Set(project.services.flatMap((s) => s.topology?.networks ?? [])),
  ];
  return (
    <div>
      <div className="overflow-auto bg-black/20 [background-image:radial-gradient(#ffffff18_1px,transparent_1px)] [background-size:18px_18px]">
        <div
          className="relative"
          style={{
            width: Math.min(3, project.services.length) * 310 + 24,
            height: Math.ceil(project.services.length / 3) * 205 + 24,
          }}
        >
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <marker
                id={`arrow-${project.name.replace(/[^a-z0-9]/gi, "")}`}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8" fill="#4fb8b2" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const a = positions.get(edge.from)!;
              const b = positions.get(edge.to)!;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M${a.x + 140},${a.y + 150} C${a.x + 140},${a.y + 190} ${b.x + 140},${b.y - 20} ${b.x + 140},${b.y}`}
                  fill="none"
                  stroke="#4fb8b2"
                  strokeWidth="1.5"
                  markerEnd={`url(#arrow-${project.name.replace(/[^a-z0-9]/gi, "")})`}
                />
              );
            })}
          </svg>
          {project.services.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              aria-pressed={selected === service.id}
              style={{
                left: positions.get(service.id)!.x,
                top: positions.get(service.id)!.y,
              }}
              className={`absolute w-[280px] border bg-zinc-950 p-4 text-left transition hover:border-zinc-500 ${selected === service.id ? "border-white" : "border-zinc-800"}`}
            >
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 ${service.health === "unhealthy" ? "bg-red-400" : service.state === "running" ? "bg-teal-400" : "bg-zinc-500"}`}
                />
                <span className="truncate">{service.service}</span>
              </div>
              <p className="mt-2 truncate font-mono text-[10px] text-zinc-500">
                {service.name}
              </p>
              <p className="mt-3 text-xs text-zinc-400">
                {service.state} ·{" "}
                {service.health === "none" ? "no health check" : service.health}
              </p>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-mono text-xs text-zinc-300">
                <span>CPU {percent(service.usage?.cpuPercent ?? null)}</span>
                <span>RAM {bytes(service.usage?.memoryBytes ?? null)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 border-t border-zinc-800 p-4 text-xs text-zinc-400">
        <p>
          <span className="text-teal-300">→ Declared dependencies</span> ·
          evidence: Compose depends_on label; declaration does not prove current
          traffic.
        </p>
        {edges.length ? (
          edges.map((e) => (
            <p key={`${e.from}-${e.to}`}>
              {project.services.find((s) => s.id === e.from)?.service} →{" "}
              {e.dependency}
            </p>
          ))
        ) : (
          <p>No explicit dependency evidence discovered.</p>
        )}
        <p className="border-t border-white/10 pt-3 text-zinc-300">
          Shared networks · observed membership only
        </p>
        {networks.map((network) => (
          <p key={network}>
            <span className="mr-2 border border-dashed border-zinc-700 px-2 py-1 font-mono">
              {network}
            </span>
            {project.services
              .filter((s) => s.topology?.networks.includes(network))
              .map((s) => s.service)
              .join(" · ")}
          </p>
        ))}
        {!networks.length && <p>Network membership unknown.</p>}
        <p>
          Network overlap never creates dependency arrows. Docker inspect is the
          source for networks and mounts. Route and volume details are available
          on each card.
        </p>
      </div>
    </div>
  );
}
