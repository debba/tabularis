import { useState, useEffect } from "react";
import { X, Loader2, BookOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "../../hooks/useSettings";
import MonacoEditor from "@monaco-editor/react";

interface AiExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}

export const AiExplainModal = ({ isOpen, onClose, query }: AiExplainModalProps) => {
  const { settings } = useSettings();
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && query) {
      handleExplain();
    }
    // eslint-disable-next-line
  }, [isOpen, query]);

  const handleExplain = async () => {
    if (!settings.aiProvider) {
        setError("Please configure AI provider in Settings.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setExplanation("");

    try {
      const result = await invoke<string>("explain_ai_query", {
        req: {
          provider: settings.aiProvider,
          model: settings.aiModel || "",
          query,
          language: settings.language === "it" ? "Italian" : "English"
        }
      });
      setExplanation(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[700px] shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-medium">
            <BookOpen size={18} className="text-blue-400" />
            <span>AI Query Explanation</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!settings.aiProvider && (
             <div className="bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 px-4 py-3 rounded text-sm">
                ⚠️ AI Provider not configured. Please go to Settings {'>'} AI.
             </div>
          )}

          {/* Original Query */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Query
            </label>
            <div className="h-32 border border-slate-800 rounded-lg overflow-hidden">
                <MonacoEditor
                    height="100%"
                    language="sql"
                    theme="vs-dark"
                    value={query}
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        wordWrap: 'on'
                    }}
                />
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Explanation
            </label>
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 min-h-[150px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 size={16} className="animate-spin" />
                        Generating explanation...
                    </div>
                ) : error ? (
                    <div className="text-red-400">
                        {error}
                    </div>
                ) : (
                    explanation
                )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
