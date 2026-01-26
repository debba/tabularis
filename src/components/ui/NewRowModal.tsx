import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../contexts/DatabaseContext';

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
}

interface NewRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onSaveSuccess: () => void;
}

export const NewRowModal = ({ isOpen, onClose, tableName, onSaveSuccess }: NewRowModalProps) => {
  const { activeConnectionId } = useDatabase();
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && activeConnectionId && tableName) {
      setSchemaLoading(true);
      invoke<TableColumn[]>('get_columns', { 
        connectionId: activeConnectionId, 
        tableName 
      })
      .then(cols => {
        setColumns(cols);
        // Initialize form data (empty)
        const initialData: Record<string, any> = {};
        cols.forEach(col => {
            initialData[col.name] = ''; // Default empty string for text inputs
        });
        setFormData(initialData);
      })
      .catch(err => setError('Failed to load schema: ' + err))
      .finally(() => setSchemaLoading(false));
    }
  }, [isOpen, activeConnectionId, tableName]);

  if (!isOpen) return null;

  const parseValue = (value: string, dataType: string) => {
    const type = dataType.toLowerCase();
    
    // Handle explicitly numeric types
    if (type.includes('int') || type.includes('serial') || type.includes('dec') || type.includes('numeric') || type.includes('float') || type.includes('double') || type.includes('real')) {
      if (value.trim() === '') return null; // Or empty string? Let's say null if empty for number.
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    
    // Handle booleans
    if (type.includes('bool') || type.includes('tinyint(1)')) {
        if (value.toLowerCase() === 'true' || value === '1') return true;
        if (value.toLowerCase() === 'false' || value === '0') return false;
        // If it's literally "null" string or empty, maybe null?
        if (value.trim() === '') return null;
        return value; 
    }
    
    // Default to string
    return value;
  };

  const handleSave = async () => {
    if (!activeConnectionId) return;
    setLoading(true);
    setError('');

    try {
      const dataToSend: Record<string, any> = {};
      
      for (const col of columns) {
          const rawVal = formData[col.name];
          
          // Skip if auto-increment and empty/placeholder
          if (col.is_auto_increment && (!rawVal || rawVal === '')) {
              continue;
          }
          
          if (rawVal === '' && col.is_nullable) {
              dataToSend[col.name] = null;
          } else if (rawVal !== '') {
              // Parse value based on type
              dataToSend[col.name] = parseValue(rawVal, col.data_type);
          }
      }

      await invoke('insert_record', {
        connectionId: activeConnectionId,
        table: tableName,
        data: dataToSend
      });

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Insert failed:', err);
      setError('Failed to insert row: ' + err);
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
          <h2 className="text-lg font-semibold text-white">New Row ({tableName})</h2>
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
          
          {schemaLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500"/></div>
          ) : (
              columns.map((col) => {
                return (
                  <div key={col.name}>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex justify-between">
                      <span>{col.name} <span className="text-slate-600">({col.data_type})</span></span>
                      {col.is_pk && <span className="text-yellow-500 text-[10px] uppercase">Primary Key</span>}
                      {col.is_auto_increment && <span className="text-blue-400 text-[10px] uppercase">Auto</span>}
                    </label>
                    <input
                      value={formData[col.name] || ''}
                      onChange={(e) => handleInputChange(col.name, e.target.value)}
                      placeholder={col.is_auto_increment ? '(Auto-generated)' : col.is_nullable ? 'NULL' : 'Required'}
                      className={`
                        w-full bg-slate-900 border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500
                        ${col.is_auto_increment ? 'border-slate-800 text-slate-400 placeholder:text-slate-600' : 'border-slate-700'}
                      `}
                    />
                  </div>
                );
              })
          )}
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
            <Plus size={16} /> Insert
          </button>
        </div>
      </div>
    </div>
  );
};
