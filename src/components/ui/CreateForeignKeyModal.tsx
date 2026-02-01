import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { SqlPreview } from './SqlPreview';

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
  const { t } = useTranslation();
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
      if (!fkName || !localColumn || !refTable || !refColumn) return '-- ' + t('createFk.sqlPreview');
      
      const q = (driver === 'mysql' || driver === 'mariadb') ? '`' : '"';
      
      // ALTER TABLE child ADD CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES parent (col) ON DELETE ... ON UPDATE ...
      return `ALTER TABLE ${q}${tableName}${q} ADD CONSTRAINT ${q}${fkName}${q} FOREIGN KEY (${q}${localColumn}${q}) REFERENCES ${q}${refTable}${q} (${q}${refColumn}${q}) ON DELETE ${onDelete} ON UPDATE ${onUpdate};`;
  }, [fkName, localColumn, refTable, refColumn, onDelete, onUpdate, tableName, driver, t]);

  const handleCreate = async () => {
      if (!fkName.trim()) { setError(t('createFk.nameRequired')); return; }
      
      if (driver === 'sqlite') {
          setError(t('sidebar.sqliteFkError'));
          return;
      }

      setLoading(true);
      setError('');
      try {
          await invoke('execute_query', { connectionId, query: sqlPreview });
          onSuccess();
          onClose();
      } catch (e) {
          setError(String(e));
      } finally {
          setLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-elevated rounded-xl shadow-2xl w-[600px] border border-strong flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-default bg-surface-secondary/50 rounded-t-xl">
           <h2 className="text-lg font-semibold text-primary">{t('createFk.title')}</h2>
           <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
            {driver === 'sqlite' && (
                <div className="bg-warning-bg border border-warning-border text-warning-text text-xs p-3 rounded flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{t('sidebar.sqliteFkError')}</span>
                </div>
            )}

            <div>
                <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createFk.name')}</label>
                <input
                    value={fkName}
                    onChange={(e) => setFkName(e.target.value)}
                    className="w-full bg-base border border-strong rounded p-2 text-primary text-sm focus:border-focus outline-none font-mono"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createFk.column')}</label>
                    <select 
                        value={localColumn}
                        onChange={(e) => setLocalColumn(e.target.value)}
                        className="w-full bg-base border border-strong rounded p-2 text-primary text-sm outline-none"
                    >
                        {localColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                
                <div>
                    <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createFk.refTable')}</label>
                    <select 
                        value={refTable}
                        onChange={(e) => setRefTable(e.target.value)}
                        className="w-full bg-base border border-strong rounded p-2 text-primary text-sm outline-none"
                    >
                        {tables.map(t_info => <option key={t_info.name} value={t_info.name}>{t_info.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    {/* Empty spacer or mapping visualization */}
                </div>
                <div>
                    <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createFk.refColumn')}</label>
                    {fetchingRefCols ? (
                        <div className="text-xs text-muted flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> {t('common.loading')}</div>
                    ) : (
                        <select 
                            value={refColumn}
                            onChange={(e) => setRefColumn(e.target.value)}
                            className="w-full bg-base border border-strong rounded p-2 text-primary text-sm outline-none"
                        >
                            {refColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                    <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createFk.onUpdate')}</label>
                    <select 
                        value={onUpdate}
                        onChange={(e) => setOnUpdate(e.target.value)}
                        className="w-full bg-base border border-strong rounded p-2 text-primary text-sm outline-none"
                    >
                        {ON_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createFk.onDelete')}</label>
                    <select 
                        value={onDelete}
                        onChange={(e) => setOnDelete(e.target.value)}
                        className="w-full bg-base border border-strong rounded p-2 text-primary text-sm outline-none"
                    >
                        {ON_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>

            <div className="mt-2">
                <div className="text-[10px] text-muted mb-1 uppercase tracking-wider">{t('createFk.sqlPreview')}</div>
                <SqlPreview sql={sqlPreview} height="80px" showLineNumbers={true} />
            </div>

            {error && (
                <div className="text-error-text text-xs bg-error-bg border border-error-border p-2 rounded">
                    {error}
                </div>
            )}
        </div>

        <div className="p-4 bg-surface-secondary/50 border-t border-default rounded-b-xl flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-secondary hover:text-primary hover:bg-surface-secondary font-medium text-sm rounded-lg transition-colors">
             {t('createFk.cancel')}
           </button>
           <button 
             onClick={handleCreate}
             disabled={loading || driver === 'sqlite'}
             className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-primary px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
           >
             {loading && <Loader2 size={16} className="animate-spin" />}
             <Save size={16} /> {t('createFk.create')}
           </button>
        </div>
      </div>
    </div>
  );
};
