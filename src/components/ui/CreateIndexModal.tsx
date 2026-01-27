import { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface CreateIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  connectionId: string;
  tableName: string;
  driver: string;
}

interface TableColumn {
    name: string;
}

export const CreateIndexModal = ({
  isOpen,
  onClose,
  onSuccess,
  connectionId,
  tableName,
  driver
}: CreateIndexModalProps) => {
  const [indexName, setIndexName] = useState('');
  const [isUnique, setIsUnique] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [availableColumns, setAvailableColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCols, setFetchingCols] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
        setFetchingCols(true);
        setIndexName(`idx_${tableName}_`);
        setSelectedColumns([]);
        setIsUnique(false);
        setError('');
        
        invoke<TableColumn[]>('get_columns', { connectionId, tableName })
            .then(cols => setAvailableColumns(cols))
            .catch(e => console.error(e))
            .finally(() => setFetchingCols(false));
    }
  }, [isOpen, connectionId, tableName]);

  const toggleColumn = (colName: string) => {
      if (selectedColumns.includes(colName)) {
          setSelectedColumns(selectedColumns.filter(c => c !== colName));
      } else {
          setSelectedColumns([...selectedColumns, colName]);
      }
  };

  const sqlPreview = useMemo(() => {
      if (!indexName || selectedColumns.length === 0) return '-- Define index details';
      
      const q = (driver === 'mysql' || driver === 'mariadb') ? '`' : '"';
      const cols = selectedColumns.map(c => `${q}${c}${q}`).join(', ');
      
      if (driver === 'mysql' || driver === 'mariadb') {
          // MySQL: CREATE [UNIQUE] INDEX index_name ON table (cols)
          return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${q}${indexName}${q} ON ${q}${tableName}${q} (${cols});`;
      } else {
          // Postgres/SQLite: CREATE [UNIQUE] INDEX [CONCURRENTLY?] index_name ON table (cols)
          return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${q}${indexName}${q} ON ${q}${tableName}${q} (${cols});`;
      }
  }, [indexName, isUnique, selectedColumns, driver, tableName]);

  const handleCreate = async () => {
      if (!indexName.trim()) { setError('Index name is required'); return; }
      if (selectedColumns.length === 0) { setError('Select at least one column'); return; }
      
      setLoading(true);
      setError('');
      try {
          await invoke('execute_query', { connectionId, query: sqlPreview });
          onSuccess();
          onClose();
      } catch (e: any) {
          setError(e.toString());
      } finally {
          setLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[500px] border border-slate-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 rounded-t-xl">
           <h2 className="text-lg font-bold text-white">Create Index</h2>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Index Name</label>
                <input 
                    value={indexName}
                    onChange={(e) => setIndexName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none font-mono"
                    placeholder="idx_table_column"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Columns</label>
                {fetchingCols ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Loader2 size={14} className="animate-spin" /> Loading columns...
                    </div>
                ) : (
                    <div className="border border-slate-700 rounded-lg bg-slate-950/50 max-h-40 overflow-y-auto p-2 flex flex-col gap-1">
                        {availableColumns.map(col => (
                            <label key={col.name} className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={selectedColumns.includes(col.name)}
                                    onChange={() => toggleColumn(col.name)}
                                    className="accent-blue-500"
                                />
                                <span className={`text-sm font-mono ${selectedColumns.includes(col.name) ? 'text-blue-300' : 'text-slate-300'}`}>
                                    {col.name}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="checkbox"
                    id="isUnique"
                    checked={isUnique}
                    onChange={(e) => setIsUnique(e.target.checked)}
                    className="accent-blue-500"
                />
                <label htmlFor="isUnique" className="text-sm text-slate-300 select-none cursor-pointer">
                    Unique Index
                </label>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded p-3 mt-2">
                <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">SQL Preview</div>
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">{sqlPreview}</pre>
            </div>

            {error && (
                <div className="text-red-400 text-xs bg-red-900/10 border border-red-900/30 p-2 rounded">
                    {error}
                </div>
            )}
        </div>

        <div className="p-4 bg-slate-800/50 border-t border-slate-800 rounded-b-xl flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white font-medium text-sm transition-colors">
             Cancel
           </button>
           <button 
             onClick={handleCreate}
             disabled={loading || selectedColumns.length === 0}
             className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
           >
             {loading && <Loader2 size={16} className="animate-spin" />}
             <Save size={16} /> Create
           </button>
        </div>
      </div>
    </div>
  );
};
