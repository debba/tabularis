import type { QueryResult } from "./editor";

export type NotebookCellType = "sql" | "markdown";

export type ChartType = "bar" | "line" | "pie";

export interface CellChartConfig {
  type: ChartType;
  labelColumn: string;
  valueColumns: string[];
}

export interface RunAllResult {
  total: number;
  executed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ cellId: string; cellIndex: number; error: string }>;
}

export interface NotebookParam {
  name: string;
  value: string;
}

export interface CellExecutionEntry {
  query: string;
  result: QueryResult | null;
  error?: string;
  executionTime: number | null;
  timestamp: number;
}

export interface NotebookCell {
  id: string;
  type: NotebookCellType;
  content: string;
  name?: string; // Optional display name shown in header and outline
  schema?: string; // SQL only: per-cell database override
  result?: QueryResult | null;
  error?: string;
  executionTime?: number | null;
  isLoading?: boolean;
  isPreview?: boolean; // Markdown only: true = rendered, false = editing
  chartConfig?: CellChartConfig | null; // SQL only: inline chart configuration
  resultHeight?: number; // SQL only: custom result panel height in pixels
  isParallel?: boolean; // SQL only: can run in parallel during Run All
  isCollapsed?: boolean; // Cell body hidden when collapsed
  history?: CellExecutionEntry[]; // Last N executions
}

export interface NotebookState {
  cells: NotebookCell[];
  stopOnError?: boolean;
  params?: NotebookParam[];
}

// File format for .tabularis-notebook export/import
export interface NotebookFile {
  version: number;
  title: string;
  createdAt: string;
  cells: Array<{
    type: NotebookCellType;
    content: string;
    name?: string;
    schema?: string;
    chartConfig?: CellChartConfig | null;
    isParallel?: boolean;
  }>;
  params?: NotebookParam[];
}
