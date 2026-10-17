import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { containerNameForService } from "../deploy.js";
import { domains, projectGroups, services } from "../schema.js";
import type { ManagedContainer } from "./docker-discovery.js";

export function getManagedContainers(): ManagedContainer[] {
  return db
    .select({
      serviceId: services.id,
      projectId: projectGroups.id,
      projectName: projectGroups.name,
      projectSlug: projectGroups.slug,
    })
    .from(services)
    .innerJoin(projectGroups, eq(services.projectId, projectGroups.id))
    .all()
    .map((row) => ({
      domains: db
        .select()
        .from(domains)
        .where(eq(domains.serviceId, row.serviceId))
        .all()
        .map((d) => d.hostname),
      name: containerNameForService(row.serviceId),
      projectId: row.projectId,
      projectName: row.projectName,
      projectSlug: row.projectSlug,
    }));
}
