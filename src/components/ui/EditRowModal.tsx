import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../hooks/useDatabase';

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

interface ForeignKey {
    name: string;
    column_name: string;
    ref_table: string;
    ref_column: string;
}

interface EditRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  pkColumn: string;
  rowData: unknown[];
  columns: string[];
  onSaveSuccess: () => void;
}

export const EditRowModal = ({ isOpen, onClose, tableName, pkColumn, rowData, columns, onSaveSuccess }: EditRowModalProps) => {
  const { t } = useTranslation();
  const { activeConnectionId, activeDriver } = useDatabase();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [tableSchema, setTableSchema] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // FK Support
  const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
  const [fkOptions, setFkOptions] = useState<Record<string, { value: unknown, label: string }[]>>({});
  const [loadingFk, setLoadingFk] = useState<Record<string, boolean>>({});
  const [fkErrors, setFkErrors] = useState<Record<string, string>>({});

  const fetchFkOptions = useCallback(async (fk: ForeignKey) => {
      if (!activeConnectionId) return;
      setLoadingFk(prev => ({ ...prev, [fk.column_name]: true }));
      setFkErrors(prev => ({ ...prev, [fk.column_name]: '' }));
      try {
          const q = (activeDriver === 'mysql' || activeDriver === 'mariadb') ? '`' : '"';
          const query = `SELECT * FROM ${q}${fk.ref_table}${q} LIMIT 100`;
          
          const result = await invoke<{ columns: string[], rows: unknown[][] }>('execute_query', { connectionId: activeConnectionId, query });
          
          const options = result.rows.map(rowArray => {
              // Convert row array to object
              const rowObj: Record<string, unknown> = {};
              result.columns.forEach((col, idx) => {
                  rowObj[col] = rowArray[idx];
              });

              let val = rowObj[fk.ref_column];
              if (val === undefined) {
                  const key = Object.keys(rowObj).find(k => k.toLowerCase() === fk.ref_column.toLowerCase());
                  if (key) val = rowObj[key];
              }
              
              const labelParts = Object.entries(rowObj)
                  .filter(([k]) => k !== fk.ref_column && k.toLowerCase() !== fk.ref_column.toLowerCase())
                  .slice(0, 2)
                  .map(([, v]) => String(v));
              const labelText = labelParts.join(' | ');
              
              return { value: val, label: labelText ? `${val} - ${labelText}` : String(val) };
          });
          
          setFkOptions(prev => ({ ...prev, [fk.column_name]: options }));
      } catch (e) {
          console.error(e);
          setFkErrors(prev => ({ ...prev, [fk.column_name]: String(e) }));
      } finally {
          setLoadingFk(prev => ({ ...prev, [fk.column_name]: false }));
      }
  }, [activeConnectionId, activeDriver]);

  // Fetch schema and FKs
  useEffect(() => {
    if (isOpen && activeConnectionId && tableName) {
        Promise.all([
            invoke<TableColumn[]>('get_columns', { connectionId: activeConnectionId, tableName }),
            invoke<ForeignKey[]>('get_foreign_keys', { connectionId: activeConnectionId, tableName })
        ])
        .then(([cols, fks]) => {
            setTableSchema(cols);
            setForeignKeys(fks);
            
            // Fetch options
            fks.forEach(fk => fetchFkOptions(fk));
        })
        .catch(err => {
            console.error('Failed to load schema for edit:', err);
            setError(t('editRow.failLoad'));
        });
    }
  }, [isOpen, activeConnectionId, tableName, fetchFkOptions, t]);

  // Initialize form data from rowData
  useEffect(() => {
    if (isOpen && rowData && columns) {
      const initialData: Record<string, unknown> = {};
      columns.forEach((col, index) => {
        initialData[col] = rowData[index];
      });
      setFormData(initialData);
    }
  }, [isOpen, rowData, columns]);

  if (!isOpen) return null;

  const parseValue = (value: unknown, colName: string) => {
    // Find column definition
    const colDef = tableSchema.find(c => c.name === colName);
    if (!colDef) return value; // Fallback

    const type = colDef.data_type.toLowerCase();
    const strVal = String(value);

    // Handle explicitly numeric types
    if (type.includes('int') || type.includes('serial') || type.includes('dec') || type.includes('numeric') || type.includes('float') || type.includes('double') || type.includes('real')) {
      if (strVal.trim() === '') return null; 
      const num = Number(strVal);
      return isNaN(num) ? value : num;
    }
    
    // Handle booleans
    if (type.includes('bool') || type.includes('tinyint(1)')) {
        if (strVal.toLowerCase() === 'true' || strVal === '1') return true;
        if (strVal.toLowerCase() === 'false' || strVal === '0') return false;
        if (strVal.trim() === '') return null;
        return value; 
    }
    
    return value;
  };

  const handleSave = async () => {
    if (!activeConnectionId) return;
    setLoading(true);
    setError('');

    try {
      // Find PK value
      const pkIndex = columns.indexOf(pkColumn);
      const pkVal = rowData[pkIndex];

      // Identify changes
      const changes = [];
      for (const [col, val] of Object.entries(formData)) {
        const originalVal = rowData[columns.indexOf(col)];
        
        // Loose comparison for string vs number (e.g. input "123" vs 123)
        // But strictly, we should parse 'val' and then compare.
        const parsedVal = parseValue(val, col);
        
        // If parsedVal is same as originalVal, skip
        if (parsedVal !== originalVal) {
             // Edge case: "123" vs 123. parsedVal is 123. originalVal is 123. 123 === 123.
             // Edge case: null vs "". parsedVal might be null?
             changes.push({ col, val: parsedVal });
        }
      }

      if (changes.length === 0) {
        onClose();
        return;
      }

      // Execute updates sequentially
      for (const change of changes) {
        await invoke('update_record', {
          connectionId: activeConnectionId,
          table: tableName,
          pkCol: pkColumn,
          pkVal: pkVal,
          colName: change.col,
          newVal: change.val
        });
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      console.error('Update failed:', err);
      setError(t('editRow.failUpdate') + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (col: string, value: string) => {
    setFormData(prev => ({ ...prev, [col]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-secondary rounded-lg shadow-xl w-[600px] border border-strong flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-strong">
          <h2 className="text-lg font-semibold text-primary">{t('editRow.title')} ({tableName})</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-error-bg border border-error-border text-error-text rounded text-sm">
              {error}
            </div>
          )}

          {columns.map((col) => {
            const isPk = col === pkColumn;
            // Try to find type hint
            const colDef = tableSchema.find(c => c.name === col);
            const typeHint = colDef ? `(${colDef.data_type})` : '';

            return (
              <div key={col}>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {col} <span className="text-surface-tertiary">{typeHint}</span> {isPk && <span className="text-semantic-pk">(PK)</span>}
                </label>
                
                {foreignKeys.find(fk => fk.column_name === col) ? (
                    <div className="relative">
                        <select
                            disabled={isPk}
                            value={String(formData[col] ?? '')}
                            onChange={(e) => handleInputChange(col, e.target.value)}
                            className={`
                                w-full bg-elevated border rounded px-3 py-2 text-primary focus:outline-none focus:border-focus appearance-none cursor-pointer
                                ${isPk ? 'border-default text-muted cursor-not-allowed' : 'border-strong'}
                            `}
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: `right 0.75rem center`,
                              backgroundRepeat: `no-repeat`,
                              backgroundSize: `1.5em 1.5em`,
                              paddingRight: `2.5rem`
                            }}
                        >
                            <option value="">{formData[col] === null ? 'NULL' : (loadingFk[col] ? t('editRow.loading') : t('editRow.selectValue'))}</option>
                            
                            {/* Ensure current value is shown even if not in fetched options */}
                            {formData[col] !== null && formData[col] !== undefined && !fkOptions[col]?.some(o => String(o.value) === String(formData[col])) && (
                                <option value={String(formData[col])}>{String(formData[col])} ({t('editRow.current')})</option>
                            )}

                            {fkOptions[col]?.length > 0 ? (
                                fkOptions[col]?.map((opt, i) => (
                                    <option key={i} value={String(opt.value)}>
                                        {opt.label}
                                    </option>
                                ))
                            ) : (
                                !loadingFk[col] && <option value="" disabled>{fkErrors[col] ? `Error: ${fkErrors[col]}` : t('editRow.noOptions')}</option>
                            )}
                        </select>
                        {loadingFk[col] && <Loader2 size={12} className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
                    </div>
                ) : (
                    <input
                      disabled={isPk} 
                      value={formData[col] === null ? '' : String(formData[col])}
                      onChange={(e) => handleInputChange(col, e.target.value)}
                      className={`
                        w-full bg-elevated border rounded px-3 py-2 text-primary focus:outline-none focus:border-focus
                        ${isPk ? 'border-default text-muted cursor-not-allowed' : 'border-strong'}
                      `}
                      placeholder={formData[col] === null ? 'NULL' : ''}
                    />
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-strong bg-surface-secondary/50 flex justify-end gap-3 rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-secondary hover:text-primary font-medium text-sm"
          >
            {t('editRow.cancel')}
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-primary px-6 py-2 rounded font-medium text-sm flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {t('editRow.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
