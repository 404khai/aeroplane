export type ExternalDatabase = {
  id: string;
  name: string;
  serviceId: string;
  database: string;
};
export type ExternalTable = { schema: string; name: string };
export type ExternalColumn = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  masked: boolean;
};
export type ExternalForeignKey = {
  column: string;
  schema: string;
  table: string;
  targetColumn: string;
  constraint: string;
  position: number;
};
export type ExternalRows = {
  columns: ExternalColumn[];
  foreignKeys: ExternalForeignKey[];
  rows: Record<string, string | null>[];
  hasMore: boolean;
  offset: number;
  limit: number;
};
