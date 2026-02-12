import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Key } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../hooks/useDatabase';

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

interface SchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  schema?: string | null;
}

export const SchemaModal = ({ isOpen, onClose, tableName, schema }: SchemaModalProps) => {
  const { t } = useTranslation();
  const { activeConnectionId, activeSchema } = useDatabase();
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const resolvedSchema = schema ?? activeSchema;

  useEffect(() => {
    if (!isOpen || !activeConnectionId || !tableName) return;
    
    const loadSchema = async () => {
      setLoading(true);
      try {
        const cols = await invoke<TableColumn[]>('get_columns', {
          connectionId: activeConnectionId,
          tableName,
          ...(resolvedSchema ? { schema: resolvedSchema } : {}),
        });
        setColumns(cols);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    void loadSchema();
  }, [isOpen, activeConnectionId, tableName, resolvedSchema]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-secondary rounded-lg shadow-xl w-[600px] border border-strong flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-strong">
          <h2 className="text-lg font-semibold text-white">{t('schema.title', { table: tableName })}</h2>
          <button onClick={onClose} className="text-secondary hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-secondary">
              <Loader2 size={24} className="animate-spin" />
              <span>{t('schema.loading')}</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-elevated sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold text-secondary border-b border-strong">{t('schema.colName')}</th>
                  <th className="px-4 py-2 text-xs font-semibold text-secondary border-b border-strong">{t('schema.colType')}</th>
                  <th className="px-4 py-2 text-xs font-semibold text-secondary border-b border-strong text-center">{t('schema.colNullable')}</th>
                  <th className="px-4 py-2 text-xs font-semibold text-secondary border-b border-strong text-center">{t('schema.colKey')}</th>
                </tr>
              </thead>
              <tbody>
                {columns.map(col => (
                  <tr key={col.name} className="border-b border-default hover:bg-surface-tertiary/50">
                    <td className="px-4 py-2 text-sm text-primary font-mono">{col.name}</td>
                    <td className="px-4 py-2 text-sm text-blue-300 font-mono">{col.data_type}</td>
                    <td className="px-4 py-2 text-sm text-secondary text-center">
                      {col.is_nullable ? t('schema.yes') : t('schema.no')}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {col.is_pk && <Key size={14} className="text-yellow-500 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
