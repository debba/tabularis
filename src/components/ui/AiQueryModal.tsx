import { useState, useEffect } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useDatabase } from "../../hooks/useDatabase";
import { useSettings } from "../../hooks/useSettings";

interface AiQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (sql: string) => void;
}

interface TableColumn {
  name: string;
  data_type: string;
}

export const AiQueryModal = ({ isOpen, onClose, onInsert }: AiQueryModalProps) => {
  const { activeConnectionId, tables } = useDatabase();
  const { settings } = useSettings();
  
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaContext, setSchemaContext] = useState<string>("");
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeConnectionId && tables.length > 0) {
      loadSchema();
    }
  }, [isOpen, activeConnectionId, tables]);

  const loadSchema = async () => {
    setIsSchemaLoading(true);
    setError(null);
    try {
      // Parallel fetch of columns for all tables
      // Limit to first 20 tables to prevent massive overhead for now
      // TODO: Implement smart schema selection or backend-side schema dump
      const tablesToFetch = tables.slice(0, 20); 
      
      const promises = tablesToFetch.map(async (table) => {
        const cols = await invoke<TableColumn[]>("get_columns", {
          connectionId: activeConnectionId,
          tableName: table.name,
        });
        return `Table: ${table.name} (${cols.map(c => `${c.name} ${c.data_type}`).join(", ")})`;
      });

      const schemas = await Promise.all(promises);
      let context = schemas.join("\n");
      
      if (tables.length > 20) {
          context += `\n... and ${tables.length - 20} more tables (names: ${tables.slice(20).map(t => t.name).join(", ")})`;
      }
      
      setSchemaContext(context);
    } catch (err) {
      console.error("Failed to load schema:", err);
      setError("Failed to load database schema context");
    } finally {
      setIsSchemaLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !settings.aiProvider) {
        setError("Please configure AI provider in Settings and enter a prompt.");
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const sql = await invoke<string>("generate_ai_query", {
        req: {
          provider: settings.aiProvider,
          model: settings.aiModel || "", // Default fallback handled by backend (first model in list)
          prompt,
          schema: schemaContext
        }
      });
      onInsert(sql);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[600px] shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-medium">
            <Sparkles size={18} className="text-yellow-400" />
            <span>AI Query Assist</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!settings.aiProvider && (
             <div className="bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 px-4 py-3 rounded text-sm">
                ⚠️ AI Provider not configured. Please go to Settings {'>'} AI.
             </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Describe your query in natural language
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Find all users who signed up last month and ordered a 'Premium' plan..."
              className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              autoFocus
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleGenerate();
                  }
              }}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/10 p-2 rounded border border-red-900/30">
              {error}
            </div>
          )}

          {isSchemaLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" />
                Reading database schema...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim() || !settings.aiProvider}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate SQL
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
