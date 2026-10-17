import { useState } from "react";
import type { ObservedService } from "../../../shared/observability";
import type { CertificateInspection } from "../../../shared/storage-inspection";
import { inspection, inspectionRequest } from "./inspection-api";
export function ServiceRoutesPanel({ service }: { service: ObservedService }) {
  const [certificates, setCertificates] = useState<
    Record<string, CertificateInspection>
  >({});
  const [error, setError] = useState("");
  return (
    <section className="space-y-4 text-sm text-zinc-400">
      <p>
        Routes from Aeroplane configuration or the selected Caddy container
        label. Unlabelled reverse-proxy configurations are unknown; no private
        proxy files are read.
      </p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const hostname = String(new FormData(form).get("hostname") ?? "");
          void inspectionRequest(`inspection/services/${service.id}/routes`, {
            method: "POST",
            body: JSON.stringify({ hostname }),
          })
            .then(() => {
              form.reset();
              setError(
                "Route saved as owner-declared evidence. It appears at the next refresh; proxy configuration is unchanged.",
              );
            })
            .catch(() => setError("Could not save route declaration"));
        }}
      >
        <input
          name="hostname"
          required
          placeholder="Existing route hostname"
          aria-label="Existing route hostname"
          className="border border-zinc-800 bg-black px-3 py-2 text-xs"
        />
        <button className="border border-white/20 px-3 py-2 text-xs">
          Record existing route
        </button>
      </form>
      {!service.topology?.domains.length && (
        <p>No route evidence discovered. Certificate state unknown.</p>
      )}
      {service.topology?.domains.map((domain) => {
        const cert = certificates[domain.hostname];
        const days = cert?.expiresAt
          ? Math.floor((Date.parse(cert.expiresAt) - Date.now()) / 86400000)
          : null;
        return (
          <div key={domain.hostname} className="border border-zinc-800 p-4">
            <p className="text-white">{domain.hostname}</p>
            <p className="mt-1 text-xs">{domain.source}</p>
            {domain.source.startsWith("Owner-declared") && (
              <button
                className="mt-2 text-xs underline"
                onClick={() => {
                  void inspectionRequest(
                    `inspection/services/${service.id}/routes`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        hostname: domain.hostname,
                        remove: true,
                      }),
                    },
                  )
                    .then(() =>
                      setError("Declaration removed; applies at next refresh."),
                    )
                    .catch(() => setError("Could not remove declaration"));
                }}
              >
                Remove declaration
              </button>
            )}
            <button
              className="mt-3 text-xs underline"
              onClick={() => {
                setError("");
                void inspection
                  .certificate(domain.hostname)
                  .then((value) =>
                    setCertificates((current) => ({
                      ...current,
                      [domain.hostname]: value,
                    })),
                  )
                  .catch(() => setError("Certificate inspection unavailable"));
              }}
            >
              Inspect public TLS certificate
            </button>
            <p
              className={`mt-2 text-xs ${days != null && days < 30 ? "text-amber-300" : ""}`}
            >
              {cert
                ? `${cert.state} · expires ${cert.expiresAt ?? "unknown"}${days != null ? ` · ${days} days remaining` : ""} · issuer ${cert.issuer ?? "unknown"}`
                : "Certificate not inspected"}
            </p>
          </div>
        );
      })}
      {error && <p role="alert">{error}</p>}
      <p className="text-xs">
        TLS verification enabled. Unreachable, private-CA, expired or invalid
        certificates report unknown when a trusted handshake cannot complete.
        Inspection results are cached for five minutes.
      </p>
    </section>
  );
}
