/**
 * DataGrid utility functions for cell formatting, sorting, and selection
 * Extracted for testability
 */

import { formatGeometricValue, isGeometricType } from './geometry';

/** Sentinel value indicating that the database DEFAULT value should be used */
export const USE_DEFAULT_SENTINEL = "__USE_DEFAULT__";

export type SortDirection = "asc" | "desc" | null;

/** Represents a merged row combining existing data and pending insertions */
export interface MergedRow {
  type: "existing" | "insertion";
  rowData: unknown[];
  displayIndex: number;
  tempId?: string;
}

/**
 * Formats a cell value for display in the DataGrid
 * @param value - The raw cell value
 * @param nullLabel - The label to show for null values (i18n)
 * @param columnType - Optional column data type for type-specific formatting
 * @returns Formatted string representation
 */
export function formatCellValue(
  value: unknown,
  nullLabel: string = "NULL",
  columnType?: string
): string {
  // Handle geometric types first (before null check to preserve geometric NULL handling)
  if (columnType && isGeometricType(columnType)) {
    return formatGeometricValue(value);
  }

  if (value === null || value === undefined) {
    return nullLabel;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Determines the sort state for a column based on the current sort clause
 * @param columnName - The column to check
 * @param sortClause - The current ORDER BY clause (e.g., "name ASC, id DESC")
 * @returns The sort direction for this column: "asc", "desc", or null
 */
export function getColumnSortState(
  columnName: string, 
  sortClause: string | undefined
): SortDirection {
  if (!sortClause) return null;
  
  // Normalize for case-insensitive comparison
  const normalizedClause = sortClause.toLowerCase();
  const normalizedCol = columnName.toLowerCase();
  
  // Check if column appears in sort clause
  // Handle patterns like: "name ASC", "name asc", "table.name ASC", etc.
  const patterns = [
    new RegExp(`\\b${escapeRegExp(normalizedCol)}\\s+(asc|desc)\\b`),
    new RegExp(`\\b${escapeRegExp(normalizedCol)}\\b`),
  ];
  
  for (const pattern of patterns) {
    const match = normalizedClause.match(pattern);
    if (match) {
      // Check if explicit ASC/DESC was captured
      if (match[1]) {
        return match[1] === "asc" ? "asc" : "desc";
      }
      // Default to ASC if no direction specified
      return "asc";
    }
  }
  
  return null;
}

/**
 * Calculates a range of indices for shift-click selection
 * @param startIndex - The previously selected index (anchor)
 * @param endIndex - The newly clicked index
 * @returns Array of indices from start to end (inclusive)
 */
export function calculateSelectionRange(
  startIndex: number, 
  endIndex: number
): number[] {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);
  
  const range: number[] = [];
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  return range;
}

/**
 * Toggles a value in a Set (adds if not present, removes if present)
 * @param set - The Set to modify
 * @param value - The value to toggle
 * @returns New Set with the value toggled
 */
export function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
  const newSet = new Set(set);
  if (newSet.has(value)) {
    newSet.delete(value);
  } else {
    newSet.add(value);
  }
  return newSet;
}

/** Column metadata relevant for cell display resolution */
export interface ColumnDisplayInfo {
  colName: string;
  autoIncrementColumns?: string[];
  defaultValueColumns?: string[];
  nullableColumns?: string[];
}

/** Result of resolving what value and styling a cell should display */
export interface ResolvedCellDisplay {
  displayValue: unknown;
  hasPendingChange: boolean;
  isModified: boolean;
  isAutoIncrementPlaceholder: boolean;
  isDefaultValuePlaceholder: boolean;
}

/**
 * Resolves the display value for an insertion cell, computing placeholder states
 * for auto-increment and default-value columns.
 */
