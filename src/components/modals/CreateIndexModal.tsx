import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { SqlPreview } from '../ui/SqlPreview';
import { useDatabase } from '../../hooks/useDatabase';

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
  const { t } = useTranslation();
  const { activeSchema } = useDatabase();
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
        
        invoke<TableColumn[]>('get_columns', { connectionId, tableName, ...(activeSchema ? { schema: activeSchema } : {}) })
            .then(cols => setAvailableColumns(cols))
            .catch(e => console.error(e))
            .finally(() => setFetchingCols(false));
    }
  }, [isOpen, connectionId, tableName, activeSchema]);

  const toggleColumn = (colName: string) => {
      if (selectedColumns.includes(colName)) {
          setSelectedColumns(selectedColumns.filter(c => c !== colName));
      } else {
          setSelectedColumns([...selectedColumns, colName]);
      }
  };

  const [sqlPreview, setSqlPreview] = useState('-- ...');

  const generatePreview = useCallback(async () => {
    if (!indexName || selectedColumns.length === 0) {
      setSqlPreview('-- ' + t('createIndex.nameRequired'));
      return;
    }
    try {
      const stmts = await invoke<string[]>('get_create_index_sql', {
        connectionId,
        table: tableName,
        indexName,
        columns: selectedColumns,
        isUnique,
        ...(activeSchema ? { schema: activeSchema } : {}),
      });
      setSqlPreview(stmts.map(s => s + ';').join('\n'));
    } catch (e) {
      setSqlPreview('-- ' + String(e));
    }
  }, [indexName, isUnique, selectedColumns, connectionId, tableName, activeSchema, t]);

  useEffect(() => {
    const timer = setTimeout(generatePreview, 300);
    return () => clearTimeout(timer);
  }, [generatePreview]);

  const handleCreate = async () => {
      if (!indexName.trim()) { setError(t('createIndex.nameRequired')); return; }
      if (selectedColumns.length === 0) { setError(t('createIndex.colRequired')); return; }

      setLoading(true);
      setError('');
      try {
          const stmts = await invoke<string[]>('get_create_index_sql', {
            connectionId,
            table: tableName,
            indexName,
            columns: selectedColumns,
            isUnique,
            ...(activeSchema ? { schema: activeSchema } : {}),
          });
          for (const sql of stmts) {
            await invoke('execute_query', {
              connectionId,
              query: sql,
              ...(activeSchema ? { schema: activeSchema } : {}),
            });
          }
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
      <div className="bg-elevated rounded-xl shadow-2xl w-[500px] border border-strong flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-default bg-surface-secondary/50 rounded-t-xl">
           <h2 className="text-lg font-semibold text-primary">{t('createIndex.title')}</h2>
           <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
            <div>
                <label className="block text-xs font-semibold text-secondary mb-1 uppercase">{t('createIndex.name')}</label>
                <input
                    value={indexName}
                    onChange={(e) => setIndexName(e.target.value)}
                    className="w-full bg-base border border-strong rounded p-2 text-primary text-sm focus:border-focus outline-none font-mono"
                    placeholder="idx_table_column"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-xs font-semibold text-secondary mb-2 uppercase">{t('createIndex.columns')}</label>
                {fetchingCols ? (
                    <div className="flex items-center gap-2 text-muted text-sm">
                        <Loader2 size={14} className="animate-spin" /> {t('common.loading')}
                    </div>
                ) : (
                    <div className="border border-strong rounded-lg bg-base/50 max-h-40 overflow-y-auto p-2 flex flex-col gap-1">
                        {availableColumns.map(col => (
                            <label key={col.name} className="flex items-center gap-2 p-1.5 hover:bg-surface-secondary rounded cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={selectedColumns.includes(col.name)}
                                    onChange={() => toggleColumn(col.name)}
                                    className="accent-blue-500"
                                />
                                <span className={`text-sm font-mono ${selectedColumns.includes(col.name) ? 'text-accent-primary' : 'text-secondary'}`}>
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
                <label htmlFor="isUnique" className="text-sm text-secondary select-none cursor-pointer">
                    {t('createIndex.unique')}
                </label>
            </div>

            <div className="mt-2">
                <div className="text-[10px] text-muted mb-1 uppercase tracking-wider">{t('createIndex.sqlPreview')}</div>
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
             {t('createIndex.cancel')}
           </button>
           <button
             onClick={handleCreate}
             disabled={loading || selectedColumns.length === 0}
             className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-primary px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
           >
             {loading && <Loader2 size={16} className="animate-spin" />}
             <Save size={16} /> {t('createIndex.create')}
           </button>
        </div>
      </div>
    </div>
  );
};
