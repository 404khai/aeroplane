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
  const { requireAuth, createUser, createSession } = await import(
    "../src/server/auth.js"
  );
  const { registerObservabilityRoutes } = await import(
    "../src/server/observability/observability-routes.js"
  );
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
    assert.equal((await app.request("/api/system/observability")).status, 401);
    assert.equal(
      (
        await app.request("/api/system/observability", {
          headers: { cookie: await cookie("/member") },
        })
      ).status,
      403,
    );
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
    assert.equal(calls, 0);
    const headers = { cookie: await cookie("/owner") };
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
