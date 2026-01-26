import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../contexts/DatabaseContext';

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

interface EditRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  pkColumn: string;
  rowData: any[];
  columns: string[];
  onSaveSuccess: () => void;
}

export const EditRowModal = ({ isOpen, onClose, tableName, pkColumn, rowData, columns, onSaveSuccess }: EditRowModalProps) => {
  const { activeConnectionId } = useDatabase();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [tableSchema, setTableSchema] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch schema to know types
  useEffect(() => {
    if (isOpen && activeConnectionId && tableName) {
        invoke<TableColumn[]>('get_columns', { 
            connectionId: activeConnectionId, 
            tableName 
        })
        .then(cols => setTableSchema(cols))
        .catch(err => console.error('Failed to load schema for edit:', err));
    }
  }, [isOpen, activeConnectionId, tableName]);

  // Initialize form data from rowData
  useEffect(() => {
    if (isOpen && rowData && columns) {
      const initialData: Record<string, any> = {};
      columns.forEach((col, index) => {
        initialData[col] = rowData[index];
      });
      setFormData(initialData);
    }
  }, [isOpen, rowData, columns]);

  if (!isOpen) return null;

  const parseValue = (value: any, colName: string) => {
    // Find column definition
    const colDef = tableSchema.find(c => c.name === colName);
    if (!colDef) return value; // Fallback

    const type = colDef.data_type.toLowerCase();
    const strVal = String(value);

    // Handle explicitly numeric types
    if (type.includes('int') || type.includes('serial') || type.includes('dec') || type.includes('numeric') || type.includes('float') || type.includes('double') || type.includes('real')) {
      if (strVal.trim() === '') return null; 
      const num = Number(strVal);
      return isNaN(num) ? value : num;
    }
    
    // Handle booleans
    if (type.includes('bool') || type.includes('tinyint(1)')) {
        if (strVal.toLowerCase() === 'true' || strVal === '1') return true;
        if (strVal.toLowerCase() === 'false' || strVal === '0') return false;
        if (strVal.trim() === '') return null;
        return value; 
    }
    
    return value;
  };

  const handleSave = async () => {
    if (!activeConnectionId) return;
    setLoading(true);
    setError('');

    try {
      // Find PK value
      const pkIndex = columns.indexOf(pkColumn);
      const pkVal = rowData[pkIndex];

      // Identify changes
      const changes = [];
      for (const [col, val] of Object.entries(formData)) {
        const originalVal = rowData[columns.indexOf(col)];
        
        // Loose comparison for string vs number (e.g. input "123" vs 123)
        // But strictly, we should parse 'val' and then compare.
        const parsedVal = parseValue(val, col);
        
        // If parsedVal is same as originalVal, skip
        if (parsedVal !== originalVal) {
             // Edge case: "123" vs 123. parsedVal is 123. originalVal is 123. 123 === 123.
             // Edge case: null vs "". parsedVal might be null?
             changes.push({ col, val: parsedVal });
        }
      }

      if (changes.length === 0) {
        onClose();
        return;
      }

      // Execute updates sequentially
      for (const change of changes) {
        await invoke('update_record', {
          connectionId: activeConnectionId,
          table: tableName,
          pkCol: pkColumn,
          pkVal: pkVal,
          colName: change.col,
          newVal: change.val
        });
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Update failed:', err);
      setError('Failed to update row: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (col: string, value: string) => {
    setFormData(prev => ({ ...prev, [col]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-[600px] border border-slate-700 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Edit Row ({tableName})</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 text-red-200 rounded text-sm">
              {error}
            </div>
          )}

          {columns.map((col) => {
            const isPk = col === pkColumn;
            // Try to find type hint
            const colDef = tableSchema.find(c => c.name === col);
            const typeHint = colDef ? `(${colDef.data_type})` : '';

            return (
              <div key={col}>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {col} <span className="text-slate-600">{typeHint}</span> {isPk && <span className="text-yellow-500">(PK)</span>}
                </label>
                <input
                  disabled={isPk} 
                  value={formData[col] === null ? '' : String(formData[col])}
                  onChange={(e) => handleInputChange(col, e.target.value)}
                  className={`
                    w-full bg-slate-900 border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500
                    ${isPk ? 'border-slate-800 text-slate-500 cursor-not-allowed' : 'border-slate-700'}
                  `}
                  placeholder={formData[col] === null ? 'NULL' : ''}
                />
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3 rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white font-medium text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium text-sm flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
