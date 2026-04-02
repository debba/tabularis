import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { List } from "lucide-react";
import type { NotebookCell } from "../../types/notebook";
import { extractOutline } from "../../utils/notebookOutline";

interface NotebookOutlineProps {
  cells: NotebookCell[];
  onScrollToCell: (cellId: string) => void;
}

export function NotebookOutline({
  cells,
  onScrollToCell,
}: NotebookOutlineProps) {
  const { t } = useTranslation();
  const entries = useMemo(() => extractOutline(cells), [cells]);

  if (entries.length === 0) return null;

  return (
    <div className="mb-3 bg-base border border-default rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border-b border-default">
        <List size={12} className="text-muted" />
        <span className="text-[10px] font-semibold uppercase text-muted">
          {t("editor.notebook.outline")}
        </span>
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {entries.map((entry, i) => (
          <button
            key={`${entry.cellId}-${i}`}
            type="button"
            onClick={() => onScrollToCell(entry.cellId)}
            className="block w-full text-left text-xs text-secondary hover:text-primary transition-colors truncate"
            style={{ paddingLeft: `${(entry.level - 1) * 12}px` }}
          >
            {entry.cellType === "sql" && (
              <span className="text-green-400 mr-1">SQL</span>
            )}
            {entry.text}
          </button>
        ))}
      </div>
    </div>
  );
}
