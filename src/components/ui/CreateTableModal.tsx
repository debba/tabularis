import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Save, Code, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../hooks/useDatabase';
import { SqlPreview } from './SqlPreview';

// Common types across DBs (simplified for MVP)
const COMMON_TYPES = [
  'INTEGER', 'BIGINT', 'VARCHAR', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'FLOAT', 'DOUBLE'
];

interface ColumnDef {
  id: string; // Internal ID for React keys
  name: string;
  type: string;
  length: string;
  isPk: boolean;
  isNullable: boolean;
  isAutoInc: boolean;
  defaultValue: string;
}

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTableModal = ({ isOpen, onClose, onSuccess }: CreateTableModalProps) => {
  const { t } = useTranslation();
  const { activeConnectionId, activeDriver } = useDatabase();
  
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: '1', name: 'id', type: 'INTEGER', length: '', isPk: true, isNullable: false, isAutoInc: true, defaultValue: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  // Determine current driver
  const currentDriver = activeDriver || 'sqlite';

  const sqlPreview = useMemo(() => {
    if (!tableName.trim()) return '-- ' + t('createTable.nameRequired');
    if (columns.length === 0) return '-- ' + t('createTable.colRequired');

    const driver = currentDriver;
    let sql = `CREATE TABLE ${driver === 'postgres' ? `"${tableName}"` : `\`${tableName}\``} (\n`;
    
    const colDefs = columns.map(col => {
      let def = `  ${driver === 'postgres' ? `"${col.name}"` : `\`${col.name}\``}`;
      
      // Type mapping / logic
      let type = col.type;
      
      // Driver specific adjustments
      if (driver === 'postgres') {
        if (col.isAutoInc && (type === 'INTEGER' || type === 'BIGINT')) {
          type = type === 'BIGINT' ? 'BIGSERIAL' : 'SERIAL';
        }
      } else if (driver === 'sqlite') {
        if (col.isPk && col.isAutoInc) {
          type = 'INTEGER'; // SQLite requirement for auto_increment
        }
      }

      // Length
      if (col.length && (type.includes('CHAR') || type === 'VARCHAR')) {
        type += `(${col.length})`;
      }

      def += ` ${type}`;

      // Constraints
      if (driver === 'sqlite' && col.isPk) {
         def += ' PRIMARY KEY';
         if (col.isAutoInc) def += ' AUTOINCREMENT';
      } else {
         if (!col.isNullable) def += ' NOT NULL';
         
         if (driver === 'mysql' && col.isAutoInc) def += ' AUTO_INCREMENT';
         
         if (col.defaultValue) {
            const isNum = !isNaN(Number(col.defaultValue));
            def += ` DEFAULT ${isNum ? col.defaultValue : `'${col.defaultValue}'`}`;
         }
      }

      return def;
    });

    sql += colDefs.join(',\n');

    // Primary Keys (Non-SQLite or Composite or Standard)
    if (driver !== 'sqlite') {
      const pks = columns.filter(c => c.isPk).map(c => driver === 'postgres' ? `"${c.name}"` : `\`${c.name}\``);
      if (pks.length > 0) {
        sql += `,\n  PRIMARY KEY (${pks.join(', ')})`;
      }
    }

    sql += '\n);';
    return sql;
  }, [tableName, columns, currentDriver, t]);

  const handleAddColumn = () => {
    setColumns([...columns, {
      id: crypto.randomUUID(),
      name: `col_${columns.length + 1}`,
      type: 'VARCHAR',
      length: '255',
      isPk: false,
      isNullable: true,
      isAutoInc: false,
      defaultValue: ''
    }]);
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(columns.filter(c => c.id !== id));
  };

  const updateColumn = (id: string, field: keyof ColumnDef, value: string | boolean) => {
    setColumns(columns.map(c => {
      if (c.id !== id) return c;
      return { ...c, [field]: value };
    }));
  };

  const handleCreate = async () => {
    if (!tableName.trim()) {
        setError(t('createTable.nameRequired'));
        return;
    }
    setLoading(true);
    setError('');

    try {
        await invoke('execute_query', {
            connectionId: activeConnectionId,
            query: sqlPreview
        });
        onSuccess();
        onClose();
        // Reset state
        setTableName('');
        setColumns([{ id: '1', name: 'id', type: 'INTEGER', length: '', isPk: true, isNullable: false, isAutoInc: true, defaultValue: '' }]);
    } catch (e: unknown) {
        console.error(e);
        setError(t('createTable.failCreate') + (e instanceof Error ? e.message : String(e)));
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-elevated rounded-xl shadow-2xl w-[900px] border border-strong flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default bg-base rounded-t-xl">
          <div className="flex items-center gap-3">
             <div className="bg-blue-900/30 p-2 rounded-lg">
                <Plus className="text-blue-400" size={20} />
             </div>
             <div>
                <h2 className="text-lg font-semibold text-primary">{t('createTable.title')}</h2>
                <p className="text-xs text-secondary font-mono">{currentDriver.toUpperCase()}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
            
            {/* Table Name */}
            <div>
                <label className="block text-xs font-semibold text-secondary mb-1 uppercase tracking-wider">{t('createTable.tableName')}</label>
                <input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="w-full bg-base border border-strong rounded-lg px-4 py-2 text-primary focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
                    placeholder={t('createTable.tableNamePlaceholder')}
                    autoFocus
                />
            </div>

            {/* Columns Grid */}
            <div className="flex-1 flex flex-col min-h-0 border border-strong rounded-lg bg-base/50 overflow-hidden">
                <div className="bg-elevated/80 p-2 border-b border-strong flex items-center justify-between">
                    <h3 className="text-sm font-medium text-secondary">{t('createTable.columns')}</h3>
                    <button onClick={handleAddColumn} className="text-xs bg-surface-secondary hover:bg-surface-tertiary border border-strong text-white px-2 py-1 rounded flex items-center gap-1 transition-colors">
                        <Plus size={12} /> {t('createTable.addColumn')}
                    </button>
                </div>
                
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-elevated/50 sticky top-0 z-10">
                            <tr>
                                <th className="p-2 text-[10px] text-muted font-semibold w-8"></th>
                                <th className="p-2 text-[10px] text-muted font-semibold">{t('createTable.colName')}</th>
                                <th className="p-2 text-[10px] text-muted font-semibold w-32">{t('createTable.colType')}</th>
                                <th className="p-2 text-[10px] text-muted font-semibold w-20">{t('createTable.colLen')}</th>
                                <th className="p-2 text-[10px] text-muted font-semibold w-10 text-center" title="Primary Key">{t('createTable.colPk')}</th>
                                <th className="p-2 text-[10px] text-muted font-semibold w-10 text-center" title="Not Null">{t('createTable.colNn')}</th>
                                <th className="p-2 text-[10px] text-muted font-semibold w-10 text-center" title="Auto Increment">{t('createTable.colAi')}</th>
                                <th className="p-2 text-[10px] text-muted font-semibold w-32">{t('createTable.colDefault')}</th>
                                <th className="p-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((col) => (
                                <tr key={col.id} className="hover:bg-surface-secondary/30 group">
                                    <td className="p-2 w-8"></td>
                                    <td className="p-2">
                                        <input
                                            value={col.name}
                                            onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                                            className="w-full bg-transparent text-sm text-primary focus:outline-none border-b border-transparent focus:border-blue-500 font-mono placeholder:text-muted"
                                            placeholder="col_name"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <select 
                                            value={col.type}
                                            onChange={(e) => updateColumn(col.id, 'type', e.target.value)}
                                            className="w-full bg-surface-secondary border border-strong rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-surface-tertiary transition-colors"
                                            style={{
                                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                              backgroundPosition: `right 0.5rem center`,
                                              backgroundRepeat: `no-repeat`,
                                              backgroundSize: `1.5em 1.5em`,
                                              paddingRight: `2.5rem`
                                            }}
                                        >
                                            {COMMON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            value={col.length}
                                            onChange={(e) => updateColumn(col.id, 'length', e.target.value)}
                                            className="w-full bg-transparent text-xs text-secondary focus:outline-none border-b border-transparent focus:border-blue-500 text-center"
                                            placeholder={col.type.includes('CHAR') ? "255" : "-"}
                                            disabled={!col.type.includes('CHAR')}
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={col.isPk}
                                            onChange={(e) => updateColumn(col.id, 'isPk', e.target.checked)}
                                            className="accent-blue-500"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={!col.isNullable}
                                            onChange={(e) => updateColumn(col.id, 'isNullable', !e.target.checked)}
                                            className="accent-blue-500"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={col.isAutoInc}
                                            onChange={(e) => updateColumn(col.id, 'isAutoInc', e.target.checked)}
                                            disabled={!['INTEGER', 'BIGINT'].includes(col.type)}
                                            className="accent-blue-500"
                                        />
                                    </td>
                                    <td className="p-2">
                                         <input 
                                            value={col.defaultValue}
                                            onChange={(e) => updateColumn(col.id, 'defaultValue', e.target.value)}
                                            className="w-full bg-transparent text-xs text-secondary focus:outline-none border-b border-transparent focus:border-blue-500"
                                            placeholder="NULL"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <button 
                                            onClick={() => handleRemoveColumn(col.id)}
                                            className="text-surface-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SQL Preview Toggle/Area */}
            <div className="flex flex-col gap-2">
                <button 
                    onClick={() => setShowSqlPreview(!showSqlPreview)}
                    className="text-xs text-muted hover:text-blue-400 flex items-center gap-2 self-start font-medium"
                >
                    <Code size={14} />
                    {showSqlPreview ? t('createTable.hideSql') : t('createTable.showSql')}
                </button>
                
                {showSqlPreview && (
                    <SqlPreview sql={sqlPreview} height="128px" showLineNumbers={true} />
                )}
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-200 text-sm p-3 rounded-lg animate-in fade-in">
                    {error}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-base/50 border-t border-default rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary hover:text-primary transition-colors text-sm"
          >
            {t('createTable.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !tableName.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <Save size={16} /> {t('createTable.create')}
          </button>
        </div>
      </div>
    </div>
  );
};
