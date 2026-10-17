import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("registered credentials are encrypted at rest, public listing omits credentials, and removal deletes the secret", async () => {
  const dir = await mkdtemp(join(tmpdir(), "canvas-secrets-"));
  process.env.DATA_DIR = dir;
  process.env.AEROPLANE_SECRET_KEY = "local-test-key-only";
  const { saveRegistration, registrations, connectionFor, removeRegistration } =
    await import("../src/server/external-databases/registration-store.js");
  const { sqlite } = await import("../src/server/db.js");
  try {
    const config = {
      host: "db",
      port: 5432,
      database: "sample",
      user: "reader",
      password: "never-print-this",
      tls: false,
    };
    const id = saveRegistration("Sample database", "a".repeat(64), config);
    const stored = sqlite
      .prepare("SELECT * FROM external_database_connections")
      .get();
    assert.doesNotMatch(
      JSON.stringify(stored),
      /never-print-this|"host"|"user"/,
    );
    assert.doesNotMatch(
      JSON.stringify(registrations()),
      /password|reader|never-print-this|encrypted_config/,
    );
    assert.deepEqual(connectionFor(id), config);
    process.env.AEROPLANE_SECRET_KEY = "wrong-test-key";
    assert.throws(() => connectionFor(id));
    process.env.AEROPLANE_SECRET_KEY = "local-test-key-only";
    removeRegistration(id);
    assert.deepEqual(registrations(), []);
    assert.throws(() => connectionFor(id));
  } finally {
    sqlite.close();
    await rm(dir, { recursive: true, force: true });
  }
});
