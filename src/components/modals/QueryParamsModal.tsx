import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { useTranslation } from "react-i18next";

interface QueryParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  parameters: string[];
  initialValues: Record<string, string>;
}

export const QueryParamsModal: React.FC<QueryParamsModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  parameters,
  initialValues,
}) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues || {});
    }
  }, [isOpen, initialValues]);

  const handleChange = (param: string, value: string) => {
    setValues((prev) => ({ ...prev, [param]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[500px] flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            {t("editor.queryParameters")}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {parameters.map((param) => (
              <div key={param} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400 font-mono">
                  :{param}
                </label>
                <input
                  type="text"
                  value={values[param] || ""}
                  onChange={(e) => handleChange(param, e.target.value)}
                  placeholder="Value (e.g. 'text' or 123)"
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  autoFocus={parameters[0] === param}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
            >
              <Save size={16} fill="currentColor" />
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
