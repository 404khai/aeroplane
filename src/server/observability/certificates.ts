import { connect } from "node:tls";
import type { CertificateInspection } from "../../shared/storage-inspection.js";

const cache = new Map<string, { at: number; value: CertificateInspection }>();
let active = 0;
export async function inspectCertificate(
  hostname: string,
): Promise<CertificateInspection> {
  const cached = cache.get(hostname);
  if (cached && Date.now() - cached.at < 300_000) return cached.value;
  const unknown: CertificateInspection = {
    hostname,
    state: "unknown",
    expiresAt: null,
    issuer: null,
  };
  if (active >= 4) return unknown;
  active++;
  try {
    const value = await new Promise<CertificateInspection>((resolve) => {
      const socket = connect({
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: true,
      });
      const finish = (result: CertificateInspection) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(4000, () => finish(unknown));
      socket.once("error", () => finish(unknown));
      socket.once("secureConnect", () => {
        const cert = socket.getPeerCertificate();
        const expires = Date.parse(cert.valid_to);
        finish(
          Number.isFinite(expires)
            ? {
                hostname,
                state: expires < Date.now() ? "expired" : "valid",
                expiresAt: new Date(expires).toISOString(),
                issuer: cert.issuer?.O ? String(cert.issuer.O) : null,
              }
            : unknown,
        );
      });
    });
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(hostname, { at: Date.now(), value });
    return value;
  } finally {
    active--;
  }
}
