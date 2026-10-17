import type {
  ObservedService,
  ServiceSample,
  Incident,
} from "../../../shared/observability";
import type {
  StorageInspection,
  CertificateInspection,
} from "../../../shared/storage-inspection";
import type {
  ExternalDatabase,
  ExternalTable,
  ExternalRows,
} from "../../../shared/external-database";

export async function inspectionRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/system/${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Inspection unavailable");
  }
  return response.json();
}
export const inspection = {
  service: (id: string) =>
    inspectionRequest<{
      service: ObservedService;
      history: ServiceSample[];
      retentionMs: number;
      persistence: string;
    }>(`inspection/services/${encodeURIComponent(id)}`),
  storage: () => inspectionRequest<StorageInspection>("inspection/storage"),
  alerts: () =>
    inspectionRequest<{ incidents: Incident[] }>("inspection/alerts"),
  acknowledge: (id: string) =>
    inspectionRequest(
      `inspection/alerts/${encodeURIComponent(id)}/acknowledge`,
      { method: "POST" },
    ),
  certificate: (hostname: string) =>
    inspectionRequest<CertificateInspection>(
      `inspection/certificate?${new URLSearchParams({ hostname })}`,
    ),
  databases: () =>
    inspectionRequest<{ connections: ExternalDatabase[] }>(
      "external-databases",
    ),
  tables: (id: string) =>
    inspectionRequest<{ tables: ExternalTable[] }>(
      `external-databases/${encodeURIComponent(id)}/tables`,
    ),
  rows: (id: string, query: Record<string, string>) =>
    inspectionRequest<ExternalRows>(
      `external-databases/${encodeURIComponent(id)}/rows`,
      { method: "POST", body: JSON.stringify(query) },
    ),
};
