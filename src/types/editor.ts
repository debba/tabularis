export interface Pagination {
  page: number;
  page_size: number;
  total_rows: number;
}

export interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
  default_value?: string;
}

export interface ForeignKey {
  name: string;
  column_name: string;
  ref_table: string;
  ref_column: string;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  foreign_keys: ForeignKey[];
}

export interface SchemaCache {
  data: TableSchema[];
  version: number;
  timestamp: number;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  affected_rows: number;
  truncated?: boolean;
  pagination?: Pagination;
}

import type { Node, Edge } from "@xyflow/react";

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
}

export interface PendingInsertion {
  tempId: string;
  data: Record<string, unknown>;
  displayIndex: number;
}

export interface Tab {
  id: string;
  title: string;
  type: "console" | "table" | "query_builder";
  query: string;
  result: QueryResult | null;
  error: string;
  executionTime: number | null;
  page: number;
  activeTable: string | null;
  pkColumn: string | null;
  autoIncrementColumns?: string[]; // Names of auto-increment columns
  defaultValueColumns?: string[]; // Names of columns with default values
  nullableColumns?: string[]; // Names of nullable columns
  columnMetadata?: TableColumn[]; // Full column metadata (includes data_type for geometric types, etc.)
  isLoading?: boolean;
  connectionId: string;
  flowState?: FlowState;
  pendingChanges?: Record<
    string,
    { pkOriginalValue: unknown; changes: Record<string, unknown> }
  >;
  pendingDeletions?: Record<string, unknown>; // Map of stringified PK -> original PK value
  pendingInsertions?: Record<string, PendingInsertion>; // Map of tempId -> pending insertion
  selectedRows?: number[]; // Selected row indices
  isEditorOpen?: boolean; // Whether the SQL editor is visible
  filterClause?: string; // SQL WHERE clause (without "WHERE")
  sortClause?: string; // SQL ORDER BY clause (without "ORDER BY")
  limitClause?: number; // SQL LIMIT value
  queryParams?: Record<string, string>; // Saved values for query parameters
  schema?: string; // Schema name (PostgreSQL) for query reconstruction
}

export interface EditorPreferences {
  tabs: Tab[];
  active_tab_id: string | null;
}
