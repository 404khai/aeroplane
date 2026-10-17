export type StorageInspection = {
  sampledAt: number;
  summary: {
    type: string;
    total: string;
    active: string;
    size: string;
    reclaimable: string;
  }[];
  volumes: {
    name: string;
    driver: string;
    size: string | null;
    links: string | null;
  }[];
  images: {
    id: string;
    name: string;
    size: string;
    containers: string | null;
  }[];
};
export type CertificateInspection = {
  hostname: string;
  state: "valid" | "expired" | "unknown";
  expiresAt: string | null;
  issuer: string | null;
};
