import type { Hono } from "hono";
import type { ObservabilitySnapshot } from "../../shared/observability.js";
import { requireOwnerSessionAccess } from "../api-access-control.js";

export function registerObservabilityRoutes(
  app: Hono,
  getSnapshot: () => Promise<ObservabilitySnapshot>,
) {
  app.get("/api/system/observability", async (c) => {
    const denied = requireOwnerSessionAccess(c);
    if (denied) return denied;
    c.header("Cache-Control", "no-store");
    try {
      return c.json(await getSnapshot());
    } catch {
      return c.json({ error: "Observability is temporarily unavailable" }, 503);
    }
  });
}
