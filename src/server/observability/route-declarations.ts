import { sqlite } from "../db.js";
sqlite.exec(
  `CREATE TABLE IF NOT EXISTS observed_route_declarations (service_id TEXT NOT NULL, hostname TEXT NOT NULL, PRIMARY KEY(service_id,hostname))`,
);
export function routeDeclarations() {
  return sqlite
    .prepare(
      "SELECT service_id AS serviceId, hostname FROM observed_route_declarations LIMIT 500",
    )
    .all() as { serviceId: string; hostname: string }[];
}
export function declareRoute(serviceId: string, hostname: string) {
  if (routeDeclarations().length >= 500) throw new Error("Route limit reached");
  sqlite
    .prepare("INSERT OR IGNORE INTO observed_route_declarations VALUES (?, ?)")
    .run(serviceId, hostname);
}
export function removeRoute(serviceId: string, hostname: string) {
  sqlite
    .prepare(
      "DELETE FROM observed_route_declarations WHERE service_id = ? AND hostname = ?",
    )
    .run(serviceId, hostname);
}
