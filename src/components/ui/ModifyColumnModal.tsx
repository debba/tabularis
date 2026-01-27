import { useState, useMemo, useEffect } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const COMMON_TYPES = [
  'INTEGER', 'BIGINT', 'VARCHAR', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'FLOAT', 'DOUBLE', 'JSON', 'UUID'
];

interface ColumnDef {
  name: string;
  type: string;
  length?: string;
  isNullable: boolean;
  defaultValue?: string;
  isPk: boolean;
  isAutoInc: boolean;
}

interface ModifyColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  connectionId: string;
  tableName: string;
  driver: string;
  // If provided, we are in "Edit" mode. If null, "Add" mode.
  column?: {
    name: string;
    data_type: string;
    is_nullable: boolean;
    is_pk: boolean;
    is_auto_increment: boolean;
  } | null;
}

export const ModifyColumnModal = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    connectionId, 
    tableName, 
    driver,
    column 
}: ModifyColumnModalProps) => {
  const isEdit = !!column;
  
  // Parse initial type/length from column.data_type if possible
  // e.g. "varchar(255)" -> type="VARCHAR", length="255"
  const parseType = (fullType: string) => {
    const match = fullType.match(/^([a-zA-Z0-9_]+)(?:\((.+)\))?$/);
    if (match) {
        return { type: match[1].toUpperCase(), length: match[2] || '' };
    }
    return { type: fullType.toUpperCase(), length: '' };
  };

  const initial = useMemo(() => {
    if (column) {
        const { type, length } = parseType(column.data_type);
        return {
            name: column.name,
            type,
            length,
            isNullable: column.is_nullable,
            defaultValue: '', // We don't have this info easily from get_columns yet
            isPk: column.is_pk || false,
            isAutoInc: column.is_auto_increment || false
        };
    }
    return {
        name: '',
        type: 'VARCHAR',
        length: '255',
        isNullable: true,
        defaultValue: '',
        isPk: false,
        isAutoInc: false
    };
  }, [column]);

  const [form, setForm] = useState<ColumnDef>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/changes
  useEffect(() => {
    setForm(initial);
    setError('');
  }, [initial, isOpen]);

  const sqlPreview = useMemo(() => {
    if (!form.name) return '-- Column name is required';

    const q = (driver === 'mysql' || driver === 'mariadb') ? '`' : '"';
    const typeDef = `${form.type}${form.length ? `(${form.length})` : ''}`;
    const nullableDef = form.isNullable ? (driver === 'mysql' ? 'NULL' : '') : 'NOT NULL'; // MySQL explicit NULL is ok, Postgres default is NULL
    const defaultDef = form.defaultValue ? `DEFAULT ${!isNaN(Number(form.defaultValue)) ? form.defaultValue : `'${form.defaultValue}'`}` : '';
    
    // Constraints logic
    let constraintsDef = '';
    
    // ADD COLUMN logic
    if (!isEdit) {
         if (driver === 'mysql' || driver === 'mariadb') {
             if (form.isPk) constraintsDef += ' PRIMARY KEY';
             if (form.isAutoInc) constraintsDef += ' AUTO_INCREMENT';
         } else if (driver === 'sqlite') {
             if (form.isPk) {
                 constraintsDef += ' PRIMARY KEY';
                 if (form.isAutoInc) constraintsDef += ' AUTOINCREMENT';
             }
         } else if (driver === 'postgres') {
             if (form.isPk) constraintsDef += ' PRIMARY KEY';
             // Postgres AUTO_INCREMENT is handled via type (SERIAL/BIGSERIAL) usually, or GENERATED. 
             // Logic below handles type change for SERIAL.
         }
    }
    
    // Type override for Postgres AutoInc
    let finalType = typeDef;
    if (driver === 'postgres' && form.isAutoInc && !isEdit) {
        if (form.type === 'INTEGER') finalType = 'SERIAL';
        if (form.type === 'BIGINT') finalType = 'BIGSERIAL';
    }

    // Combine definitions
    
    if (!isEdit) {
        // ADD COLUMN
        // Note: SQLite ADD COLUMN does not support PRIMARY KEY or UNIQUE constraints usually (unless simple).
        // Postgres ADD COLUMN allows PRIMARY KEY.
        return `ALTER TABLE ${q}${tableName}${q} ADD COLUMN ${q}${form.name}${q} ${finalType} ${nullableDef} ${defaultDef}${constraintsDef};`;
    } else {
        // MODIFY COLUMN
        if (driver === 'mysql' || driver === 'mariadb') {
            // MySQL: ALTER TABLE t CHANGE old new def [constraints]
            // Re-build full definition including constraints
            let mysqlConstraints = '';
            if (form.isAutoInc) mysqlConstraints += ' AUTO_INCREMENT';
            // Note: PRIMARY KEY in MySQL MODIFY/CHANGE is tricky if it already exists. 
            // Usually you use ADD PRIMARY KEY or DROP PRIMARY KEY.
            // But if it's a single column PK change, sometimes it works? 
            // Safer to warn or just omit PK from CHANGE and let user manage keys separately?
            // For now, let's omit PK in CHANGE unless we are sure. 
            // But AUTO_INCREMENT requires Key.
            
            // If name is same, use MODIFY COLUMN to avoid repetition and potential confusion
            if (column?.name === form.name) {
                return `ALTER TABLE ${q}${tableName}${q} MODIFY COLUMN ${q}${form.name}${q} ${finalType} ${nullableDef} ${defaultDef}${mysqlConstraints};`;
            } else {
                return `ALTER TABLE ${q}${tableName}${q} CHANGE ${q}${column?.name}${q} ${q}${form.name}${q} ${finalType} ${nullableDef} ${defaultDef}${mysqlConstraints};`;
            }
        } else if (driver === 'postgres') {
            // Postgres
            const statements = [];
            
            // Rename
            if (column?.name !== form.name) {
                statements.push(`ALTER TABLE ${q}${tableName}${q} RENAME COLUMN ${q}${column?.name}${q} TO ${q}${form.name}${q};`);
            }
            
            // Type
            const { type: oldType } = parseType(column?.data_type || '');
            if (oldType !== form.type || parseType(column?.data_type || '').length !== form.length) {
                 statements.push(`ALTER TABLE ${q}${tableName}${q} ALTER COLUMN ${q}${form.name}${q} TYPE ${finalType} USING ${q}${form.name}${q}::${form.type};`);
            }
            
            // Nullable
            if (column?.is_nullable !== form.isNullable) {
                statements.push(`ALTER TABLE ${q}${tableName}${q} ALTER COLUMN ${q}${form.name}${q} ${form.isNullable ? 'DROP' : 'SET'} NOT NULL;`);
            }
            
            // Default
            if (form.defaultValue) {
                 statements.push(`ALTER TABLE ${q}${tableName}${q} ALTER COLUMN ${q}${form.name}${q} SET ${defaultDef};`);
            }
            
            // PK / AutoInc not supported well in MODIFY for Postgres here (requires sequence manipulation / constraint management)
            
            if (statements.length === 0) return '-- No changes detected';
            return statements.join('\n');
        } else if (driver === 'sqlite') {
            return '-- SQLite modification is limited. Rename only supported via RENAME COLUMN.\n-- Full modification requires table recreation.';
        }
    }
    return '-- Unsupported driver';
  }, [form, driver, isEdit, tableName, column]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
        setError('Column name is required');
        return;
    }
    setLoading(true);
    setError('');

    try {
        if (driver === 'sqlite' && isEdit && form.name !== column?.name) {
             // Special case for SQLite Rename
             const q = '"';
             await invoke('execute_query', {
                 connectionId,
                 query: `ALTER TABLE ${q}${tableName}${q} RENAME COLUMN ${q}${column?.name}${q} TO ${q}${form.name}${q}`
             });
        } else if (driver === 'sqlite' && isEdit) {
            throw new Error('SQLite only supports renaming columns. For other changes, please recreate the table.');
        } else {
            // Run the generated SQL
            // Postgres might generate multiple statements joined by \n
            // The backend execute_query might handle one at a time or script?
            // Usually execute_query runs one statement. If we have multiple for Postgres, we need to split or run them sequentially.
            // My backend currently executes strictly one statement usually unless split. 
            // Let's assume splitQueries logic on frontend or sequential calls.
            
            if (driver === 'postgres' && isEdit) {
                 const statements = sqlPreview.split('\n').filter(s => s.trim() && !s.startsWith('--'));
                 for (const sql of statements) {
                     await invoke('execute_query', { connectionId, query: sql });
                 }
            } else {
                await invoke('execute_query', { connectionId, query: sqlPreview });
            }
        }
        
        onSuccess();
        onClose();
    } catch (e: any) {
        console.error(e);
        setError('Failed: ' + (e.message || String(e)));
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[500px] border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 rounded-t-xl">
           <h2 className="text-lg font-bold text-white">
             {isEdit ? 'Modify Column' : 'Add Column'}
           </h2>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
            {driver === 'sqlite' && isEdit && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 text-xs p-3 rounded flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>SQLite only supports renaming columns. Other modifications require recreating the table manually.</span>
                </div>
            )}

            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Name</label>
                <input 
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none font-mono"
                    placeholder="column_name"
                    autoFocus
                />
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Type</label>
                    <select 
                        value={form.type}
                        onChange={(e) => {
                            const newType = e.target.value;
                            const needsLength = ['VARCHAR', 'CHAR', 'DECIMAL', 'FLOAT', 'DOUBLE'].some(t => newType.includes(t));
                            setForm({
                                ...form, 
                                type: newType,
                                // Clear length if new type doesn't support it, unless it's VARCHAR which defaults to 255 if empty in some contexts, but here we can just clear it or set to default if needed.
                                // User asked: "Su add column mette sempre length 255 anche dove non serve"
                                // So if type changes to INTEGER, length should be cleared.
                                length: needsLength ? (form.length || (newType.includes('VARCHAR') ? '255' : '')) : ''
                            });
                        }}
                        disabled={driver === 'sqlite' && isEdit}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none disabled:opacity-50 appearance-none cursor-pointer hover:bg-slate-900 transition-colors"
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
                </div>
                <div className="w-24">
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Length</label>
                    <input 
                        value={form.length}
                        onChange={(e) => setForm({...form, length: e.target.value})}
                        disabled={(driver === 'sqlite' && isEdit) || !['VARCHAR', 'CHAR', 'DECIMAL', 'FLOAT', 'DOUBLE'].some(t => form.type.includes(t))}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none font-mono disabled:opacity-50"
                        placeholder={form.type.includes('VARCHAR') ? '255' : (['DECIMAL', 'FLOAT', 'DOUBLE'].some(t => form.type.includes(t)) ? '10,2' : '')}
                    />
                </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Default Value</label>
                    <input 
                        value={form.defaultValue}
                        onChange={(e) => setForm({...form, defaultValue: e.target.value})}
                        disabled={driver === 'sqlite' && isEdit}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none font-mono disabled:opacity-50"
                        placeholder="NULL"
                    />
                </div>
            </div>

            <div className="flex gap-6 mt-2">
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox"
                        id="isNullable"
                        checked={!form.isNullable} 
                        onChange={(e) => setForm({...form, isNullable: !e.target.checked})}
                        disabled={driver === 'sqlite' && isEdit}
                        className="accent-blue-500"
                    />
                    <label htmlFor="isNullable" className="text-sm text-slate-300 select-none cursor-pointer">
                        Not Null
                    </label>
                </div>
                
                {/* PK and AutoInc - Only allow for NEW columns or if driver supports easy mod (MySQL) */}
                {/* For existing columns, modifying PK is dangerous/complex usually requiring dropping old PK first. */}
                {/* Let's allow it for ADD COLUMN, or MySQL MODIFY (with care). */}
                {/* For simplicity, disable for EDIT unless we are sure. */}
                {/* MySQL allows changing auto_increment status via MODIFY COLUMN. */}
                {/* Postgres handles Serial via type, but adding PK is separate constraint. */}
                
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox"
                        id="isPk"
                        checked={form.isPk}
                        onChange={(e) => setForm({...form, isPk: e.target.checked})}
                        disabled={isEdit || (driver === 'sqlite' && isEdit)}
                        className="accent-blue-500 disabled:opacity-50"
                    />
                    <label htmlFor="isPk" className={`text-sm select-none cursor-pointer ${isEdit ? 'text-slate-500' : 'text-slate-300'}`}>
                        Primary Key
                    </label>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox"
                        id="isAutoInc"
                        checked={form.isAutoInc}
                        onChange={(e) => setForm({...form, isAutoInc: e.target.checked})}
                        disabled={
                            (isEdit && driver !== 'mysql' && driver !== 'mariadb') || 
                            !['INTEGER', 'BIGINT'].includes(form.type)
                        }
                        className="accent-blue-500 disabled:opacity-50"
                    />
                    <label htmlFor="isAutoInc" className={`text-sm select-none cursor-pointer ${(isEdit && driver !== 'mysql' && driver !== 'mariadb') || !['INTEGER', 'BIGINT'].includes(form.type) ? 'text-slate-500' : 'text-slate-300'}`}>
                        Auto Increment
                    </label>
                </div>
            </div>

            {/* Preview */}
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

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-800 rounded-b-xl flex justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-4 py-2 text-slate-400 hover:text-white font-medium text-sm transition-colors"
           >
             Cancel
           </button>
           <button 
             onClick={handleSubmit}
             disabled={loading || (driver === 'sqlite' && isEdit && form.name === column?.name)}
             className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
           >
             {loading && <Loader2 size={16} className="animate-spin" />}
             <Save size={16} /> {isEdit ? 'Save Changes' : 'Add Column'}
           </button>
        </div>
      </div>
    </div>
  );
};
