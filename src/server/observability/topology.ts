import type { ServiceTopology } from "../../shared/observability.js";

// Select individual fields; never return environment, arbitrary labels, bind sources or inspect payloads.
export const topologyFormat =
  '{"id":{{json .Id}},"image":{{json .Config.Image}},"networks":[{{range $i,$v := .NetworkSettings.Networks}}{{json $i}},{{end}}null],"mounts":[{{range .Mounts}}{"name":{{json (index . "Name")}},"destination":{{json .Destination}},"type":{{json .Type}},"writable":{{json .RW}}},{{end}}null],"depends":{{json (index .Config.Labels "com.docker.compose.depends_on")}},"host":{{json (index .Config.Labels "caddy")}}}';

export function parseTopology(output: string): Map<string, ServiceTopology> {
  const result = new Map<string, ServiceTopology>();
  for (const line of output.trim().split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    if (!/^[a-f0-9]{12,64}$/.test(row.id)) continue;
    const domains = String(row.host ?? "")
      .split(/[ ,]+/)
      .map((host) => host.replace(/^https?:\/\//, ""))
      .filter((host) =>
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
          host,
        ),
      )
      .map((hostname) => ({
        hostname,
        source: "caddy container label · declared route",
      }));
    result.set(row.id, {
      networks: row.networks
        .filter((value: unknown) => typeof value === "string")
        .slice(0, 64),
      dependencies: String(row.depends ?? "")
        .split(",")
        .map((v) => v.split(":")[0])
        .filter(Boolean)
        .slice(0, 64),
      domains,
      mounts: row.mounts
        .filter(Boolean)
        .slice(0, 100)
        .map((mount: ServiceTopology["mounts"][number]) => ({
          name: mount.name || "bind mount",
          destination: mount.destination,
          type: mount.type,
          writable: mount.writable,
        })),
      image: row.image,
    });
  }
  return result;
}
