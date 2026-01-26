import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Save, Code, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../contexts/DatabaseContext';

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

  const generateSql = () => {
    if (!tableName.trim()) return '-- Table name is required';
    if (columns.length === 0) return '-- At least one column is required';

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
  };

  const sqlPreview = useMemo(() => generateSql(), [tableName, columns, currentDriver]);

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

  const updateColumn = (id: string, field: keyof ColumnDef, value: any) => {
    setColumns(columns.map(c => {
      if (c.id !== id) return c;
      return { ...c, [field]: value };
    }));
  };

  const handleCreate = async () => {
    if (!tableName.trim()) {
        setError('Table name is required');
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
    } catch (e: any) {
        console.error(e);
        setError('Failed to create table: ' + e);
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[900px] border border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 rounded-t-xl">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-600/30">
                <Plus className="text-blue-400" size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white">Create New Table</h2>
                <p className="text-xs text-slate-400 font-mono">{currentDriver.toUpperCase()}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
            
            {/* Table Name */}
            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Table Name</label>
                <input 
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
                    placeholder="e.g. users, orders, products"
                    autoFocus
                />
            </div>

            {/* Columns Grid */}
            <div className="flex-1 flex flex-col min-h-0 border border-slate-700 rounded-lg bg-slate-950/50 overflow-hidden">
                <div className="bg-slate-900/80 p-2 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300">Columns</h3>
                    <button onClick={handleAddColumn} className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors">
                        <Plus size={12} /> Add Column
                    </button>
                </div>
                
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/50 sticky top-0 z-10">
                            <tr>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-8"></th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold">Name</th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-32">Type</th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-20">Len</th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-10 text-center" title="Primary Key">PK</th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-10 text-center" title="Not Null">NN</th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-10 text-center" title="Auto Increment">AI</th>
                                <th className="p-2 text-[10px] uppercase text-slate-500 font-semibold w-32">Default</th>
                                <th className="p-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((col) => (
                                <tr key={col.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
                                    <td className="p-2 text-center text-slate-600 text-xs">
                                        ⋮
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            value={col.name}
                                            onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                                            className="w-full bg-transparent text-sm text-white focus:outline-none border-b border-transparent focus:border-blue-500 font-mono placeholder:text-slate-600"
                                            placeholder="col_name"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <select 
                                            value={col.type}
                                            onChange={(e) => updateColumn(col.id, 'type', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-slate-700 transition-colors"
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
                                            className="w-full bg-transparent text-xs text-slate-300 focus:outline-none border-b border-transparent focus:border-blue-500 text-center"
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
                                            className="w-full bg-transparent text-xs text-slate-300 focus:outline-none border-b border-transparent focus:border-blue-500"
                                            placeholder="NULL"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <button 
                                            onClick={() => handleRemoveColumn(col.id)}
                                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    className="text-xs text-slate-500 hover:text-blue-400 flex items-center gap-2 self-start font-medium"
                >
                    <Code size={14} />
                    {showSqlPreview ? 'Hide SQL Preview' : 'Show SQL Preview'}
                </button>
                
                {showSqlPreview && (
                    <div className="h-32 bg-slate-950 rounded-lg border border-slate-800 p-3 overflow-auto">
                        <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{sqlPreview}</pre>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-200 text-sm p-3 rounded-lg animate-in fade-in">
                    {error}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-800 rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white font-medium text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={loading || !tableName.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <Save size={16} /> Create Table
          </button>
        </div>
      </div>
    </div>
  );
};
