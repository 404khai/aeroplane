import { bodyLimit } from "hono/body-limit";
import { declareRoute, removeRoute } from "./route-declarations.js";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireOwnerSessionAccess } from "../api-access-control.js";
import type { createObservabilitySampler } from "./observability-sampler.js";
import { readServiceLogs } from "./service-logs.js";
import { inspectStorage } from "./storage-inspection.js";
import { inspectCertificate } from "./certificates.js";

export function registerDrilldownRoutes(
  app: Hono,
  sampler: ReturnType<typeof createObservabilitySampler>,
) {
  let streams = 0;
  app.use("/api/system/inspection/*", async (c, next) => {
    const denied = requireOwnerSessionAccess(c);
    if (denied) return denied;
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.use("/api/system/inspection/*", bodyLimit({ maxSize: 2048 }));
  app.get("/api/system/inspection/services/:id", async (c) => {
    const snapshot = await sampler.getSnapshot();
    const service = snapshot.projects
      .flatMap((p) => p.services)
      .find((s) => s.id === c.req.param("id"));
    if (!service) return c.json({ error: "Service not found" }, 404);
    return c.json({
      service,
      history: sampler.serviceHistory(service.id),
      retentionMs: snapshot.retentionMs,
      persistence: "memory; cleared on server restart",
    });
  });
  app.get("/api/system/inspection/services/:id/logs", async (c) => {
    const id = c.req.param("id");
    const snapshot = await sampler.getSnapshot();
    if (!snapshot.projects.some((p) => p.services.some((s) => s.id === id)))
      return c.json({ error: "Service not found" }, 404);
    if (streams >= 8)
      return c.json({ error: "Log stream capacity reached" }, 429);
    streams++;
    return streamSSE(c, async (stream) => {
      const controller = new AbortController();
      stream.onAbort(() => controller.abort());
      const started = Date.now();
      try {
        while (!stream.aborted && Date.now() - started < 300_000) {
          try {
            await stream.writeSSE({
              event: "logs",
              data: JSON.stringify({
                text: await readServiceLogs(id, controller.signal),
                sampledAt: Date.now(),
              }),
            });
          } catch {
            await stream.writeSSE({
              event: "unavailable",
              data: "Logs unavailable; retrying",
            });
          }
          await stream.sleep(3000);
        }
      } finally {
        controller.abort();
        streams--;
      }
    });
  });
  app.get("/api/system/inspection/alerts", async (c) => {
    await sampler.getSnapshot();
    return c.json({
      incidents: sampler.incidents(),
      delivery: "in-app only",
      persistence: "memory; up to 200 incidents; cleared on restart",
      sustainedMs: 60_000,
    });
  });
  app.post("/api/system/inspection/alerts/:id/acknowledge", (c) =>
    c.json({ acknowledged: sampler.acknowledge(c.req.param("id")) }),
  );
  app.get("/api/system/inspection/storage", async (c) => {
    try {
      return c.json(await inspectStorage());
    } catch {
      return c.json({ error: "Docker storage inspection unavailable" }, 503);
    }
  });
  app.post("/api/system/inspection/services/:id/routes", async (c) => {
    const serviceId = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const hostname =
      typeof body?.hostname === "string"
        ? body.hostname.toLowerCase().trim()
        : "";
    if (
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        hostname,
      )
    )
      return c.json({ error: "Invalid domain" }, 400);
    if (
      !(await sampler.getSnapshot()).projects.some((p) =>
        p.services.some((s) => s.id === serviceId),
      )
    )
      return c.json({ error: "Service not found" }, 404);
    if (body.remove === true) removeRoute(serviceId, hostname);
    else declareRoute(serviceId, hostname);
    return c.json({
      saved: true,
      message:
        "Applies at the next 15-second sample; proxy configuration is unchanged",
    });
  });
  app.get("/api/system/inspection/certificate", async (c) => {
    const hostname = c.req.query("hostname") ?? "";
    const snapshot = await sampler.getSnapshot();
    if (
      !snapshot.projects.some((p) =>
        p.services.some((s) =>
          s.topology?.domains.some((d) => d.hostname === hostname),
        ),
      )
    )
      return c.json({ error: "Unknown route" }, 404);
    return c.json(await inspectCertificate(hostname));
  });
}
