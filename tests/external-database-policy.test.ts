import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRowsQuery,
  sensitiveColumn,
} from "../src/server/external-databases/query-policy.js";
const columns = [
  {
    name: 'id"quote',
    type: "integer",
    nullable: false,
    primaryKey: true,
    masked: false,
  },
  {
    name: "password",
    type: "text",
    nullable: true,
    primaryKey: false,
    masked: true,
  },
];
const defaults = {
  limit: 50,
  offset: 0,
  search: "",
  sort: "",
  descending: false,
  filterColumn: "",
  filterValue: "",
};
test("SQL quotes identifiers, binds search/filter/page and never selects sensitive columns", () => {
  const query = buildRowsQuery('public"schema', "Account", columns, {
    ...defaults,
    search: "';DROP TABLE users;--",
    filterColumn: 'id"quote',
    filterValue: "123",
  });
  assert.match(query.text, /"public""schema"\."Account"/);
  assert.doesNotMatch(query.text, /password|DROP TABLE/);
  assert.match(query.text, /ORDER BY data\."id""quote" ASC/);
  assert.deepEqual(query.values, ["';DROP TABLE users;--", "123", 51, 0]);
});
test("pagination and filter validation reject SQL injection and unbounded reads", () => {
  for (const limit of [0, 101, Infinity, 1.1])
    assert.throws(() =>
      buildRowsQuery("public", "Account", columns, { ...defaults, limit }),
    );
  for (const offset of [-1, 100001, NaN])
    assert.throws(() =>
      buildRowsQuery("public", "Account", columns, { ...defaults, offset }),
    );
  assert.throws(() =>
    buildRowsQuery("public", "Account", columns, {
      ...defaults,
      filterColumn: "password",
      filterValue: "test",
    }),
  );
  for (const name of [
    "passwordHash",
    "refresh_token",
    "api_key",
    "sessionId",
    "mfaSecret",
    "cookie",
    "credentials",
  ])
    assert.ok(sensitiveColumn.test(name));
});
