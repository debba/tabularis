/**
 * DataGrid utility functions for cell formatting, sorting, and selection
 * Extracted for testability
 */

export type SortDirection = "asc" | "desc" | null;

/**
 * Formats a cell value for display in the DataGrid
 * @param value - The raw cell value
 * @param nullLabel - The label to show for null values (i18n)
 * @returns Formatted string representation
 */
export function formatCellValue(value: unknown, nullLabel: string = "NULL"): string {
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

/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