export function resolveInsertionCellDisplay(
  cellValue: unknown,
  columnInfo: ColumnDisplayInfo,
): ResolvedCellDisplay {
  let displayValue = cellValue;
  let isAutoIncrementPlaceholder = false;
  let isDefaultValuePlaceholder = false;
  const isModified = displayValue !== null && displayValue !== "";

  if (
    columnInfo.autoIncrementColumns?.includes(columnInfo.colName) &&
    (displayValue === null || displayValue === "")
  ) {
    displayValue = "<generated>";
    isAutoIncrementPlaceholder = true;
  } else if (
    columnInfo.defaultValueColumns?.includes(columnInfo.colName) &&
    !columnInfo.nullableColumns?.includes(columnInfo.colName) &&
    (displayValue === null || displayValue === "")
  ) {
    displayValue = "<default>";
    isDefaultValuePlaceholder = true;
  }

  return {
    displayValue,
    hasPendingChange: true,
    isModified,
    isAutoIncrementPlaceholder,
    isDefaultValuePlaceholder,
  };
}

/**
 * Resolves the display value for an existing row cell, checking pending changes
 * and computing placeholder states.
 */
export function resolveExistingCellDisplay(
  cellValue: unknown,
  pkVal: string | null,
  pkColumn: string | null | undefined,
  pendingChanges: Record<string, { pkOriginalValue: unknown; changes: Record<string, unknown> }> | undefined,
  columnInfo: ColumnDisplayInfo,
): ResolvedCellDisplay {
  const pendingVal =
    pkColumn && pkVal && pendingChanges?.[pkVal]?.changes?.[columnInfo.colName];
  const hasPendingChange = (pkColumn && pkVal) ? (pendingVal !== undefined) : false;
  let displayValue = hasPendingChange ? pendingVal : cellValue;
  const isModified =
    hasPendingChange && String(pendingVal) !== String(cellValue);
  let isAutoIncrementPlaceholder = false;
  let isDefaultValuePlaceholder = false;

  if (hasPendingChange) {
    if (displayValue === USE_DEFAULT_SENTINEL) {
      displayValue = "<default>";
      isDefaultValuePlaceholder = true;
    } else if (displayValue === null || displayValue === "") {
      if (columnInfo.autoIncrementColumns?.includes(columnInfo.colName)) {
        displayValue = "<generated>";
        isAutoIncrementPlaceholder = true;
      } else if (
        columnInfo.defaultValueColumns?.includes(columnInfo.colName) &&
        !columnInfo.nullableColumns?.includes(columnInfo.colName)
      ) {
        displayValue = "<default>";
        isDefaultValuePlaceholder = true;
      }
    }
  }

  return {
    displayValue,
    hasPendingChange,
    isModified,
    isAutoIncrementPlaceholder,
    isDefaultValuePlaceholder,
  };
}

/** Parameters for computing a cell's CSS class */
export interface CellClassParams {
  isPendingDelete: boolean;
  isSelected: boolean;
  isInsertion: boolean;
  isAutoIncrementPlaceholder: boolean;
  isDefaultValuePlaceholder: boolean;
  isModified: boolean;
}

/**
 * Computes the dynamic CSS class for a data cell based on its state.
 * Returns only the state-dependent portion; base classes are applied separately.
 */
export function getCellStateClass(params: CellClassParams): string {
  const {
    isPendingDelete,
    isSelected,
    isInsertion,
    isAutoIncrementPlaceholder,
    isDefaultValuePlaceholder,
    isModified,
  } = params;

  const isPlaceholder = isAutoIncrementPlaceholder || isDefaultValuePlaceholder;

  if (isPendingDelete) {
    return "text-red-400/60 line-through decoration-red-500/30";
  }

  if (isSelected && isInsertion) {
    if (isPlaceholder) return "text-muted italic select-none";
    if (isModified) return "bg-blue-600/20 text-blue-200 italic font-medium";
    return "bg-blue-900/20 text-secondary italic";
  }

  if (isInsertion) {
    if (isPlaceholder) return "text-muted italic select-none";
    if (isModified) return "bg-green-500/15 text-green-200 italic";
    return "bg-green-500/5 text-secondary italic";
  }

  if (isModified) {
    return "bg-blue-600/30 text-blue-100 italic font-medium";
  }

  return "text-secondary";
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
