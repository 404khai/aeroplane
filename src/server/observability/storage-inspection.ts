import type { StorageInspection } from "../../shared/storage-inspection.js";
import { dockerRead } from "./docker-collector.js";

let cached: StorageInspection | undefined;
let inFlight: Promise<StorageInspection> | undefined;
export function inspectStorage(read = dockerRead) {
  if (cached && Date.now() - cached.sampledAt < 60_000)
    return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [summary, detail] = await Promise.all([
      read(["system", "df", "--format", "{{json .}}"]),
      read(["system", "df", "--verbose", "--format", "{{json .}}"]),
    ]);
    const rows = summary
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const verbose = JSON.parse(detail);
    cached = {
      sampledAt: Date.now(),
      summary: rows.map((row) => ({
        type: String(row.Type),
        total: String(row.TotalCount),
        active: String(row.Active),
        size: String(row.Size),
        reclaimable: String(row.Reclaimable),
      })),
      volumes: (verbose.Volumes ?? [])
        .slice(0, 1000)
        .map((v: Record<string, unknown>) => ({
          name: String(v.Name),
          driver: String(v.Driver),
          size: v.Size == null ? null : String(v.Size),
          links: v.Links == null ? null : String(v.Links),
        })),
      images: (verbose.Images ?? [])
        .slice(0, 1000)
        .map((v: Record<string, unknown>) => ({
          id: String(v.ID),
          name: `${v.Repository}:${v.Tag}`,
          size: String(v.Size),
          containers: v.Containers == null ? null : String(v.Containers),
        })),
    };
    return cached;
  })().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}
