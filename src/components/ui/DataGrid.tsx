import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContextMenu } from "./ContextMenu";
import { Trash2, Edit } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { EditRowModal } from "./EditRowModal";

interface DataGridProps {
  columns: string[];
  data: unknown[][];
  tableName?: string | null;
  pkColumn?: string | null;
  connectionId?: string | null;
  onRefresh?: () => void;
  pendingChanges?: Record<
    string,
    { pkOriginalValue: unknown; changes: Record<string, unknown> }
  >;
  pendingDeletions?: Record<string, unknown>;
  onPendingChange?: (pkVal: unknown, colName: string, value: unknown) => void;
  selectedRows?: Set<number>;
  onSelectionChange?: (indices: Set<number>) => void;
}

export const DataGrid = React.memo(({
  columns,
  data,
  tableName,
  pkColumn,
  connectionId,
  onRefresh,
  pendingChanges,
  pendingDeletions,
  onPendingChange,
  selectedRows: externalSelectedRows,
  onSelectionChange,
}: DataGridProps) => {
  const { t } = useTranslation();



  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: unknown[];
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
  const [editRowModalData, setEditRowModalData] = useState<unknown[] | null>(
    null,
  );
  const editInputRef = useRef<HTMLInputElement>(null);

  const selectedRowIndices = externalSelectedRows || internalSelectedRowIndices;

  const updateSelection = (newSelection: Set<number>) => {
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedRowIndices(newSelection);
    }
  };

  // Pre-calculate pkIndex once for O(1) lookup instead of O(n) in render loop
  const pkIndexMap = useMemo(() => {
    if (!pkColumn) return null;
    const pkIndex = columns.indexOf(pkColumn);
    return pkIndex >= 0 ? pkIndex : null;
  }, [columns, pkColumn]);

  const handleRowClick = useCallback((index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedRowIndices);

    if (event.shiftKey && lastSelectedRowIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedRowIndex, index);
      const end = Math.max(lastSelectedRowIndex, index);

      // If NOT Ctrl/Cmd, clear previous selection first (standard OS behavior)
      if (!event.ctrlKey && !event.metaKey) {
        newSelected.clear();
      }

      for (let i = start; i <= end; i++) {
        newSelected.add(i);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
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
    if (selectedRowIndices.size === data.length) {
      updateSelection(new Set());
    } else {
      const allIndices = new Set(data.map((_, i) => i));
      updateSelection(allIndices);
    }
  }, [selectedRowIndices.size, data.length, updateSelection]);

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
    if (!tableName || !pkColumn) return; // Only edit if context is known
    setEditingCell({ rowIndex, colIndex, value });
  };

  const handleEditCommit = async () => {
    if (!editingCell || !tableName || !pkColumn) {
      setEditingCell(null);
      return;
    }

    const { rowIndex, colIndex, value } = editingCell;
    const row = data[rowIndex];

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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditCommit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const columnHelper = useMemo(() => createColumnHelper<unknown[]>(), []);

  const tableColumns = React.useMemo(
    () =>
      columns.map((colName, index) =>
        columnHelper.accessor((row) => row[index], {
          id: colName,
          header: () => colName,
          cell: (info) => {
            const val = info.getValue();

            if (val === null || val === undefined)
              return (
                <span className="text-slate-500 italic">
                  {t("dataGrid.null")}
                </span>
              );
            if (typeof val === "boolean") return val ? "true" : "false";
            if (typeof val === "object") return JSON.stringify(val);
            return String(val);
          },
        }),
      ),
    [columns, columnHelper, t],
  );

  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  const handleContextMenu = useCallback((e: React.MouseEvent, row: unknown[]) => {
    if (tableName && pkColumn) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, row });
    }
  }, [tableName, pkColumn]);

  const deleteRow = useCallback(async () => {
    if (!contextMenu || !tableName || !pkColumn || !connectionId || pkIndexMap === null) return;

    const pkVal = contextMenu.row[pkIndexMap];

    const confirmed = await ask(t("dataGrid.confirmDelete"), {
      title: t("dataGrid.deleteTitle"),
      kind: "warning",
    });
    if (confirmed) {
      try {
        await invoke("delete_record", {
          connectionId,
          table: tableName,
          pkCol: pkColumn,
          pkVal,
        });
        if (onRefresh) onRefresh();
      } catch (e) {
        console.error("Delete failed:", e);
        await message(t("dataGrid.deleteFailed") + e, {
          title: t("common.error"),
          kind: "error",
        });
      }
    }
  }, [contextMenu, tableName, pkColumn, connectionId, pkIndexMap, onRefresh, t]);

  if (columns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        {t("dataGrid.noData")}
      </div>
    );
  }

  return (
    <div 
        ref={parentRef}
        className="h-full overflow-auto border border-slate-800 rounded bg-slate-900 relative"
    >
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        <table className="w-full text-left border-collapse absolute top-0 left-0" style={{ transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
          <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm" style={{ transform: `translateY(${-1 * (rowVirtualizer.getVirtualItems()[0]?.start ?? 0)}px)` }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th
                  onClick={handleSelectAll}
                  className="px-2 py-2 text-xs font-semibold text-slate-500 border-b border-r border-slate-800 bg-slate-950 sticky left-0 z-20 text-center select-none w-[50px] min-w-[50px] cursor-pointer hover:bg-slate-900"
                >
                  #
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-r border-slate-800 last:border-r-0 whitespace-nowrap"
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
              const row = rows[virtualRow.index];
              const rowIndex = virtualRow.index;
              const isSelected = selectedRowIndices.has(rowIndex);

              // Get PK for pending check (using pre-calculated pkIndexMap)
              const pkVal = pkIndexMap !== null ? String(row.original[pkIndexMap]) : null;
              const isPendingDelete = pkVal
                ? pendingDeletions?.[pkVal] !== undefined
                : false;

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={`transition-colors group ${
                    isPendingDelete
                      ? "bg-red-900/20 opacity-60"
                      : isSelected
                        ? "bg-blue-900/20"
                        : "hover:bg-slate-800/50"
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, row.original)}
                >
                  <td
                    onClick={(e) => handleRowClick(rowIndex, e)}
                    className={`px-2 py-1.5 text-xs text-center border-b border-r border-slate-800 sticky left-0 z-10 cursor-pointer select-none w-[50px] min-w-[50px] ${
                      isPendingDelete
                        ? "bg-red-950/50 text-red-500 line-through"
                        : isSelected
                          ? "bg-blue-900/40 text-blue-200 font-bold"
                          : "bg-slate-950 text-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    {rowIndex + 1}
                  </td>
                  {row.getVisibleCells().map((cell, colIndex) => {
                    const isEditing =
                      editingCell?.rowIndex === rowIndex &&
                      editingCell?.colIndex === colIndex;

                    // Check if this cell has a pending change (ONLY if pkColumn exists)
                    const colName = cell.column.id;
                    const pendingVal =
                      pkColumn && pkVal && pendingChanges?.[pkVal]?.changes?.[colName];
                    const hasPendingChange = pkColumn ? (pendingVal !== undefined) : false;
                    const displayValue = hasPendingChange
                      ? pendingVal
                      : cell.getValue();
                    const isModified =
                      hasPendingChange &&
                      String(pendingVal) !== String(cell.getValue());

                    return (
                      <td
                        key={cell.id}
                        onClick={(e) => handleRowClick(rowIndex, e)}
                        onDoubleClick={() =>
                          !isPendingDelete &&
                          handleCellDoubleClick(rowIndex, colIndex, displayValue)
                        }
                        className={`px-4 py-1.5 text-sm border-b border-r border-slate-800 last:border-r-0 whitespace-nowrap font-mono truncate max-w-[300px] cursor-text ${
                          isPendingDelete
                            ? "text-red-400/60 line-through decoration-red-500/30"
                            : isModified
                              ? "bg-blue-600/30 text-blue-100 italic font-medium"
                              : "text-slate-300"
                        }`}
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
                            className="w-full bg-slate-950 text-white border-none outline-none p-0 m-0 font-mono"
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t("dataGrid.editRow"),
              icon: Edit,
              action: () => setEditRowModalData(contextMenu.row),
            },
            {
              label: t("dataGrid.deleteRow"),
              icon: Trash2,
              danger: true,
              action: deleteRow,
            },
          ]}
        />
      )}

      {editRowModalData && tableName && pkColumn && (
        <EditRowModal
          isOpen={true}
          onClose={() => setEditRowModalData(null)}
          tableName={tableName}
          pkColumn={pkColumn}
          rowData={editRowModalData}
          columns={columns}
          onSaveSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
});
