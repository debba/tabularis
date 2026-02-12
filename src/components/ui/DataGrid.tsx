import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { ArrowUp, ArrowDown, ArrowUpDown, Copy, Undo, Trash2, Edit, Sparkles, Ban, FileDigit } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import {
  USE_DEFAULT_SENTINEL,
  formatCellValue,
  getColumnSortState,
  calculateSelectionRange,
  toggleSetValue,
  resolveInsertionCellDisplay,
  resolveExistingCellDisplay,
  getCellStateClass,
  type MergedRow,
  type ColumnDisplayInfo,
} from "../../utils/dataGrid";
import { useDatabase } from "../../hooks/useDatabase";
import { rowToTSV, rowsToTSV, getSelectedRows, copyTextToClipboard } from "../../utils/clipboard";
import type { PendingInsertion } from "../../types/editor";

interface DataGridProps {
  columns: string[];
  data: unknown[][];
  tableName?: string | null;
  pkColumn?: string | null;
  autoIncrementColumns?: string[];
  defaultValueColumns?: string[];
  nullableColumns?: string[];
  connectionId?: string | null;
  onRefresh?: () => void;
  pendingChanges?: Record<
    string,
    { pkOriginalValue: unknown; changes: Record<string, unknown> }
  >;
  pendingDeletions?: Record<string, unknown>;
  pendingInsertions?: Record<string, PendingInsertion>;
  onPendingChange?: (pkVal: unknown, colName: string, value: unknown) => void;
  onPendingInsertionChange?: (
    tempId: string,
    colName: string,
    value: unknown
  ) => void;
  onDiscardInsertion?: (tempId: string) => void;
  onRevertDeletion?: (pkVal: unknown) => void;
  onMarkForDeletion?: (pkVal: unknown) => void;
  selectedRows?: Set<number>;
  onSelectionChange?: (indices: Set<number>) => void;
  sortClause?: string;
  onSort?: (colName: string) => void;
}

