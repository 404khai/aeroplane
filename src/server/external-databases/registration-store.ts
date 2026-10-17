import { randomUUID } from "node:crypto";
import { sqlite } from "../db.js";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "../secret-crypto.js";
import type { ExternalDatabase } from "../../shared/external-database.js";

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  tls: boolean;
};
sqlite.exec(
  `CREATE TABLE IF NOT EXISTS external_database_connections (id TEXT PRIMARY KEY, name TEXT NOT NULL, service_id TEXT NOT NULL, database_name TEXT NOT NULL, encrypted_config TEXT NOT NULL)`,
);
export function registrations(): ExternalDatabase[] {
  return sqlite
    .prepare(
      "SELECT id, name, service_id AS serviceId, database_name AS database FROM external_database_connections ORDER BY name",
    )
    .all() as ExternalDatabase[];
}
export function saveRegistration(
  name: string,
  serviceId: string,
  connection: ConnectionConfig,
) {
  const id = randomUUID();
  sqlite
    .prepare("INSERT INTO external_database_connections VALUES (?, ?, ?, ?, ?)")
    .run(
      id,
      name,
      serviceId,
      connection.database,
      encryptSecret(JSON.stringify(connection)),
    );
  return id;
}
export function connectionFor(id: string) {
  const row = sqlite
    .prepare(
      "SELECT encrypted_config FROM external_database_connections WHERE id = ?",
    )
    .get(id) as { encrypted_config: string } | undefined;
  if (!row || !isEncryptedSecret(row.encrypted_config))
    throw new Error("Connection unavailable");
  return JSON.parse(decryptSecret(row.encrypted_config)) as ConnectionConfig;
}
export function removeRegistration(id: string) {
  sqlite
    .prepare("DELETE FROM external_database_connections WHERE id = ?")
    .run(id);
}
