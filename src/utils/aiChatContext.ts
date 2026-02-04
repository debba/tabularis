import type { TableSchema } from "../types/editor";

interface AiChatContextOptions {
  schema: TableSchema[];
  activeTable: string | null;
  activeQuery: string | null;
  connectionName: string | null;
  databaseName: string | null;
  driver: string | null;
  maxTables?: number;
  language: "English" | "Italian";
}

const DEFAULT_MAX_TABLES = 20;

function formatColumn(column: TableSchema["columns"][number]): string {
  const details = [column.data_type];
  if (column.is_pk) {
    details.push("PK");
  }
  if (!column.is_nullable) {
    details.push("NOT NULL");
  }
  return `${column.name} ${details.join(" ")}`;
}

function formatTable(table: TableSchema): string {
  const columns = table.columns.map(formatColumn).join(", ");
  const fkInfo = table.foreign_keys.length
    ? ` FKs: ${table.foreign_keys
        .map((fk) => `${fk.column_name} -> ${fk.ref_table}.${fk.ref_column}`)
        .join(", ")}`
    : "";
  return `Table: ${table.name} (${columns})${fkInfo}`;
}

export function buildAiChatContext(options: AiChatContextOptions): string {
  const {
    schema,
    activeTable,
    activeQuery,
    connectionName,
    databaseName,
    driver,
    maxTables = DEFAULT_MAX_TABLES,
    language,
  } = options;

  const parts: string[] = [
    "You are the Tabularis AI Assistant. Provide focused, accurate help with SQL, schema exploration, and query troubleshooting.",
    `Response language: ${language}.`,
  ];

  if (connectionName || databaseName || driver) {
    parts.push(
      `Connection: ${connectionName || "Unknown"} | Database: ${databaseName || "Unknown"} | Driver: ${driver || "Unknown"}`
    );
  }

  if (activeTable) {
    parts.push(`Active table: ${activeTable}`);
  }

  if (activeQuery && activeQuery.trim()) {
    parts.push(`Active query:\n${activeQuery.trim()}`);
  }

  if (schema.length > 0) {
    const tables = schema.slice(0, maxTables).map(formatTable);
    const remaining = schema.length - tables.length;
    let schemaBlock = tables.join("\n");
    if (remaining > 0) {
      schemaBlock += `\n...and ${remaining} more tables.`;
    }
    parts.push(`Schema snapshot:\n${schemaBlock}`);
  }

  return parts.join("\n\n");
}
