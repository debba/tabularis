import { X, Play } from 'lucide-react';

interface QuerySelectionModalProps {
  isOpen: boolean;
  queries: string[];
  onSelect: (query: string) => void;
  onClose: () => void;
}

export const QuerySelectionModal = ({ isOpen, queries, onSelect, onClose }: QuerySelectionModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-elevated border border-default rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default">
          <h3 className="text-lg font-semibold text-white">Select Query to Execute</h3>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {queries.map((q, i) => (
            <div 
              key={i}
              onClick={() => onSelect(q)}
              className="p-3 bg-surface-secondary/50 hover:bg-surface-secondary border border-strong hover:border-blue-500 rounded-lg cursor-pointer group transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1 bg-blue-900/30 text-blue-400 rounded group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Play size={14} fill="currentColor" />
                </div>
                <pre className="text-sm font-mono text-secondary overflow-hidden whitespace-pre-wrap break-all line-clamp-3">
                  {q}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-default bg-elevated/50 text-xs text-muted flex justify-between">
            <span>{queries.length} queries found</span>
            <span>Esc to cancel</span>
        </div>
      </div>
    </div>
  );
};
