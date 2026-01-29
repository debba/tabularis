import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { X, Check, Copy, Cpu } from "lucide-react";
import { message } from "@tauri-apps/plugin-dialog";

interface McpStatus {
  installed: boolean;
  config_path: string | null;
  executable_path: string;
}

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpModal = ({ isOpen, onClose }: McpModalProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await invoke<McpStatus>("get_mcp_status");
      setStatus(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    try {
      await invoke("install_mcp_config");
      await message(t("mcp.successMsg"), {
        kind: "info",
        title: t("mcp.successTitle")
      });
      loadStatus();
    } catch (e) {
      await message(String(e), { kind: "error", title: t("mcp.errorTitle") });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
                <Cpu size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{t("mcp.title")}</h2>
              <p className="text-xs text-slate-400">{t("mcp.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
            
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-300 leading-relaxed">
                    {t("mcp.description")}
                </p>
            </div>

            {loading ? (
                <div className="text-center py-8 text-slate-500">{t("mcp.checking")}</div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${status?.installed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`} />
                            <div>
                                <div className="font-medium text-slate-200">{t("mcp.configPath")}</div>
                                <div className="text-xs text-slate-500 font-mono mt-1">
                                    {status?.config_path || t("mcp.notFound")}
                                </div>
                            </div>
                        </div>
                        {status?.installed ? (
                            <div className="flex items-center gap-2 text-green-400 bg-green-900/20 px-3 py-1 rounded-full text-xs font-medium border border-green-900/50">
                                <Check size={14} />
                                <span>{t("mcp.installed")}</span>
                            </div>
                        ) : (
                            <button 
                                onClick={handleInstall}
                                disabled={!status?.config_path}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
                            >
                                {t("mcp.install")}
                            </button>
                        )}
                    </div>

                    {!status?.installed && (
                        <div className="space-y-2">
                             <label className="text-xs uppercase font-bold text-slate-500">{t("mcp.manualConfig")}</label>
                             <div className="relative group">
                                <pre className="bg-black/80 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
{JSON.stringify({
  "mcpServers": {
    "tabularis": {
      "command": status?.executable_path || "tabularis",
      "args": ["--mcp"]
    }
  }
}, null, 2)}
                                </pre>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify({
                                        "mcpServers": {
                                            "tabularis": {
                                                "command": status?.executable_path,
                                                "args": ["--mcp"]
                                            }
                                        }
                                    }, null, 2))}
                                    className="absolute top-2 right-2 p-2 bg-slate-800 text-slate-400 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Copy size={14} />
                                </button>
                             </div>
                             <p className="text-xs text-slate-500">
                                {t("mcp.manualText")}
                             </p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
            <button
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
                {t("common.close")}
            </button>
        </div>
      </div>
    </div>
  );
};
