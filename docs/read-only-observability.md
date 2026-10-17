# Read-only VPS observability

Open **VPS overview** from the workspace navigation (including the mobile header).
Only an authenticated owner browser session can access the page or
`GET /api/system/observability`. Members and API keys cannot view machine-wide
workload information. Responses are not cached.

Aeroplane's Projects page still lists applications it creates and manages. The
new overview automatically discovers existing Docker containers without adding
projects, changing routes, importing variables, adopting workloads, or issuing
lifecycle commands. It does not migrate existing services. There are no restart,
redeploy or delete controls in this view.

## Discovery and health

- Compose project/service labels group containers, including stopped containers
  and replicas. Unlabelled workloads appear under Standalone containers.
- Containers whose exact runtime names match database service records appear
  under Aeroplane-managed projects. Name prefixes alone never establish ownership.
- `aeroplane`, `deploy-caddy`, and `deploy-buildkit` are recognized as infrastructure.
  Custom infrastructure names can use `io.aeroplane.role=infrastructure` in their
  existing configuration. Discovery itself never changes labels. Other sidecars
  remain external unless explicitly marked.
- State, health-check status, restart count and current running uptime come from
  selected inspect fields. No check means **Not configured**, not healthy.
  Missing detail means unknown, not zero restarts. Health-check output, environment
  variables, labels other than the selected grouping labels, mounts, command lines,
  image configuration and raw inspect objects are never returned or logged.
- CPU is Docker's container CPU percentage (100% per logical CPU; may exceed
  100%). RAM is Docker CLI memory usage, which excludes cache where Docker supports
  it, with its reported limit. These are not host measurements. A limit equal to
  host RAM does not imply an explicit per-container memory limit.

The collector uses the installed Docker CLI and its configured daemon/context.
The host collector measures the machine running Aeroplane. Use a local Docker
socket for a single-VPS overview; a remote Docker context will show remote
containers alongside the Aeroplane machine's explicitly configured host metrics.
Docker Desktop containers belong to its Linux VM, not the desktop host.

## Opt-in host measurements

Upstream deployment defaults are unchanged. Host measurements are **Unavailable**
until the operator explicitly configures a collector. The page explains missing
capabilities and continues showing discovered services if Docker works.

For Aeroplane running in Docker on Linux, set `AEROPLANE_HOST_METRICS=mounts` on the
Aeroplane service and optionally bind-mount the following paths read-only:

```yaml
services:
  aeroplane:
    environment:
      AEROPLANE_HOST_METRICS: mounts
    volumes:
      - type: bind
        source: /proc
        target: /host/proc
        read_only: true
        bind:
          create_host_path: false
      - type: bind
        source: /
        target: /host/root
        read_only: true
        bind:
          create_host_path: false
```

This is an optional configuration example, not an applied deployment change.
`/host/proc` supplies host CPU counters, available/total RAM, uptime and host PID
1's network counters. Reading PID 1's network namespace works independently of
Aeroplane's own network mode when permitted. Kernel security policies or rootless
Docker may deny it; network metrics then remain unavailable. The collector checks
that these targets are read-only mount points. It cannot verify that an operator
mounted the intended host paths: use the exact source paths above.

`/host/root` is only used for filesystem capacity via `statfs`, not file traversal.
It exposes host files to the Aeroplane process, so omit this mount if that access
is unsuitable; CPU, RAM, uptime and network can still work with disk unavailable.
No privileged mode, host PID namespace or extra Linux capabilities are required.
Read-only bind mounts are not a substitute for deployment isolation: Docker socket
access already carries daemon privileges, and a socket mounted `:ro` does not make
Docker API operations read-only. This feature only issues read commands and does
not add new socket access.

For a process running directly on the actual host, set
`AEROPLANE_HOST_METRICS=native`. Do not select native mode inside Docker: it asserts
that the process is on the host. Linux reads `/proc`; other platforms use OS CPU,
RAM and uptime APIs and root filesystem capacity where supported, with network
rates unavailable if Linux proc counters are absent. No process-scoped fallback is
silently presented as host data.

Host CPU is normalized to 0–100% across all logical CPUs. Linux used RAM is
`MemTotal - MemAvailable`. Disk shows only root filesystem used/total capacity
(including filesystem-reserved space in total), not volumes or every disk.
Network rates aggregate non-loopback interfaces, excluding Docker bridges, veth
and common virtual bridges. Unusual VPN/bond/interface layouts may still count
traffic more than once. Rates require two samples and become unavailable after
counter resets or collection failures.

## Sampling and operational limits

One shared collector starts lazily after the first authorized overview request.
It samples again 15 seconds after each completed collection, independently of
browser count. Browser refreshes every 15 seconds while visible. Only one sample
can run at a time. CLI calls have an 8-second timeout and 4 MiB output limit;
discovery displays at most 500 containers and reports that limit. There are at most
three Docker commands per sample (list, selected inspect, one-shot stats).
Disappearing containers and unavailable stats degrade to per-service unknowns.
A daemon outage does not suppress available host measurements.

Host history stores at most 240 samples and at most one hour in process memory.
CPU/RAM history is charted; disk, uptime and network rates are retained in the same
bounded samples available from the endpoint. First rate samples are unavailable.
History resets on Aeroplane restart; container resource stats are current snapshots
only. Failed refreshes keep the last successful UI result with an error and sample
time. Backend failures return generic capability messages, never raw command errors.

## Local checks and contribution boundaries

```sh
npm ci
npm run test:observability
npm run typecheck
npm run build
```

Tests cover Compose grouping, infrastructure/managed distinctions, stopped and
missing containers, resource parsing, host counter math, bounded history,
read-only mount checks, and real session/API-key authorization against an isolated
temporary SQLite database. Tests do not contact a VPS or a Docker daemon.

This phase is a read-only observability contribution. Topology, unified logs,
domains/certificates, alerts, persistent metrics storage, expanded volume/storage
views and workload adoption are separate future work. Keep optional deployment
configuration separate from source changes. The inherited setup patch (lockfile
security updates and two existing UI TypeScript fixes) should also be reviewed
separately from this feature; no new dependency was added for observability.
