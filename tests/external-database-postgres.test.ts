import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {
  withReadOnlyDatabase,
  browseRows,
  listTables,
} from "../src/server/external-databases/postgres-browser.js";

// Optional integration test runs against a disposable local PostgreSQL, never a user workload.
test(
  "real PostgreSQL: reader restrictions, metadata, pagination, safe rows and foreign keys",
  { skip: !process.env.TEST_POSTGRES_URL },
  async () => {
    const admin = new pg.Client({
      connectionString: process.env.TEST_POSTGRES_URL,
    });
    await admin.connect();
    try {
      await admin.query(`CREATE ROLE canvas_reader LOGIN PASSWORD 'test-only';
      CREATE SCHEMA canvas_test; CREATE TABLE canvas_test.parents (id integer PRIMARY KEY);
      CREATE DOMAIN canvas_test.private_payload AS jsonb;
      CREATE TABLE canvas_test.accounts (id integer PRIMARY KEY, parent_id integer REFERENCES canvas_test.parents(id), name text, password_hash text, profile jsonb);
      INSERT INTO canvas_test.parents VALUES (1); INSERT INTO canvas_test.accounts SELECT n,1,'sample-'||n,'must-not-leak','{"token":"must-not-leak"}' FROM generate_series(1,120) n;
      GRANT USAGE ON SCHEMA canvas_test TO canvas_reader; GRANT SELECT ON ALL TABLES IN SCHEMA canvas_test TO canvas_reader;`);
      await admin.query(
        `ALTER TABLE canvas_test.accounts ADD COLUMN nested_data canvas_test.private_payload DEFAULT '{"token":"must-not-leak"}'; ALTER TABLE canvas_test.accounts ADD COLUMN uuid_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'`,
      );
      const url = new URL(process.env.TEST_POSTGRES_URL!);
      const config = {
        host: url.hostname,
        port: Number(url.port || 5432),
        database: url.pathname.slice(1),
        user: "canvas_reader",
        password: "test-only",
        tls: false,
      };
      await withReadOnlyDatabase(config, async (client) => {
        const tables = await listTables(client);
        assert.ok(tables.some((t) => t.name === "accounts"));
        const options = {
          offset: 50,
          limit: 50,
          search: "",
          sort: "id",
          descending: false,
          filterColumn: "",
          filterValue: "",
        };
        const result = await browseRows(
          client,
          "canvas_test",
          "accounts",
          options,
        );
        assert.equal(result.rows.length, 50);
        assert.equal(result.rows[0].id, "51");
        assert.equal(result.hasMore, true);
        assert.equal(
          result.columns.find((c) => c.name === "password_hash")?.masked,
          true,
        );
        assert.equal(
          result.columns.find((c) => c.name === "profile")?.masked,
          true,
        );
        assert.doesNotMatch(
          JSON.stringify(result.rows),
          /must-not-leak|password_hash|profile/,
        );
        assert.equal(
          result.columns.find((c) => c.name === "nested_data")?.masked,
          true,
        );
        assert.equal(
          result.columns.find((c) => c.name === "uuid_id")?.masked,
          false,
        );
        assert.equal(result.foreignKeys[0].table, "parents");
        const filtered = await browseRows(client, "canvas_test", "accounts", {
          ...options,
          offset: 0,
          filterColumn: "id",
          filterValue: "2",
        });
        assert.equal(filtered.rows.length, 1);
        assert.equal(filtered.rows[0].id, "2");
        const injection = await browseRows(client, "canvas_test", "accounts", {
          ...options,
          offset: 0,
          search: "'; DROP TABLE accounts;--",
        });
        assert.equal(injection.rows.length, 0);
        await assert.rejects(() =>
          browseRows(
            client,
            "canvas_test",
            "accounts;DROP TABLE parents",
            options,
          ),
        );
      });
      await assert.rejects(
        () =>
          withReadOnlyDatabase(config, (c) =>
            c.query("DELETE FROM canvas_test.accounts"),
          ),
        /read-only transaction|permission denied/,
      );
      await assert.rejects(
        () =>
          withReadOnlyDatabase(
            {
              ...config,
              user: url.username || process.env.USER!,
              password: "",
            },
            listTables,
          ),
        /restricted reader account/,
      );
    } finally {
      await admin.query(
        "DROP SCHEMA IF EXISTS canvas_test CASCADE; DROP ROLE IF EXISTS canvas_reader",
      );
      await admin.end();
    }
  },
);
