import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import { useTheme } from '../../hooks/useTheme';

interface QueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, sql: string) => Promise<void>;
  initialName?: string;
  initialSql?: string;
  title?: string;
}

export const QueryModal = ({ isOpen, onClose, onSave, initialName = '', initialSql = '', title = 'Save Query' }: QueryModalProps) => {
  const [name, setName] = useState(initialName);
  const [sql, setSql] = useState(initialSql);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { currentTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
        setName(initialName);
        setSql(initialSql);
        setError('');
    }
  }, [isOpen, initialName, initialSql]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        setError('Name is required');
        return;
    }
    if (!sql.trim()) {
        setError('SQL content is required');
        return;
    }

    setIsSaving(true);
    try {
        await onSave(name, sql);
        onClose();
    } catch (err) {
        setError(String(err));
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-elevated border border-default rounded-xl shadow-2xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-base border border-strong rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="My Query"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">SQL</label>
            <div className="h-64 w-full border border-strong rounded overflow-hidden">
                <MonacoEditor
                    height="100%"
                    defaultLanguage="sql"
                    theme={currentTheme.id}
                    value={sql}
                    onChange={(val) => setSql(val || '')}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 8 },
                        wordWrap: 'on',
                    }}
                />
            </div>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-secondary hover:text-white hover:bg-surface-secondary rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
