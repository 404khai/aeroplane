import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { containerNameForService } from "../deploy.js";
import { projectGroups, services } from "../schema.js";
import type { ManagedContainer } from "./docker-discovery.js";

export function getManagedContainers(): ManagedContainer[] {
  return db
    .select({
      serviceId: services.id,
      projectId: projectGroups.id,
      projectName: projectGroups.name,
    })
    .from(services)
    .innerJoin(projectGroups, eq(services.projectId, projectGroups.id))
    .all()
    .map((row) => ({
      name: containerNameForService(row.serviceId),
      projectId: row.projectId,
      projectName: row.projectName,
    }));
}