export const DataGrid = React.memo(({
  columns,
  data,
  tableName,
  pkColumn,
  autoIncrementColumns,
  defaultValueColumns,
  nullableColumns,
  connectionId,
  onRefresh,
  pendingChanges,
  pendingDeletions,
  pendingInsertions,
  onPendingChange,
  onPendingInsertionChange,
  onDiscardInsertion,
  onRevertDeletion,
  onMarkForDeletion,
  selectedRows: externalSelectedRows,
  onSelectionChange,
  sortClause,
  onSort,
}: DataGridProps) => {
  const { t } = useTranslation();
  const { activeSchema } = useDatabase();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: unknown[];
    rowIndex: number;
    colIndex: number;
    colName: string;
    mergedRow?: { type: "existing" | "insertion"; rowData: unknown[]; displayIndex: number; tempId?: string };
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    value: unknown;
  } | null>(null);
  const [internalSelectedRowIndices, setInternalSelectedRowIndices] = useState<
    Set<number>
  >(new Set());
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<
    number | null
  >(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const selectedRowIndices = externalSelectedRows || internalSelectedRowIndices;

  const updateSelection = useCallback((newSelection: Set<number>) => {
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedRowIndices(newSelection);
    }
  }, [onSelectionChange]);

  // Pre-calculate pkIndex once for O(1) lookup instead of O(n) in render loop
  const pkIndexMap = useMemo(() => {
    if (!pkColumn) return null;
    const pkIndex = columns.indexOf(pkColumn);
    return pkIndex >= 0 ? pkIndex : null;
  }, [columns, pkColumn]);

  // Merge existing rows with pending insertions
  const mergedRows = useMemo(() => {
    const rows: MergedRow[] = [];

    // Add existing rows first (displayIndex 0, 1, 2, ...)
    data.forEach((rowData, idx) => {
      rows.push({
        type: "existing",
        rowData,
        displayIndex: idx,
      });
    });

    // Add pending insertions at the end
    if (pendingInsertions) {
      const existingRowCount = data.length;
      let insertionIndex = 0;
      Object.entries(pendingInsertions).forEach(([tempId, insertion]) => {
        const rowData = columns.map((col) => insertion.data[col] ?? null);
        rows.push({
          type: "insertion",
          rowData,
          displayIndex: existingRowCount + insertionIndex,
          tempId,
        });
        insertionIndex++;
      });
    }

    // Sort by displayIndex (insertions are now at the end)
    return rows.sort((a, b) => a.displayIndex - b.displayIndex);
  }, [data, pendingInsertions, columns]);

  const handleRowClick = useCallback((index: number, event: React.MouseEvent) => {
    let newSelected = new Set(selectedRowIndices);

    if (event.shiftKey && lastSelectedRowIndex !== null) {
      // Range selection
      const range = calculateSelectionRange(lastSelectedRowIndex, index);
      
      // If NOT Ctrl/Cmd, clear previous selection first (standard OS behavior)
      if (!event.ctrlKey && !event.metaKey) {
        newSelected.clear();
      }

      range.forEach(i => newSelected.add(i));
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      newSelected = toggleSetValue(newSelected, index);
      setLastSelectedRowIndex(index);
    } else {
      // Single selection
      newSelected.clear();
      newSelected.add(index);
      setLastSelectedRowIndex(index);
    }

    updateSelection(newSelected);
  }, [selectedRowIndices, lastSelectedRowIndex, updateSelection]);

  const handleSelectAll = useCallback(() => {
    if (selectedRowIndices.size === mergedRows.length) {
      updateSelection(new Set());
    } else {
      const allIndices = new Set(mergedRows.map((_, i) => i));
      updateSelection(allIndices);
    }
  }, [selectedRowIndices.size, mergedRows, updateSelection]);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellDoubleClick = (
    rowIndex: number,
    colIndex: number,
    value: unknown,
  ) => {
    if (!tableName) return; // Only edit if table context is known

    // For insertion rows, allow editing without pkColumn
    const mergedRow = mergedRows[rowIndex];
    if (!mergedRow) return;
    if (mergedRow.type !== "insertion" && !pkColumn) return;

    setEditingCell({ rowIndex, colIndex, value });
  };

  const isCommittingRef = useRef(false);

  const handleEditCommit = async () => {
    // Prevent multiple concurrent commits (e.g., from rapid blur events)
    if (isCommittingRef.current) return;
    if (!editingCell || !tableName) {
      setEditingCell(null);
      return;
    }

    isCommittingRef.current = true;

    try {
      const { rowIndex, colIndex, value } = editingCell;

      // Safety check: ensure mergedRows has data
      if (!mergedRows || rowIndex >= mergedRows.length) {
        console.warn("Invalid rowIndex in handleEditCommit");
        setEditingCell(null);
        return;
      }

      // Check if this is an insertion row
      const mergedRow = mergedRows[rowIndex];
      const isInsertion = mergedRow?.type === "insertion";

      if (isInsertion) {
        // Handle insertion cell edit
        if (onPendingInsertionChange && mergedRow.tempId) {
          const colName = columns[colIndex];
          onPendingInsertionChange(mergedRow.tempId, colName, value);
        }
        setEditingCell(null);
        return;
      }

      // Existing row logic
      const row = mergedRow.rowData;
      if (!row) {
        console.warn("Invalid row data in handleEditCommit");
        setEditingCell(null);
        return;
      }

      // Original value
      const originalValue = row[colIndex];

      // Check if value changed (handling string/number differences)
      const isUnchanged = String(value) === String(originalValue);

      if (isUnchanged && !onPendingChange) {
        setEditingCell(null);
        return;
      }

      // PK Value - check pkIndexMap is valid
      if (pkIndexMap === null) {
        setEditingCell(null);
        return;
      }
      const pkVal = row[pkIndexMap];
      const colName = columns[colIndex];

      if (onPendingChange) {
        // If value matches original, pass undefined to remove the pending change
        onPendingChange(pkVal, colName, isUnchanged ? undefined : value);
        setEditingCell(null);
        return;
      }

      if (!connectionId) return;

      // Legacy immediate update
      try {
        await invoke("update_record", {
          connectionId,
          table: tableName,
          pkCol: pkColumn,
          pkVal,
          colName,
          newVal: value,
          ...(activeSchema ? { schema: activeSchema } : {}),
        });
        if (onRefresh) onRefresh();
      } catch (e) {
        console.error("Update failed:", e);
        await message(t("dataGrid.updateFailed") + e, {
          title: t("common.error"),
          kind: "error",
        });
      }
      setEditingCell(null);
    } finally {
      isCommittingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditCommit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault(); // Prevent default tab behavior

      if (!editingCell) return;

      // Commit current cell first
      handleEditCommit();

      const { rowIndex, colIndex } = editingCell;
      const totalRows = mergedRows.length;
      const totalCols = columns.length;

      // Calculate next position
      let nextRowIndex = rowIndex;
      let nextColIndex = colIndex + 1;

      // If we're at the last column, move to next row
      if (nextColIndex >= totalCols) {
        nextColIndex = 0;
        nextRowIndex = rowIndex + 1;

        // If we're at the last row, wrap to first row
        if (nextRowIndex >= totalRows) {
          nextRowIndex = 0;
        }
      }

      // Get the value of the next cell
      const nextRow = mergedRows[nextRowIndex];
      if (nextRow) {
        const nextValue = nextRow.rowData[nextColIndex];

        // Set editing on the next cell
        setTimeout(() => {
          setEditingCell({
            rowIndex: nextRowIndex,
            colIndex: nextColIndex,
            value: nextValue,
          });
        }, 0);
      }
    }
  };

  const columnHelper = useMemo(() => createColumnHelper<unknown[]>(), []);

  const coreRowModel = useMemo(() => getCoreRowModel(), []);

  const tableColumns = React.useMemo(
    () =>
      columns.map((colName, index) =>
        columnHelper.accessor((row) => row[index], {
          id: colName,
          header: () => {
            const sortState = getColumnSortState(colName, sortClause);
            const displaySortState: "none" | "asc" | "desc" = sortState ?? "none";

            return (
              <div
                className={`flex items-center gap-2 select-none group/header ${onSort ? 'cursor-pointer' : ''}`}
                onClick={() => onSort && onSort(colName)}
                title={
                  onSort ? (
                    displaySortState === "none"
                      ? t("dataGrid.sortByAsc", { col: colName })
                      : displaySortState === "asc"
                        ? t("dataGrid.sortByDesc", { col: colName })
                        : t("dataGrid.clearSort")
                  ) : undefined
                }
              >
                <span>{colName}</span>
                {onSort && (
                  <span className="flex flex-col items-center justify-center">
                    {displaySortState === "asc" && <ArrowUp size={14} className="text-blue-400" />}
                    {displaySortState === "desc" && <ArrowDown size={14} className="text-blue-400" />}
                    {displaySortState === "none" && (
                      <ArrowUpDown
                        size={14}
                        className="text-secondary/60 opacity-50 group-hover/header:opacity-100 transition-opacity"
                      />
                    )}
                  </span>
                )}
              </div>
            );
          },
          cell: (info) => {
            const val = info.getValue();
            const formatted = formatCellValue(val, t("dataGrid.null"));

            // The <generated> placeholder logic for auto-increment columns is handled
            // in the main render loop where we have full context (isInsertion, etc).

            // Apply styling for null values
            if (val === null || val === undefined) {
              return (
                <span className="text-muted italic">
                  {formatted}
                </span>
              );
            }

            return formatted;
          },
        }),
      ),
    [columns, columnHelper, t, sortClause, onSort],
  );

  const parentRef = useRef<HTMLDivElement>(null);

  // Memoize table data to prevent unnecessary re-renders
  const tableData = useMemo(() => mergedRows.map((r) => r.rowData), [mergedRows]);

   
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: coreRowModel,
  });

  const { rows: tableRows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  // Track insertion count to auto-scroll to bottom when new rows are added
  const prevInsertionCountRef = useRef(0);
  useEffect(() => {
    const insertionCount = pendingInsertions ? Object.keys(pendingInsertions).length : 0;
    if (insertionCount > prevInsertionCountRef.current && tableRows.length > 0) {
      rowVirtualizer.scrollToIndex(tableRows.length - 1, { align: "end" });
    }
    prevInsertionCountRef.current = insertionCount;
  }, [pendingInsertions, tableRows.length, rowVirtualizer]);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    row: unknown[],
    rowIndex: number,
    colIndex: number,
    colName: string
  ) => {
    if (tableName) {
      e.preventDefault();
      // Find the merged row corresponding to this DOM element
      const mergedRow = mergedRows.find(mr => mr.rowData === row);
      setContextMenu({ x: e.clientX, y: e.clientY, row, rowIndex, colIndex, colName, mergedRow });
    }
  }, [tableName, mergedRows]);

  const revertSelectedRow = useCallback(() => {
    if (!contextMenu) return;

    const isInsertion = contextMenu.mergedRow?.type === "insertion";
    const tempId = contextMenu.mergedRow?.tempId;

    // Handle insertion row revert (discard)
    if (isInsertion && tempId && onDiscardInsertion) {
      onDiscardInsertion(tempId);
      setContextMenu(null);
      return;
    }

    // For existing rows, need pkColumn
    if (!pkColumn || pkIndexMap === null) return;

    const pkVal = contextMenu.row[pkIndexMap];
    const pkValStr = String(pkVal);

    // Handle pending deletion revert
    const isPendingDelete = pendingDeletions?.[pkValStr] !== undefined;
    if (isPendingDelete && onRevertDeletion) {
      onRevertDeletion(pkVal);
      setContextMenu(null);
      return;
    }

    // Handle pending changes revert
    const rowPendingChanges = pendingChanges?.[pkValStr];
    if (rowPendingChanges && onPendingChange) {
      // Revert all pending changes for this row by setting them to undefined
      Object.keys(rowPendingChanges.changes).forEach((colName) => {
        onPendingChange(pkVal, colName, undefined);
      });
      setContextMenu(null);
      return;
    }

    setContextMenu(null);
  }, [
    contextMenu,
    onPendingChange,
    onRevertDeletion,
    onDiscardInsertion,
    pkColumn,
    pkIndexMap,
    pendingChanges,
    pendingDeletions,
  ]);

  const deleteSelectedRow = useCallback(() => {
    if (!contextMenu) return;

    const isInsertion = contextMenu.mergedRow?.type === "insertion";
    const tempId = contextMenu.mergedRow?.tempId;

    // Handle insertion row deletion (discard)
    if (isInsertion && tempId && onDiscardInsertion) {
      onDiscardInsertion(tempId);
      setContextMenu(null);
      return;
    }

    // For existing rows, mark for deletion
    if (pkColumn && pkIndexMap !== null && onMarkForDeletion) {
      const pkVal = contextMenu.row[pkIndexMap];
      onMarkForDeletion(pkVal);
      setContextMenu(null);
    }
  }, [contextMenu, onDiscardInsertion, onMarkForDeletion, pkColumn, pkIndexMap]);

  const editSelectedRow = useCallback(() => {
    if (!contextMenu || !contextMenu.mergedRow) return;

    const rowIndex = contextMenu.mergedRow.displayIndex;
    // Start editing the first column (index 0)
    const firstColValue = contextMenu.row[0];
    setEditingCell({ rowIndex, colIndex: 0, value: firstColValue });
    setContextMenu(null);
  }, [contextMenu]);

  // Unified handler for setting cell values from context menu actions
  const setCellValue = useCallback((value: unknown) => {
    if (!contextMenu) return;
    const { colName, mergedRow } = contextMenu;
    const isInsertion = mergedRow?.type === "insertion";

    if (isInsertion && onPendingInsertionChange && mergedRow.tempId) {
      onPendingInsertionChange(mergedRow.tempId, colName, value);
    } else if (onPendingChange && pkIndexMap !== null) {
      const pkVal = contextMenu.row[pkIndexMap];
      onPendingChange(pkVal, colName, value);
    }
    setContextMenu(null);
  }, [contextMenu, onPendingInsertionChange, onPendingChange, pkIndexMap]);

  const setCellGenerate = useCallback(() => setCellValue(null), [setCellValue]);
  const setCellNull = useCallback(() => setCellValue(null), [setCellValue]);
  const setCellDefault = useCallback(() => {
    if (!contextMenu) return;
    const isInsertion = contextMenu.mergedRow?.type === "insertion";
    // For insertions, null triggers <default> display; for existing rows, use sentinel
    setCellValue(isInsertion ? null : USE_DEFAULT_SENTINEL);
  }, [contextMenu, setCellValue]);
  const setCellEmpty = useCallback(() => setCellValue(" "), [setCellValue]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await copyTextToClipboard(text);
      // Optional: show a brief success message
      // await message(t("dataGrid.copied"), { title: t("common.success"), kind: "info" });
    } catch (e) {
      console.error("Copy failed:", e);
      await message(t("common.error") + ": " + e, {
        title: t("common.error"),
        kind: "error",
      });
    }
  }, [t]);

  const copyCellValue = useCallback(async () => {
    if (!contextMenu) return;
    
    // Copy the entire row as TSV (Tab-Separated Values)
    const rowText = rowToTSV(contextMenu.row, "null");
    
    await copyToClipboard(rowText);
  }, [contextMenu, copyToClipboard]);

  const copySelectedCells = useCallback(async () => {
    if (selectedRowIndices.size === 0) return;

    const selectedRows = getSelectedRows(data, selectedRowIndices);

    // Format as TSV for easy pasting into spreadsheets
    const text = rowsToTSV(selectedRows, "null");

    await copyToClipboard(text);
  }, [selectedRowIndices, data, copyToClipboard]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + C
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        // Only handle if not editing a cell
        if (!editingCell && selectedRowIndices.size > 0) {
          e.preventDefault();
          copySelectedCells();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingCell, selectedRowIndices, copySelectedCells]);

  // Show "no data" if there are no columns (even with pending insertions, we can't render without column info)
  // OR if there are columns but no data and no pending insertions
  if (columns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        {t("dataGrid.noData")}
      </div>
    );
  }

  return (
    <div 
        ref={parentRef}
        className="h-full overflow-auto border border-default rounded bg-elevated relative"
    >
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        <table className="w-full text-left border-collapse absolute top-0 left-0" style={{ transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
          <thead className="bg-base sticky top-0 z-10 shadow-sm" style={{ transform: `translateY(${-1 * (rowVirtualizer.getVirtualItems()[0]?.start ?? 0)}px)` }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th
                  onClick={handleSelectAll}
                  className="px-2 py-2 text-xs font-semibold text-muted border-b border-r border-default bg-base sticky left-0 z-20 text-center select-none w-[50px] min-w-[50px] cursor-pointer hover:bg-elevated"
                >
                  #
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-xs font-semibold text-secondary tracking-wider border-b border-r border-default last:border-r-0 whitespace-nowrap"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              const rowIndex = virtualRow.index;
              const isSelected = selectedRowIndices.has(rowIndex);

              // Check if this is an insertion row
              const mergedRow = mergedRows[rowIndex];
              const isInsertion = mergedRow?.type === "insertion";

              // Get PK for pending check (using pre-calculated pkIndexMap)
              const pkVal = pkIndexMap !== null ? String(row.original[pkIndexMap]) : null;
              const isPendingDelete = !isInsertion && pkVal
                ? pendingDeletions?.[pkVal] !== undefined
                : false;

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={`transition-colors group ${
                    isSelected
                      ? "bg-blue-900/20 border-l-4 border-blue-400"
                      : isInsertion
                        ? "bg-green-500/8 border-l-4 border-green-400"
                        : isPendingDelete
                          ? "bg-red-900/20 opacity-60"
                          : "hover:bg-surface-secondary/50"
                  }`}
                >
                  <td
                    onClick={(e) => handleRowClick(rowIndex, e)}
                    className={`px-2 py-1.5 text-xs text-center border-b border-r border-default sticky left-0 z-10 cursor-pointer select-none w-[50px] min-w-[50px] ${
                      isInsertion
                        ? isSelected
                          ? "bg-blue-900/40 text-blue-200 font-bold"
                          : "bg-green-950/30 text-green-300 font-bold"
                        : isPendingDelete
                          ? "bg-red-950/50 text-red-500 line-through"
                          : isSelected
                            ? "bg-blue-900/40 text-blue-200 font-bold"
                            : "bg-base text-muted hover:bg-surface-secondary"
                    }`}
                  >
                    {isInsertion ? "NEW" : rowIndex + 1}
                  </td>
                  {row.getVisibleCells().map((cell, colIndex) => {
                    const isEditing =
                      editingCell?.rowIndex === rowIndex &&
                      editingCell?.colIndex === colIndex;

                    const colName = cell.column.id;

                    const columnInfo: ColumnDisplayInfo = {
                      colName,
                      autoIncrementColumns,
                      defaultValueColumns,
                      nullableColumns,
                    };

                    const resolved = isInsertion
                      ? resolveInsertionCellDisplay(cell.getValue(), columnInfo)
                      : resolveExistingCellDisplay(
                          cell.getValue(),
                          pkVal,
                          pkColumn,
                          pendingChanges,
                          columnInfo,
                        );

                    const {
                      displayValue,
                      hasPendingChange,
                      isModified,
                      isAutoIncrementPlaceholder,
                      isDefaultValuePlaceholder,
                    } = resolved;

                    const stateClass = getCellStateClass({
                      isPendingDelete,
                      isSelected,
                      isInsertion,
                      isAutoIncrementPlaceholder,
                      isDefaultValuePlaceholder,
                      isModified,
                    });

                    return (
                      <td
                        key={cell.id}
                        onClick={(e) => handleRowClick(rowIndex, e)}
                        onDoubleClick={() =>
                          !isPendingDelete &&
                          handleCellDoubleClick(rowIndex, colIndex, (isAutoIncrementPlaceholder || isDefaultValuePlaceholder) ? "" : displayValue)
                        }
                        onContextMenu={(e) => handleContextMenu(e, row.original, rowIndex, colIndex, colName)}
                        className={`px-4 py-1.5 text-sm border-b border-r border-default last:border-r-0 whitespace-nowrap font-mono truncate max-w-[300px] cursor-text ${stateClass}`}
                        title={!isEditing ? String(displayValue) : ""}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            value={String(editingCell.value ?? "")}
                            onChange={(e) =>
                              setEditingCell((prev) =>
                                prev ? { ...prev, value: e.target.value } : null,
                              )
                            }
                            onBlur={handleEditCommit}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-base text-primary border-none outline-none p-0 m-0 font-mono"
                          />
                        ) : hasPendingChange ? (
                          String(displayValue)
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu && (() => {
        // Check if this row has any pending changes, deletions, or is an insertion
        const isInsertion = contextMenu.mergedRow?.type === "insertion";
        const pkVal = pkIndexMap !== null ? String(contextMenu.row[pkIndexMap]) : null;
        const hasPendingChanges = !isInsertion && pkVal && pendingChanges?.[pkVal] !== undefined;
        const hasPendingDeletion = !isInsertion && pkVal && pendingDeletions?.[pkVal] !== undefined;

        // Enable revert if there's any pending change, deletion, or insertion
        const canRevert = isInsertion || hasPendingChanges || hasPendingDeletion;

        // Determine which cell value options to show based on column properties
        const { colName } = contextMenu;
        const isAutoIncrement = autoIncrementColumns?.includes(colName);
        const isNullable = nullableColumns?.includes(colName);
        const hasDefault = defaultValueColumns?.includes(colName);

        // Build menu items dynamically
        const menuItems: ContextMenuItem[] = [];

        // Cell value manipulation options (shown first for cell context)
        // SET GENERATED only for insertion rows, not for existing rows
        if (isAutoIncrement && isInsertion) {
          menuItems.push({
            label: t("dataGrid.setGenerate"),
            icon: Sparkles,
            action: setCellGenerate,
          });
        }
        if (isNullable) {
          menuItems.push({
            label: t("dataGrid.setNull"),
            icon: Ban,
            action: setCellNull,
          });
        }
        if (hasDefault) {
          menuItems.push({
            label: t("dataGrid.setDefault"),
            icon: FileDigit,
            action: setCellDefault,
          });
        }
        // Always allow setting empty string
        menuItems.push({
          label: t("dataGrid.setEmpty"),
          icon: Copy,
          action: setCellEmpty,
        });

        // Separator and row actions
        if (menuItems.length > 0) {
          menuItems.push({ separator: true });
        }

        menuItems.push(
          {
            label: t("dataGrid.copyRow"),
            icon: Copy,
            action: copyCellValue,
          },
          {
            label: t("dataGrid.editRow"),
            icon: Edit,
            action: editSelectedRow,
          },
          {
            label: t("dataGrid.deleteRow"),
            icon: Trash2,
            danger: true,
            action: deleteSelectedRow,
          },
          {
            label: t("dataGrid.revertSelected"),
            icon: Undo,
            action: revertSelectedRow,
            disabled: !canRevert,
          }
        );

        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={menuItems}
          />
        );
      })()}
    </div>
  );
});
