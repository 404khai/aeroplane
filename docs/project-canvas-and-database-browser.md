# Project canvas and external service inspection

The owner-only VPS overview now shows both discovered Docker Compose workloads and Aeroplane-managed containers on a project canvas. Selecting a card opens resource history, live log snapshots, network/route evidence, mount/image details, and registered PostgreSQL connections. Managed groups link back to their existing project page. Existing project and service management permissions are unchanged.

## Evidence and discovery

Only selected Docker fields are collected, up to 500 containers. No environment variables, health log bodies, arbitrary labels, container commands, bind source paths, or full inspect responses are exposed. Solid directed lines mean a `com.docker.compose.depends_on` declaration, not verified traffic. Shared networks have a separate, explicitly non-directional membership list. Missing inspect data is unknown. Replicas and unresolved dependency names remain visible in the detail panel; discovery does not infer dependencies from overlap.

Routes come from Aeroplane's domain records or the hostname-only `caddy` container label. Other private proxy files/configurations are not inspected. Owners can record an existing hostname as metadata; it is labelled owner-declared, never independently verified, and changes no proxy/workload configuration. Declarations appear on the next sampler refresh and can be removed. These associations and database registrations currently use container IDs: after container replacement, register the new container's connection/route association again.

TLS inspection connects to the declared hostname on port 443 with SNI and trust verification. Results include expiry/issuer and warn below 30 days, cached for five minutes. Unreachable, invalid, expired or private-CA handshakes may report unknown. It does not inspect private keys or provision/renew certificates.

## Logs, history and alerts

An authenticated owner browser session is required for every inspection route; API keys and members cannot access them. SSE delivers replacement log snapshots every three seconds: Docker's last 300 lines within 30 minutes, additionally capped at 128 KiB. Browser state replaces each snapshot rather than appending. Streams close after five minutes and EventSource reconnects through authentication. Unmount/pause closes the connection. At most eight concurrent streams run per server; subprocesses time out after seven seconds. Search and severity text filters operate on this bounded tail. Common credential patterns are redacted, but application logs can contain other sensitive information: owner access remains essential. There is no arbitrary command endpoint.

The existing shared lazy sampler records current resources and up to 240 samples / one hour per container in memory, at 15-second intervals. Up to 500 container histories are retained; disappeared containers age out. Server restarts clear history. Unknown resource readings are gaps, not zero usage.

Alerts use sustained 60-second conditions: container CPU >=90% of one logical core, RAM >=90% of Docker's reported memory limit, Docker unhealthy status, and host RAM/disk >=90% when host collectors are available. CPU can exceed 100% across cores; an unconstrained container's Docker RAM limit may represent host RAM. Restart counter increments alert immediately. There is no baseline incident for historical restart counts or expected stopped one-shot jobs. Incidents support acknowledgements and recovery; missing measurements do not prove recovery. Delivery is **in-app only**, with at most 200 incidents in memory, cleared on restart. Sampling/alert evaluation starts on first owner access after server startup; this is not a persistent background notification service.

Storage uses `docker system df` summary and verbose accounting, cached for one minute. It displays volumes, image sizes, references, reclaimable estimates and project associations from observed mounts/images. Bind usage and unresolvable associations stay unknown. Shared image layer sizes are not additive. No pruning/deletion endpoint is added.

## Existing PostgreSQL connections

Open a service's Database tab and register a reachable PostgreSQL endpoint using an **existing restricted reader account**. This stores only a connection; it does not migrate, adopt, redeploy, attach networks, expose ports or create database roles. Do not provide the application's privileged credentials. A reader should have only CONNECT, required schema USAGE and SELECT on the intended tables (and appropriate row-level policies). Superuser, CREATEDB, CREATEROLE, replication and BYPASSRLS roles are rejected. Use TLS verification for remote connections; disabling TLS is an explicit choice for trusted private networks. Aeroplane must already be able to reach that endpoint. Container DNS works only on an existing shared network.

Credentials are AES-256-GCM encrypted in Aeroplane's SQLite database using the existing `AEROPLANE_SECRET_KEY` facility. Registration fails without the key. Keep the key with your backups; changing/loss of the key requires re-registration. Public connection lists contain no host, username, password or encrypted blob. Connection removal deletes only the saved registration and encrypted credentials.

The browser shows actual readable base tables grouped by schema, column types/nullability/primary keys, foreign-key constraints, 50-row pages, visible-column search, exact text filters and native-type sorting. Single-column FK navigation filters the target table using the selected row. Composite FK metadata is displayed but row navigation is disabled; select the target table and inspect the complete key. Views/foreign tables are excluded. Catalog listing is capped at 1,000 tables and 256 columns/foreign-key fields; pagination is limited to offset 100,000. Concurrent writes can shift offset pages, especially for tables without a unique key.

All queries are predefined server queries or quoted-identifier/parameterized row queries inside READ ONLY transactions, with connection/query/lock timeouts and a four-connection concurrency cap. No arbitrary SQL, mutations or reveal endpoint exists. Sensitive-name columns (passwords, keys, tokens, credentials, sessions, hashes, etc.) and JSON/arrays/binary fields are omitted **before querying rows**, and cannot be searched or filtered. Other cells are truncated server-side to 2,048 characters. Name-based masking cannot detect a secret stored in an innocently named text column; restrict the reader's table grants accordingly. This is PostgreSQL-only; managed viewers for other engines are unchanged.

## Local verification

Run `npm run typecheck`, `npm run build`, and `npm run test:observability` (includes external database policy/encryption tests). To exercise the real PostgreSQL integration test, start a disposable local PostgreSQL instance and use:

```sh
TEST_POSTGRES_URL=postgresql://local_admin@127.0.0.1:55439/postgres npm run test:observability
```

The integration test creates and removes its own `canvas_test` schema and `canvas_reader` role; never point it at a user workload. Local UI verification can use synthetic Docker data and a disposable PostgreSQL database. These checks do not establish connectivity to any production database. No deployment is part of this contribution.
