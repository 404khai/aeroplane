# Local review: first observability contribution

Implemented in the feature worktree based on parent `c130d697247fb13f3ca127ebd8150f33600315f9`.
No changes were made to the parent worktree, the VPS, deployment configuration,
remote branches or pull requests. All source changes remain available as a local diff.

## Contribution scope

Aeroplane already creates, deploys and manages its own recorded projects. The new
owner-only **VPS overview** at `/settings/vps-overview` discovers existing Docker
workloads independently and displays selected service health and resource data.
External Compose projects, standalone containers, managed projects and
infrastructure have distinct groups. The overview has no workload mutation
controls and writes no discovered workloads to Aeroplane's database.

The backend is split into focused modules under `src/server/observability`;
shared response types live in `src/shared/observability.ts`. UI panels live under
`src/client/features/observability` with a separate page component. The existing
server entry point only registers the new sampler and route.

## Verification performed locally

- `npm ci --no-audit --no-fund`: succeeded using the supplied setup lockfile.
- `npm run test:observability`: 17 tests passed, covering grouping, selected field
  parsing, stopped containers, CLI read operations, partial failures, discovery
  limits, CPU/network/memory math, retention, mount checks, shared sampling,
  daemon outage, and actual owner/member/API-key authorization with temporary SQLite.
- `npm run typecheck`: both client/shared and server checks passed.
- `npm run build`: client bundle and server compilation passed. Vite emitted a
  warning for a JavaScript chunk over 500 kB; bundle splitting is outside this phase.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities reported.
- `git diff --check`: passed.
- Browser verification used the production bundle and actual authorization route
  with synthetic collectors in a temporary local fixture server. Checked populated
  health groups, charts, stopped services, empty discovery, missing Docker/host
  capabilities, generic error/retry recovery, and member denial (HTTP 403 and no
  overview navigation link). Checked desktop and mobile layout; no page-wide
  horizontal overflow was observed. Service tables scroll within their panels.
- Explicit native-host collector on this macOS machine returned CPU, RAM, root disk
  and uptime. Linux proc network collection correctly reported unavailable.

## Verification limits

The local Docker daemon was unavailable, so no live Docker containers were
inspected. Selected CLI output is tested using synthetic responses, but Linux
host bind mounts, Docker Engine integration and production workload behavior need
an operator-reviewed follow-up environment check. No VPS connection was used.

Host metrics are opt-in. Docker installations require the documented read-only
host mounts; native mode is only for a process directly on the actual host.
Missing or writable mount targets are rejected. Do not infer full VPS visibility
from container CPU/RAM. Root disk capacity covers one filesystem, network filtering
has interface-layout limitations, and history is limited to one hour/240 samples
in memory. Container stats are current snapshots. See
[configuration and limitations](read-only-observability.md).

## Keep setup changes separate during upstream review

The supplied `/tmp/aeroplane-setup-fixes.patch` was inspected and applied unchanged:

- `package-lock.json`: dependency/security updates from setup; no new observability
  dependency was added. The only feature change to `package.json` adds the focused
  test script.
- `src/client/components/modals/ai-provider-form.tsx`: replaces the missing provider
  logo-frame property with the existing neutral frame styles.
- `src/client/features/services/function-source-panel.tsx`: updates source/draft
  inside the successful async action, resolving the existing TypeScript narrowing
  issue around callback-assigned state.

Review those three setup files separately, ideally as a prerequisite contribution.
The main contribution can then consist of discovery, capability-aware metrics,
owner-only API/UI, tests and documentation. Keep deployment-specific overrides
local. Topology, unified logs, domains/certificates, alerts, expanded storage,
persistent metrics and workload adoption remain separate contributions.
