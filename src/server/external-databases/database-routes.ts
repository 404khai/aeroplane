import { bodyLimit } from "hono/body-limit";
import { Hono } from "hono";
import { z } from "zod";
import { requireOwnerSessionAccess } from "../api-access-control.js";
import { hasSecretKey } from "../secret-crypto.js";
import {
  registrations,
  saveRegistration,
  connectionFor,
  removeRegistration,
} from "./registration-store.js";
import {
  withReadOnlyDatabase,
  listTables,
  browseRows,
} from "./postgres-browser.js";
import type { ObservabilitySnapshot } from "../../shared/observability.js";

const registration = z.object({
  name: z.string().trim().min(1).max(100),
  serviceId: z.string().regex(/^[a-f0-9]{12,64}$/),
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9_.:-]+$/),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1).max(128),
  user: z.string().min(1).max(128),
  password: z.string().min(1).max(4096),
  tls: z.boolean(),
});
export function registerExternalDatabaseRoutes(
  app: Hono,
  snapshot: () => Promise<ObservabilitySnapshot>,
) {
  const routes = new Hono();
  // A subrouter owns its error handler so driver/JSON exceptions never reach the
  // application's default logger (which could include connection diagnostics).
  routes.onError((_error, c) =>
    c.json(
      {
        error:
          "Database access failed. Check connectivity, the restricted reader account, TLS and encryption key.",
      },
      400,
    ),
  );
  routes.use("*", async (c, next) => {
    const denied = requireOwnerSessionAccess(c);
    if (denied) return denied;
    c.header("Cache-Control", "no-store");
    await next();
  });
  routes.use("*", bodyLimit({ maxSize: 16_384 }));
  routes.get("/", (c) => c.json({ connections: registrations() }));
  routes.post("/", async (c) => {
    if (!hasSecretKey())
      return c.json(
        {
          error:
            "Configure AEROPLANE_SECRET_KEY before registering credentials",
        },
        409,
      );
    const body = await c.req.text();
    if (body.length > 12_000)
      return c.json({ error: "Registration too large" }, 413);
    const parsed = registration.safeParse(JSON.parse(body));
    if (!parsed.success)
      return c.json({ error: "Invalid connection fields" }, 400);
    const { name, serviceId, ...connection } = parsed.data;
    if (
      !(await snapshot()).projects.some((p) =>
        p.services.some((s) => s.id === serviceId),
      )
    )
      return c.json({ error: "Service unavailable" }, 404);
    await withReadOnlyDatabase(connection, listTables);
    return c.json({ id: saveRegistration(name, serviceId, connection) }, 201);
  });
  routes.delete("/:id", (c) => {
    removeRegistration(c.req.param("id"));
    return c.json({ removed: true });
  });
  routes.get("/:id/tables", async (c) =>
    c.json({
      tables: await withReadOnlyDatabase(
        connectionFor(c.req.param("id")),
        listTables,
      ),
    }),
  );
  routes.post("/:id/rows", async (c) => {
    const query = z
      .record(z.string(), z.string().max(2048))
      .parse(await c.req.json());
    const result = await withReadOnlyDatabase(
      connectionFor(c.req.param("id")),
      (client) =>
        browseRows(
          client,
          (query.schema ?? "").slice(0, 128),
          (query.table ?? "").slice(0, 128),
          {
            offset: Number(query.offset ?? 0),
            limit: Number(query.limit ?? 50),
            search: query.search ?? "",
            sort: query.sort ?? "",
            descending: query.descending === "true",
            filterColumn: query.filterColumn ?? "",
            filterValue: query.filterValue ?? "",
          },
        ),
    );
    return c.json(result);
  });
  app.route("/api/system/external-databases", routes);
}
