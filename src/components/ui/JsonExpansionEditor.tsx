import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { JsonCodeEditor } from "./JsonCodeEditor";
import {
  formatJsonForEditor,
  parseJsonEditorValue,
  validateJson,
} from "../../utils/json";

interface JsonExpansionEditorProps {
  value: unknown;
  readOnly: boolean;
  onSave: (next: unknown) => void;
  onCancel: () => void;
}

export const JsonExpansionEditor = ({
  value,
  readOnly,
  onSave,
  onCancel,
}: JsonExpansionEditorProps) => {
  const { t } = useTranslation();
  const initial = useMemo(() => formatJsonForEditor(value), [value]);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [prevInitial, setPrevInitial] = useState(initial);

  // Reset draft when the underlying value changes (e.g. user toggled the
  // expansion to a different cell while the previous one was still open).
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setDraft(initial);
    setError(null);
  }

  const isDirty = draft !== initial;
  const hasError = error !== null;

  const handleChange = (next: string) => {
    setDraft(next);
    setError(validateJson(next));
  };

  const handleSave = () => {
    if (hasError) return;
    onSave(parseJsonEditorValue(draft));
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex items-center justify-end gap-2 text-xs">
          {error && (
            <span
              className="text-red-400 mr-auto truncate"
              title={error}
              data-testid="json-expansion-error"
            >
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-secondary hover:text-primary transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={hasError || !isDirty}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            {t("jsonViewer.save")}
          </button>
        </div>
      )}
      <div className="h-[320px] border border-default rounded overflow-hidden">
        <JsonCodeEditor
          value={draft}
          onChange={handleChange}
          readOnly={readOnly}
          height="100%"
        />
      </div>
    </div>
  );
};
