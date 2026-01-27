import { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface CreateForeignKeyModalProps {
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

interface TableInfo {
    name: string;
}

const ON_ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'];

export const CreateForeignKeyModal = ({
  isOpen,
  onClose,
  onSuccess,
  connectionId,
  tableName,
  driver
}: CreateForeignKeyModalProps) => {
  const [fkName, setFkName] = useState('');
  const [localColumn, setLocalColumn] = useState('');
  const [refTable, setRefTable] = useState('');
  const [refColumn, setRefColumn] = useState('');
  const [onDelete, setOnDelete] = useState('NO ACTION');
  const [onUpdate, setOnUpdate] = useState('NO ACTION');

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [localColumns, setLocalColumns] = useState<TableColumn[]>([]);
  const [refColumns, setRefColumns] = useState<TableColumn[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchingRefCols, setFetchingRefCols] = useState(false);
  const [error, setError] = useState('');

  // Init
  useEffect(() => {
    if (isOpen) {
        setFkName(`fk_${tableName}_`);
        setLocalColumn('');
        setRefTable('');
        setRefColumn('');
        setOnDelete('NO ACTION');
        setOnUpdate('NO ACTION');
        setError('');
        
        // Fetch tables and local columns
        Promise.all([
            invoke<TableInfo[]>('get_tables', { connectionId }),
            invoke<TableColumn[]>('get_columns', { connectionId, tableName })
        ]).then(([tbls, cols]) => {
            setTables(tbls);
            setLocalColumns(cols);
            if (cols.length > 0) setLocalColumn(cols[0].name);
            if (tbls.length > 0) setRefTable(tbls[0].name); // Default first table
        }).catch(e => setError(String(e)));
    }
  }, [isOpen, connectionId, tableName]);

  // Fetch ref columns when refTable changes
  useEffect(() => {
      if (refTable && isOpen) {
          setFetchingRefCols(true);
          invoke<TableColumn[]>('get_columns', { connectionId, tableName: refTable })
            .then(cols => {
                setRefColumns(cols);
                if (cols.length > 0) setRefColumn(cols[0].name);
            })
            .catch(e => console.error(e))
            .finally(() => setFetchingRefCols(false));
      }
  }, [refTable, isOpen, connectionId]);

  // Auto-generate name based on selection
  useEffect(() => {
      if (localColumn && refTable) {
          setFkName(`fk_${tableName}_${refTable}_${localColumn}`);
      }
  }, [localColumn, refTable, tableName]);

  const sqlPreview = useMemo(() => {
      if (!fkName || !localColumn || !refTable || !refColumn) return '-- Define FK details';
      
      const q = (driver === 'mysql' || driver === 'mariadb') ? '`' : '"';
      
      // ALTER TABLE child ADD CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES parent (col) ON DELETE ... ON UPDATE ...
      return `ALTER TABLE ${q}${tableName}${q} ADD CONSTRAINT ${q}${fkName}${q} FOREIGN KEY (${q}${localColumn}${q}) REFERENCES ${q}${refTable}${q} (${q}${refColumn}${q}) ON DELETE ${onDelete} ON UPDATE ${onUpdate};`;
  }, [fkName, localColumn, refTable, refColumn, onDelete, onUpdate, tableName, driver]);

  const handleCreate = async () => {
      if (!fkName.trim()) { setError('FK Name is required'); return; }
      
      if (driver === 'sqlite') {
          setError('SQLite does not support adding Foreign Keys via ALTER TABLE. You must recreate the table.');
          return;
      }

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
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[600px] border border-slate-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 rounded-t-xl">
           <h2 className="text-lg font-bold text-white">Create Foreign Key</h2>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
            {driver === 'sqlite' && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 text-xs p-3 rounded flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>SQLite does not support adding Foreign Keys to existing tables.</span>
                </div>
            )}

            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Constraint Name</label>
                <input 
                    value={fkName}
                    onChange={(e) => setFkName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none font-mono"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Local Column</label>
                    <select 
                        value={localColumn}
                        onChange={(e) => setLocalColumn(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none"
                    >
                        {localColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Referenced Table</label>
                    <select 
                        value={refTable}
                        onChange={(e) => setRefTable(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none"
                    >
                        {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    {/* Empty spacer or mapping visualization */}
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Referenced Column</label>
                    {fetchingRefCols ? (
                        <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Loading...</div>
                    ) : (
                        <select 
                            value={refColumn}
                            onChange={(e) => setRefColumn(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none"
                        >
                            {refColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">On Update</label>
                    <select 
                        value={onUpdate}
                        onChange={(e) => setOnUpdate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none"
                    >
                        {ON_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">On Delete</label>
                    <select 
                        value={onDelete}
                        onChange={(e) => setOnDelete(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none"
                    >
                        {ON_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
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
             disabled={loading || driver === 'sqlite'}
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
