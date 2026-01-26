import React, { useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { ContextMenu } from './ContextMenu';
import { Trash2, Edit } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { EditRowModal } from './EditRowModal';

interface DataGridProps {
  columns: string[];
  data: any[][];
  tableName?: string | null;
  pkColumn?: string | null;
  connectionId?: string | null;
  onRefresh?: () => void;
}

export const DataGrid = ({ columns, data, tableName, pkColumn, connectionId, onRefresh }: DataGridProps) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: any[] } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number; value: any } | null>(null);
  const [editRowModalData, setEditRowModalData] = useState<any[] | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellDoubleClick = (rowIndex: number, colIndex: number, value: any) => {
    if (!tableName || !pkColumn) return; // Only edit if context is known
    setEditingCell({ rowIndex, colIndex, value });
  };

  const handleEditCommit = async () => {
    if (!editingCell || !tableName || !pkColumn || !connectionId) {
        setEditingCell(null);
        return;
    }

    const { rowIndex, colIndex, value } = editingCell;
    const row = data[rowIndex];
    const pkIndex = columns.indexOf(pkColumn);
    
    // Original value
    const originalValue = row[colIndex];
    if (value === originalValue) {
        setEditingCell(null);
        return;
    }

    // PK Value
    const pkVal = row[pkIndex];
    const colName = columns[colIndex];

    // Optimistic or waiting? Let's wait.
    try {
        await invoke('update_record', {
            connectionId,
            table: tableName,
            pkCol: pkColumn,
            pkVal,
            colName,
            newVal: value
        });
        if (onRefresh) onRefresh();
    } catch (e) {
        console.error('Update failed:', e);
        alert('Update failed: ' + e);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleEditCommit();
    } else if (e.key === 'Escape') {
        setEditingCell(null);
    }
  };

  const columnHelper = createColumnHelper<any[]>();
  
  const tableColumns = React.useMemo(() => 
    columns.map((colName, index) => 
      columnHelper.accessor(row => row[index], {
        id: colName,
        header: () => colName,
        cell: info => {
          const val = info.getValue();
          if (val === null) return <span className="text-slate-500 italic">null</span>;
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        }
      })
    ),
    [columns]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleContextMenu = (e: React.MouseEvent, row: any[]) => {
    if (tableName && pkColumn) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, row });
    }
  };

  const deleteRow = async () => {
    if (!contextMenu || !tableName || !pkColumn || !connectionId) return;
    
    const pkIndex = columns.indexOf(pkColumn);
    const pkVal = contextMenu.row[pkIndex];

    if (confirm('Are you sure you want to delete this row?')) {
        try {
          await invoke('delete_record', {
            connectionId,
            table: tableName,
            pkCol: pkColumn,
            pkVal
          });
          if (onRefresh) onRefresh();
        } catch (e) {
          console.error('Delete failed:', e);
          alert('Failed to delete row: ' + e);
        }
    }
  };

  if (columns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        No data to display
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto border border-slate-800 rounded bg-slate-900 relative">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th 
                  key={header.id}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-r border-slate-800 last:border-r-0 whitespace-nowrap"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr 
              key={row.id} 
              className="hover:bg-slate-800/50 transition-colors group"
              onContextMenu={(e) => handleContextMenu(e, row.original)}
            >
              {row.getVisibleCells().map((cell, colIndex) => {
                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                
                return (
                  <td 
                    key={cell.id}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex, cell.getValue())}
                    className="px-4 py-1.5 text-sm text-slate-300 border-b border-r border-slate-800 last:border-r-0 whitespace-nowrap font-mono truncate max-w-[300px] cursor-text"
                    title={!isEditing ? String(cell.getValue()) : ''}
                  >
                    {isEditing ? (
                        <input
                            ref={editInputRef}
                            value={editingCell.value}
                            onChange={e => setEditingCell(prev => prev ? ({ ...prev, value: e.target.value }) : null)}
                            onBlur={handleEditCommit}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-slate-950 text-white border-none outline-none p-0 m-0 font-mono"
                        />
                    ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Edit Row',
              icon: Edit,
              action: () => setEditRowModalData(contextMenu.row)
            },
            {
              label: 'Delete Row',
              icon: Trash2,
              danger: true,
              action: deleteRow
            }
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
};
