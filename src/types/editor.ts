export interface Pagination {
  page: number;
  page_size: number;
  total_rows: number;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  affected_rows: number;
  truncated?: boolean;
  pagination?: Pagination;
}

import type { Node, Edge } from '@xyflow/react';

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
}

export interface Tab {
  id: string;
  title: string;
  type: 'console' | 'table' | 'query_builder';
  query: string;
  result: QueryResult | null;
  error: string;
  executionTime: number | null;
  page: number;
  activeTable: string | null;
  pkColumn: string | null;
  isLoading?: boolean;
  connectionId: string;
  flowState?: FlowState;
  pendingChanges?: Record<string, { pkOriginalValue: unknown; changes: Record<string, unknown> }>;
  pendingDeletions?: Record<string, unknown>; // Map of stringified PK -> original PK value
  selectedRows?: number[]; // Selected row indices
  isEditorOpen?: boolean; // Whether the SQL editor is visible
  filterClause?: string; // SQL WHERE clause (without "WHERE")
  sortClause?: string; // SQL ORDER BY clause (without "ORDER BY")
}
