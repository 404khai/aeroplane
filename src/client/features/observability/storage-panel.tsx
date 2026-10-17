import { useEffect, useState } from "react";
import type {
  ObservedProject,
  ObservedService,
} from "../../../shared/observability";
import type { StorageInspection } from "../../../shared/storage-inspection";
import { inspection } from "./inspection-api";
export function StoragePanel({
  projects,
  service,
}: {
  projects?: ObservedProject[];
  service?: ObservedService;
}) {
  const [data, setData] = useState<StorageInspection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void inspection
      .storage()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setError("Detailed Docker storage unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const all =
    projects?.flatMap((p) =>
      p.services.map((s) => ({ project: p.name, service: s })),
    ) ?? (service ? [{ project: "Selected project", service }] : []);
  const mounts = service?.topology?.mounts;
  return (
    <section className="space-y-4 text-xs text-zinc-400">
      <p>
        Docker disk accounting · cached for one minute · read-only. Reclaimable
        is Docker’s estimate and does not imply deletion is safe. Shared image
        layers must not be summed. Bind-mount disk usage is unknown; host source
        paths are omitted.
      </p>
      {mounts && (
        <div className="space-y-2">
          {mounts.map((mount, i) => (
            <p key={i} className="border border-zinc-800 p-3">
              <span className="text-zinc-200">{mount.name}</span> →{" "}
              {mount.destination} · {mount.type} ·{" "}
              {mount.writable ? "read/write" : "read-only"} ·{" "}
              {data?.volumes.find((v) => v.name === mount.name)?.size ??
                "size unknown"}
            </p>
          ))}
          {!mounts.length && <p>No mounts reported.</p>}
        </div>
      )}
      {!service?.topology && service && <p>Mount inspection unknown.</p>}
      {error && (
        <p role="alert" className="text-amber-300">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.summary.map((row) => (
              <div key={row.type} className="border border-zinc-800 p-4">
                <p className="text-zinc-200">{row.type}</p>
                <p className="mt-2">
                  {row.size} · {row.total} total / {row.active} active
                </p>
                <p className="mt-2">Reclaimable {row.reclaimable}</p>
              </div>
            ))}
          </div>
          {!service && (
            <div className="max-h-72 overflow-auto border border-zinc-800">
              <table className="w-full text-left">
                <caption className="p-3 text-left text-zinc-200">
                  Volumes · association from observed mounts
                </caption>
                <thead>
                  <tr>
                    {[
                      "Volume",
                      "Size",
                      "References",
                      "Projects / services",
                    ].map((h) => (
                      <th className="p-3 font-normal" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.volumes.map((v) => (
                    <tr key={v.name} className="border-t border-zinc-800">
                      <td className="break-all p-3">
                        {v.name} · {v.driver}
                      </td>
                      <td className="p-3">{v.size ?? "unknown"}</td>
                      <td className="p-3">{v.links ?? "unknown"}</td>
                      <td className="p-3">
                        {all
                          .filter((row) =>
                            row.service.topology?.mounts.some(
                              (m) => m.name === v.name,
                            ),
                          )
                          .map((row) => `${row.project}/${row.service.service}`)
                          .join(", ") || "No observed association"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="max-h-64 overflow-auto border border-zinc-800">
            <table className="w-full text-left">
              <caption className="p-3 text-left text-zinc-200">
                {service ? "Service image" : "Images · observed usage"}
              </caption>
              <thead>
                <tr>
                  <th className="p-3 font-normal">Image</th>
                  <th className="p-3 font-normal">Size</th>
                  <th className="p-3 font-normal">Projects / services</th>
                </tr>
              </thead>
              <tbody>
                {data.images
                  .filter(
                    (image) =>
                      !service || image.name === service.topology?.image,
                  )
                  .map((image) => (
                    <tr
                      key={`${image.id}-${image.name}`}
                      className="border-t border-zinc-800"
                    >
                      <td className="break-all p-3">{image.name}</td>
                      <td className="p-3">{image.size}</td>
                      <td className="p-3">
                        {all
                          .filter(
                            (row) => row.service.topology?.image === image.name,
                          )
                          .map((row) => `${row.project}/${row.service.service}`)
                          .join(", ") || "Unknown"}{" "}
                        · {image.containers ?? "unknown"} container references
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
