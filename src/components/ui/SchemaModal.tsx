import { useState, useEffect } from 'react';
import { X, Loader2, Key } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../contexts/DatabaseContext';

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
}

export const SchemaModal = ({ isOpen, onClose, tableName }: SchemaModalProps) => {
  const { activeConnectionId } = useDatabase();
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeConnectionId && tableName) {
      setLoading(true);
      invoke<TableColumn[]>('get_columns', { 
        connectionId: activeConnectionId, 
        tableName 
      })
      .then(setColumns)
      .catch(console.error)
      .finally(() => setLoading(false));
    }
  }, [isOpen, activeConnectionId, tableName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-[600px] border border-slate-700 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Schema: {tableName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <span>Loading schema...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase border-b border-slate-700">Name</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase border-b border-slate-700">Type</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase border-b border-slate-700 text-center">Nullable</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase border-b border-slate-700 text-center">Key</th>
                </tr>
              </thead>
              <tbody>
                {columns.map(col => (
                  <tr key={col.name} className="border-b border-slate-800 hover:bg-slate-700/50">
                    <td className="px-4 py-2 text-sm text-slate-200 font-mono">{col.name}</td>
                    <td className="px-4 py-2 text-sm text-blue-300 font-mono">{col.data_type}</td>
                    <td className="px-4 py-2 text-sm text-slate-400 text-center">
                      {col.is_nullable ? 'YES' : 'NO'}
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
