import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";

test("observability requires an owner browser session before collecting data", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "aeroplane-observability-test-"),
  );
  process.env.DATA_DIR = directory;
  const { requireAuth, createUser, createSession } =
    await import("../src/server/auth.js");
  const { registerObservabilityRoutes } =
    await import("../src/server/observability/observability-routes.js");
  const { createApiKey } = await import("../src/server/api-keys.js");
  const { sqlite } = await import("../src/server/db.js");
  try {
    const owner = createUser({
      name: "Test Owner",
      email: "owner@example.test",
      password: "test-only-password",
      role: "owner",
    });
    const member = createUser({
      name: "Test Member",
      email: "member@example.test",
      password: "test-only-password",
      role: "user",
    });
    const sessions = new Hono();
    sessions.get("/owner", (c) => {
      createSession(c, owner);
      return c.text("ok");
    });
    sessions.get("/member", (c) => {
      createSession(c, member);
      return c.text("ok");
    });
    const cookie = async (path: string) =>
      (await sessions.request(path)).headers.get("set-cookie")!.split(";")[0];
    let calls = 0;
    let fail = false;
    const app = new Hono();
    app.use("/api/*", requireAuth);
    registerObservabilityRoutes(app, async () => {
      calls++;
      if (fail) throw new Error("sensitive backend error");
      return { sampledAt: 123, projects: [] } as never;
    });
    const { registerDrilldownRoutes } =
      await import("../src/server/observability/drilldown-routes.js");
    const { registerExternalDatabaseRoutes } =
      await import("../src/server/external-databases/database-routes.js");
    const sample = async () =>
      ({
        sampledAt: 123,
        projects: [{ services: [{ id: "a".repeat(64) }] }],
      }) as never;
    registerDrilldownRoutes(app, {
      getSnapshot: sample,
      incidents: () => [],
      acknowledge: () => false,
    } as never);
    registerExternalDatabaseRoutes(app, sample);
    assert.equal((await app.request("/api/system/observability")).status, 401);
    assert.equal(
      (
        await app.request("/api/system/observability", {
          headers: { cookie: await cookie("/member") },
        })
      ).status,
      403,
    );

    for (const path of [
      "/api/system/inspection/alerts",
      "/api/system/inspection/storage",
      "/api/system/inspection/services/abc/logs",
      "/api/system/inspection/certificate?hostname=example.test",
      "/api/system/external-databases",
      "/api/system/external-databases/abc/tables",
      "/api/system/external-databases/abc/rows",
    ]) {
      assert.equal((await app.request(path)).status, 401, path);
      assert.equal(
        (
          await app.request(path, {
            headers: { cookie: await cookie("/member") },
          })
        ).status,
        403,
        path,
      );
    }
    const key = createApiKey(
      {
        name: "Test key",
        accessLevel: "read",
        projectScope: "all",
        projectIds: [],
        expiresInDays: null,
      },
      owner.id,
    );
    assert.equal(
      (
        await app.request("/api/system/observability", {
          headers: { authorization: `Bearer ${key.token}` },
        })
      ).status,
      403,
    );
    for (const path of [
      "/api/system/inspection/alerts",
      "/api/system/external-databases",
    ]) {
      assert.equal(
        (
          await app.request(path, {
            headers: { authorization: `Bearer ${key.token}` },
          })
        ).status,
        403,
      );
    }
    assert.equal(calls, 0);
    const headers = { cookie: await cookie("/owner") };
    assert.equal(
      (await app.request("/api/system/external-databases", { headers })).status,
      200,
    );
    assert.equal(
      (await app.request("/api/system/inspection/alerts", { headers })).status,
      200,
    );
    assert.equal(
      (
        await app.request(
          "/api/system/inspection/services/not-a-container/logs",
          { headers },
        )
      ).status,
      404,
    );
    process.env.AEROPLANE_SECRET_KEY = "local-test-key";
    const openStreams = [];
    for (let index = 0; index < 8; index++) {
      const response = await app.request(
        `/api/system/inspection/services/${"a".repeat(64)}/logs`,
        { headers },
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type")!, /text\/event-stream/);
      openStreams.push(response);
    }
    const limitedStream = await app.request(
      `/api/system/inspection/services/${"a".repeat(64)}/logs`,
      { headers },
    );
    assert.equal(limitedStream.status, 429);
    await Promise.all(openStreams.map((response) => response.body?.cancel()));
    const invalidRegistration = await app.request(
      "/api/system/external-databases",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: '{"password":"never-log-me" invalid json',
      },
    );
    assert.equal(invalidRegistration.status, 400);
    assert.doesNotMatch(
      await invalidRegistration.text(),
      /never-log-me|SyntaxError/,
    );
    const missingDatabase = await app.request(
      "/api/system/external-databases/absent/rows",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ schema: "public", table: "sample" }),
      },
    );
    assert.equal(missingDatabase.status, 400);
    assert.equal(missingDatabase.headers.get("cache-control"), "no-store");
    const allowed = await app.request("/api/system/observability", { headers });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    assert.equal(calls, 1);
    assert.deepEqual(await allowed.json(), { sampledAt: 123, projects: [] });
    fail = true;
    const unavailable = await app.request("/api/system/observability", {
      headers,
    });
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(await unavailable.text(), /sensitive/);
    assert.equal(
      (
        await app.request("/api/system/observability", {
          method: "POST",
          headers,
        })
      ).status,
      404,
    );
  } finally {
    sqlite.close();
    await rm(directory, { recursive: true, force: true });
  }
});
