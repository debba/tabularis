import { useState, useEffect, useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import {
  Github,
  CheckCircle2,
  Circle,
  Heart,
  Info,
  Code2,
  Settings as SettingsIcon,
  Languages,
  Sparkles,
  Power,
  Palette,
  Type,
  ZoomIn,
  RefreshCw,
  AlertTriangle,
  Download,
  Loader2,
  ScrollText,
  Trash2,
  FileDown,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import { useSettings } from "../hooks/useSettings";
import { useTheme } from "../hooks/useTheme";
import type { AppLanguage, AiProvider } from "../contexts/SettingsContext";
import { DEFAULT_SETTINGS } from "../contexts/SettingsContext";
import { APP_VERSION } from "../version";
import { message, ask, save } from "@tauri-apps/plugin-dialog";
import { AVAILABLE_FONTS, ROADMAP } from "../utils/settings";
import { getProviderLabel } from "../utils/settingsUI";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { useUpdate } from "../hooks/useUpdate";

interface AiKeyStatus {
  configured: boolean;
  fromEnv: boolean;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  target?: string;
}

const LogsTab = () => {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [logSettings, setLogSettings] = useState({ enabled: true, max_size: 1000, current_count: 0 });
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const entries = await invoke<LogEntry[]>("get_logs", {
        request: {
          limit: settings.maxLogEntries || 1000,
          level_filter: levelFilter || null,
        },
      });
      // Reverse to show newest logs first
      setLogs(entries.reverse());
      
      const settings_data = await invoke<{ enabled: boolean; max_size: number; current_count: number }>("get_log_settings");
      setLogSettings(settings_data);
    } catch (e) {
      console.error("Failed to load logs", e);
    } finally {
      setIsLoading(false);
    }
  }, [levelFilter, settings.maxLogEntries]);

  const handleClearLogs = async () => {
    try {
      const confirmed = await ask(t("settings.clearLogsConfirm"), { title: t("common.delete"), kind: "warning" });
      if (!confirmed) return;
      
      await invoke("clear_logs");
      await loadLogs();
    } catch (e) {
      console.error("Failed to clear logs", e);
    }
  };

  const handleExportLogs = async () => {
    try {
      const filePath = await save({
        filters: [{ name: "Log Files", extensions: ["log"] }],
        defaultPath: `tabularis_logs_${new Date().toISOString().split("T")[0]}.log`,
      });

      if (!filePath) return;

      await invoke("export_logs", { filePath });
      await message(t("settings.exportLogsSuccess"), { title: t("common.success"), kind: "info" });
    } catch (e) {
      console.error("Failed to export logs", e);
    }
  };

  const handleToggleLogging = async (enabled: boolean) => {
    try {
      await invoke("set_log_enabled", { enabled });
      updateSetting("loggingEnabled", enabled);
      await loadLogs();
    } catch (e) {
      console.error("Failed to toggle logging", e);
    }
  };

  const handleSetMaxSize = async (size: number) => {
    try {
      await invoke("set_log_max_size", { maxSize: size });
      updateSetting("maxLogEntries", size);
      await loadLogs();
    } catch (e) {
      console.error("Failed to set max size", e);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR": return "text-red-400";
      case "WARN": return "text-yellow-400";
      case "INFO": return "text-blue-400";
      case "DEBUG": return "text-green-400";
      default: return "text-muted";
    }
  };

  const toggleLogExpansion = (index: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const hasQuery = (message: string) => {
    return message.includes("| Query:");
  };

  const extractQuery = (message: string) => {
    const queryMatch = message.match(/\| Query:\s*([\s\S]*)$/);
    return queryMatch ? queryMatch[1].trim() : message;
  };

  return (
    <div className="space-y-6">
      {/* Log Settings */}
      <div className="bg-elevated border border-default rounded-xl p-6">
        <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
          <SettingsIcon size={20} className="text-blue-400" />
          {t("settings.logSettings")}
        </h3>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between bg-base p-4 rounded-lg border border-default">
            <div>
              <div className="text-sm text-primary font-medium">
                {t("settings.enableLogging")}
              </div>
              <div className="text-xs text-muted mt-1">
                {t("settings.enableLoggingDesc")}
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.loggingEnabled !== false}
              onChange={(e) => handleToggleLogging(e.target.checked)}
              className="w-10 h-6 bg-base border border-strong rounded-full appearance-none cursor-pointer relative transition-colors checked:bg-blue-600 checked:border-blue-600 after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4"
            />
          </div>

          {/* Max Entries */}
          <div className="bg-base p-4 rounded-lg border border-default">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-primary font-medium">
                  {t("settings.maxLogEntries")}
                </div>
                <div className="text-xs text-muted mt-1">
                  {t("settings.maxLogEntriesDesc")}
                </div>
              </div>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={settings.maxLogEntries || 1000}
                onChange={(e) => handleSetMaxSize(parseInt(e.target.value) || 1000)}
                className="bg-surface-secondary border border-strong rounded px-3 py-2 text-primary w-24 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="text-xs text-muted">
              {t("settings.currentLogCount")}: <span className="text-primary font-medium">{logSettings.current_count}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-red-900/20 text-secondary hover:text-red-400 border border-strong hover:border-red-900/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 size={16} />
              {t("settings.clearLogs")}
            </button>
            <button
              onClick={handleExportLogs}
              className="flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-secondary hover:text-primary border border-strong rounded-lg text-sm font-medium transition-colors"
            >
              <FileDown size={16} />
              {t("settings.exportLogs")}
            </button>
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw size={16} className={isLoading ? "animate-spin" : ""} />
              {t("settings.refreshLogs")}
            </button>
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-elevated border border-default rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <ScrollText size={20} className="text-green-400" />
            {t("settings.logs")}
          </h3>
          
          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">{t("settings.filterByLevel")}:</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-base border border-strong rounded px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-blue-500"
            >
              <option value="">{t("settings.allLevels")}</option>
              <option value="DEBUG">{t("settings.debug")}</option>
              <option value="INFO">{t("settings.info")}</option>
              <option value="WARN">{t("settings.warn")}</option>
              <option value="ERROR">{t("settings.error")}</option>
            </select>
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-base border border-default rounded-lg overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted">
              {t("settings.noLogs")}
            </div>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-secondary font-medium">{t("settings.logTimestamp")}</th>
                    <th className="text-left px-4 py-2 text-secondary font-medium w-20">{t("settings.logLevel")}</th>
                    <th className="text-left px-4 py-2 text-secondary font-medium">{t("settings.logMessage")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {logs.map((log, i) => {
                    const isExpanded = expandedLogs.has(i);
                    const logHasQuery = hasQuery(log.message);
                    const queryContent = logHasQuery ? extractQuery(log.message) : log.message;
                    const previewMessage = logHasQuery 
                      ? log.message.substring(0, log.message.indexOf("| Query:")).trim() || "Executing query"
                      : log.message;
                    
                    return (
                      <tr key={i} className="hover:bg-surface-secondary/50">
                        <td className="px-4 py-2 text-muted font-mono text-xs whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="px-4 py-2">
                          <span className={clsx("text-xs font-medium", getLevelColor(log.level))}>
                            {log.level.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-primary font-mono text-xs">
                          {logHasQuery ? (
                            <div>
                              <button
                                onClick={() => toggleLogExpansion(i)}
                                className="flex items-center gap-1 hover:text-blue-400 transition-colors text-left"
                              >
                                {isExpanded ? (
                                  <ChevronDown size={14} className="shrink-0" />
                                ) : (
                                  <ChevronRight size={14} className="shrink-0" />
                                )}
                                <span className="break-all">{previewMessage}</span>
                              </button>
                              {isExpanded && (
                                <div className="mt-2 ml-5 p-2 bg-surface-secondary rounded border border-strong">
                                  <div className="text-xs text-muted mb-1">Query:</div>
                                  <pre className="text-xs text-primary whitespace-pre-wrap break-all">{queryContent}</pre>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="break-all">{log.message}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Settings = () => {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const { checkForUpdates, isChecking, updateInfo, error: updateError, isUpToDate } = useUpdate();
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "localization" | "ai" | "updates" | "logs" | "info">(
    "general",
  );
  const [aiKeyStatus, setAiKeyStatus] = useState<Record<string, AiKeyStatus>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [keyInput, setKeyInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [explainPrompt, setExplainPrompt] = useState("");
  
  const { currentTheme, allThemes, setTheme } = useTheme();
  
  // Initialize customFont from settings if it's a custom font
  const [customFont, setCustomFont] = useState(() => {
    const isPredefinedFont = AVAILABLE_FONTS.some(f => f.name === settings.fontFamily);
    return !isPredefinedFont && settings.fontFamily ? settings.fontFamily : "";
  });

  const loadModels = useCallback(async (force: boolean = false) => {
    try {
      const models = await invoke<Record<string, string[]>>("get_ai_models", { forceRefresh: force });
      setAvailableModels(models);
      if (force) {
          await message(t("settings.ai.refreshSuccess"), { title: t("common.success"), kind: "info" });
      }
    } catch (e) {
      console.error("Failed to load AI models", e);
      await message(t("settings.ai.refreshError") + ": " + String(e), { title: t("common.error"), kind: "error" });
    }
  }, [t]);
  
  const loadSystemPrompt = async () => {
    try {
      const prompt = await invoke<string>("get_system_prompt");
      setSystemPrompt(prompt);
    } catch (e) {
      console.error("Failed to load system prompt", e);
    }
  };

  const loadExplainPrompt = async () => {
    try {
      const prompt = await invoke<string>("get_explain_prompt");
      setExplainPrompt(prompt);
    } catch (e) {
      console.error("Failed to load explain prompt", e);
    }
  };

  const handleSavePrompt = async () => {
    try {
      await invoke("save_system_prompt", { prompt: systemPrompt });
      await message("System prompt saved successfully", {
        title: "Success",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), { title: "Error", kind: "error" });
    }
  };

  const handleSaveExplainPrompt = async () => {
    try {
      await invoke("save_explain_prompt", { prompt: explainPrompt });
      await message("Explain prompt saved successfully", {
        title: "Success",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), { title: "Error", kind: "error" });
    }
  };

  const handleResetPrompt = async () => {
    try {
      const defaultPrompt = await invoke<string>("reset_system_prompt");
      setSystemPrompt(defaultPrompt);
      await message("System prompt reset to default", {
        title: "Success",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), { title: "Error", kind: "error" });
    }
  };

  const handleResetExplainPrompt = async () => {
    try {
      const defaultPrompt = await invoke<string>("reset_explain_prompt");
      setExplainPrompt(defaultPrompt);
      await message("Explain prompt reset to default", {
        title: "Success",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), { title: "Error", kind: "error" });
    }
  };

  const checkKeys = async () => {
    try {
      const openai = await invoke<AiKeyStatus>("check_ai_key_status", {
        provider: "openai",
      });
      const anthropic = await invoke<AiKeyStatus>("check_ai_key_status", {
        provider: "anthropic",
      });
      const openrouter = await invoke<AiKeyStatus>("check_ai_key_status", {
        provider: "openrouter",
      });
      const customOpenai = await invoke<AiKeyStatus>("check_ai_key_status", {
        provider: "custom-openai",
      });
      const ollama = { configured: true, fromEnv: false }; // Ollama is always "configured" as it's local
      setAiKeyStatus({ openai, anthropic, openrouter, "custom-openai": customOpenai, ollama });
    } catch (e) {
      console.error("Failed to check keys", e);
    }
  };

  const handleSaveKey = async (provider: string) => {
    if (!keyInput.trim()) return;
    try {
      await invoke("set_ai_key", { provider, key: keyInput });
      await checkKeys();
      setKeyInput("");
      await message("API Key saved securely", {
        title: "Success",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), { title: "Error", kind: "error" });
    }
  };


  useEffect(() => {
    // Initialize settings on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkKeys();
    loadSystemPrompt();
    loadExplainPrompt();
    loadModels(false);
  }, [loadModels]);


  const availableLanguages: Array<{
    id: AppLanguage;
    label: string;
  }> = [
    { id: "auto", label: t("settings.auto") },
    { id: "en", label: t("settings.english") },
    { id: "it", label: t("settings.italian") },
    { id: "es", label: t("settings.spanish") },
  ];

  const providers: Array<{ id: AiProvider; label: string }> = [
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "openrouter", label: "OpenRouter" },
    { id: "ollama", label: "Ollama" },
    { id: "custom-openai", label: "OpenAI Compatible" },
  ];

  return (
    <div className="h-full flex flex-col bg-base">
      {/* Header Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-default bg-elevated">
        <button
          onClick={() => setActiveTab("general")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "general"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <SettingsIcon size={16} />
          {t("settings.general")}
        </button>
        <button
          onClick={() => setActiveTab("appearance")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "appearance"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <Palette size={16} />
          {t("settings.appearance")}
        </button>
        <button
          onClick={() => setActiveTab("localization")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "localization"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <Languages size={16} />
          {t("settings.localization")}
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "ai"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <Sparkles size={16} />
          AI
        </button>
        <button
          onClick={() => setActiveTab("updates")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "updates"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <Download size={16} />
          {t("settings.updates")}
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "logs"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <ScrollText size={16} />
          {t("settings.logs")}
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "info"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <Info size={16} />
          {t("settings.info")}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <SettingsIcon size={20} className="text-blue-400" />
                  {t("settings.dataEditor")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      {t("settings.pageSize")}
                    </label>
                    <p className="text-xs text-muted mb-2">
                      {t("settings.pageSizeDesc")}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={settings.resultPageSize ?? DEFAULT_SETTINGS.resultPageSize}
                        onChange={(e) =>
                          updateSetting(
                            "resultPageSize",
                            parseInt(e.target.value) || DEFAULT_SETTINGS.resultPageSize,
                          )
                        }
                        min="0"
                        className="bg-base border border-strong rounded px-3 py-2 text-primary w-32 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <span className="text-sm text-muted">
                        {t("settings.rows")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ER Diagram Settings */}
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Code2 size={20} className="text-orange-400" />
                  {t("settings.erDiagram")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      {t("settings.erDiagramDefaultLayout")}
                    </label>
                    <p className="text-xs text-muted mb-3">
                      {t("settings.erDiagramDefaultLayoutDesc")}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateSetting("erDiagramDefaultLayout", "LR")}
                        className={clsx(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                          (settings.erDiagramDefaultLayout ?? DEFAULT_SETTINGS.erDiagramDefaultLayout) === "LR"
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                            : "bg-base border-default text-muted hover:border-strong hover:text-primary",
                        )}
                      >
                        {t("erDiagram.horizontal")}
                      </button>
                      <button
                        onClick={() => updateSetting("erDiagramDefaultLayout", "TB")}
                        className={clsx(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                          (settings.erDiagramDefaultLayout ?? DEFAULT_SETTINGS.erDiagramDefaultLayout) === "TB"
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                            : "bg-base border-default text-muted hover:border-strong hover:text-primary",
                        )}
                      >
                        {t("erDiagram.vertical")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Localization Tab */}
          {activeTab === "localization" && (
            <div className="space-y-6">
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Languages size={20} className="text-purple-400" />
                  {t("settings.localization")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      {t("settings.language")}
                    </label>
                    <p className="text-xs text-muted mb-3">
                      {t("settings.languageDesc")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availableLanguages.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => updateSetting("language", lang.id)}
                          className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                            settings.language === lang.id
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                              : "bg-base border-default text-muted hover:border-strong hover:text-primary",
                          )}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Palette size={20} className="text-pink-400" />
                  {t("settings.themeSelection")}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {allThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setTheme(theme.id)}
                      className={clsx(
                        "p-4 rounded-xl border transition-all text-left",
                        currentTheme.id === theme.id
                          ? "bg-surface-secondary border-blue-500 shadow-lg shadow-blue-900/20"
                          : "bg-base border-default hover:border-strong",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-6 h-6 rounded-full border border-strong"
                          style={{
                            background: `linear-gradient(135deg, ${theme.colors.accent.primary} 50%, ${theme.colors.accent.secondary} 50%)`,
                          }}
                        />
                        <span className="text-sm font-medium text-primary">
                          {theme.name}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: theme.colors.bg.base }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: theme.colors.surface.primary }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: theme.colors.accent.primary }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family Selection */}
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Type size={20} className="text-blue-400" />
                  {t("settings.fontFamily")}
                </h3>

                {/* Font Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {AVAILABLE_FONTS.map((font) => (
                    <button
                      key={font.name}
                      onClick={() => updateSetting("fontFamily", font.name)}
                      className={clsx(
                        "p-4 rounded-xl border transition-all text-left",
                        settings.fontFamily === font.name
                          ? "bg-surface-secondary border-blue-500 shadow-lg shadow-blue-900/20"
                          : "bg-base border-default hover:border-strong"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">
                          {font.label}
                        </span>
                        {settings.fontFamily === font.name && (
                          <CheckCircle2 size={16} className="text-blue-500" />
                        )}
                      </div>
                      <p
                        className="text-xs text-muted truncate"
                        style={{ fontFamily: font.name === "System" ? "system-ui, -apple-system, sans-serif" : `"${font.name}", ${font.name}` }}
                      >
                        Aa Bb Cc 123
                      </p>
                    </button>
                  ))}

                  {/* Custom Font Box */}
                  <button
                    onClick={() => {
                      const input = document.getElementById("custom-font-input") as HTMLInputElement;
                      input?.focus();
                    }}
                    className={clsx(
                      "p-4 rounded-xl border transition-all text-left relative",
                      !AVAILABLE_FONTS.some(f => f.name === settings.fontFamily)
                        ? "bg-surface-secondary border-blue-500 shadow-lg shadow-blue-900/20"
                        : "bg-base border-default hover:border-strong"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-primary">
                        {t("settings.fonts.custom")}
                      </span>
                      {!AVAILABLE_FONTS.some(f => f.name === settings.fontFamily) && (
                        <CheckCircle2 size={16} className="text-blue-500" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        id="custom-font-input"
                        type="text"
                        placeholder={t("settings.fonts.customPlaceholder")}
                        value={customFont}
                        onChange={(e) => setCustomFont(e.target.value)}
                        onBlur={() => {
                          if (customFont.trim()) {
                            updateSetting("fontFamily", customFont.trim());
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customFont.trim()) {
                            updateSetting("fontFamily", customFont.trim());
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className={clsx(
                          "w-full bg-base border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-blue-500 transition-colors",
                          !AVAILABLE_FONTS.some(f => f.name === settings.fontFamily) && customFont === settings.fontFamily
                            ? "border-blue-500"
                            : "border-strong"
                        )}
                      />
                      <p
                        className="text-xs text-muted truncate"
                        style={{ fontFamily: customFont || "inherit" }}
                      >
                        {customFont || t("settings.fonts.enterFontName")}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Font Size Selection */}
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <ZoomIn size={20} className="text-green-400" />
                  {t("settings.fontSize")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      {t("settings.fontSizeLabel")}
                    </label>
                    <p className="text-xs text-muted mb-3">
                      {t("settings.fontSizeDesc")}
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="10"
                        max="20"
                        step="1"
                        value={settings.fontSize || 14}
                        onChange={(e) => updateSetting("fontSize", parseInt(e.target.value))}
                        className="flex-1 h-2 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <span className="text-sm font-mono text-primary w-16 text-right">
                        {settings.fontSize || 14}px
                      </span>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-base border border-default rounded-lg p-4">
                    <p className="text-xs text-muted mb-2">{t("settings.preview")}:</p>
                    <p 
                      className="text-primary"
                      style={{ fontSize: `${settings.fontSize || 14}px` }}
                    >
                      Aa Bb Cc 123 - {t("settings.fontPreviewText")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Tab */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Sparkles size={20} className="text-yellow-400" />
                  AI Configuration
                </h3>
                <p className="text-sm text-secondary mb-6">
                  Configure AI providers to enable natural language to SQL
                  generation. Keys are stored securely in your system's
                  keychain.
                </p>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between bg-base/50 p-4 rounded-lg border border-default mb-6">
                  <div className="flex items-center gap-3">
                    <div className={clsx("p-2 rounded-full", settings.aiEnabled ? "bg-green-900/20 text-green-400" : "bg-surface-secondary text-muted")}>
                        <Power size={18} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-primary">{t("settings.ai.enable")}</div>
                        <div className="text-xs text-muted">{t("settings.ai.enableDesc")}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("aiEnabled", !settings.aiEnabled)}
                    className={clsx(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-elevated",
                        settings.aiEnabled ? "bg-blue-600" : "bg-surface-secondary"
                    )}
                  >
                    <span
                        className={clsx(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            settings.aiEnabled ? "translate-x-6" : "translate-x-1"
                        )}
                    />
                  </button>
                </div>

                <div className={clsx("space-y-6 transition-opacity", !settings.aiEnabled && "opacity-50 pointer-events-none")}>
                  {/* Default Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      {t("settings.ai.defaultProvider")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {providers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            updateSetting("aiProvider", p.id);
                            setKeyInput("");
                          }}
                          className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2",
                            settings.aiProvider === p.id
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                              : "bg-base border-default text-muted hover:border-strong hover:text-primary",
                          )}
                        >
                          {p.label}
                          {aiKeyStatus[p.id]?.configured && (
                            <CheckCircle2
                              size={14}
                              className="text-green-400"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Provider Configuration */}
                  {settings.aiProvider && (
                    <div className="bg-base/50 border border-default rounded-lg p-6 space-y-6">
                      <div className="flex items-center gap-2 border-b border-default pb-4">
                        <h4 className="font-semibold text-primary">
                          {getProviderLabel(settings.aiProvider)}
                        </h4>
                        {aiKeyStatus[settings.aiProvider]?.configured ? (
                            <div className="flex items-center gap-2">
                                <span className="text-green-400 flex items-center gap-1 text-xs bg-green-900/10 px-2 py-0.5 rounded-full border border-green-900/20">
                                    <CheckCircle2 size={12} /> {t("settings.ai.configured")}
                                </span>
                                {aiKeyStatus[settings.aiProvider]?.fromEnv && (
                                    <span className="text-blue-400 flex items-center gap-1 text-xs bg-blue-900/10 px-2 py-0.5 rounded-full border border-blue-900/20" title={t("settings.ai.fromEnvTooltip")}>
                                        <Code2 size={12} /> {t("settings.ai.fromEnv")}
                                    </span>
                                )}
                            </div>
                        ) : settings.aiProvider !== 'ollama' && (
                            <span className="text-muted text-xs bg-surface-secondary px-2 py-0.5 rounded-full border border-default">
                            {t("settings.ai.notConfigured")}
                            </span>
                        )}
                      </div>

                      {/* API Key Input (Non-Ollama) */}
                      {settings.aiProvider !== 'ollama' && (
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1">
                                {t("settings.ai.apiKey", { provider: getProviderLabel(settings.aiProvider) })}
                            </label>
                            
                            <div className="flex gap-2">
                                <input
                                type="password"
                                value={keyInput}
                                placeholder={t("settings.ai.enterKey", { provider: getProviderLabel(settings.aiProvider) })}
                                className="flex-1 bg-base border border-strong rounded px-3 py-2 text-primary text-sm focus:outline-none focus:border-blue-500"
                                onChange={(e) => setKeyInput(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSaveKey(settings.aiProvider!)}
                                        disabled={!keyInput.trim()}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-secondary disabled:text-muted text-white rounded text-sm font-medium transition-colors whitespace-nowrap"
                                    >
                                        {t("common.save")}
                                    </button>
                                    
                                    {aiKeyStatus[settings.aiProvider]?.configured && !aiKeyStatus[settings.aiProvider]?.fromEnv && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await invoke("delete_ai_key", { provider: settings.aiProvider });
                                                    await checkKeys();
                                                    await message(t("settings.ai.keyResetSuccess"), { title: t("common.success"), kind: "info" });
                                                } catch (e) {
                                                    await message(String(e), { title: t("common.error"), kind: "error" });
                                                }
                                            }}
                                            className="px-3 py-2 bg-surface-secondary hover:bg-red-900/20 text-secondary hover:text-red-400 border border-strong hover:border-red-900/30 rounded text-sm font-medium transition-colors whitespace-nowrap"
                                            title={t("settings.ai.resetKey")}
                                        >
                                            {t("settings.ai.reset")}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {aiKeyStatus[settings.aiProvider]?.fromEnv && (
                                <p className="text-xs text-blue-400 mt-2 flex items-center gap-1.5">
                                    <Info size={12} />
                                    {t("settings.ai.envVariableDetected")}
                                </p>
                            )}
                            
                            <p className="text-xs text-muted mt-1">
                                {t("settings.ai.keyStoredSecurely")}
                            </p>
                        </div>
                      )}

                       {/* Custom OpenAI Endpoint URL */}
                       {settings.aiProvider === "custom-openai" && (
                           <div>
                               <label className="block text-sm font-medium text-secondary mb-1">
                                   {t("settings.ai.endpointUrl")}
                               </label>
                               <input
                                   type="text"
                                   value={settings.aiCustomOpenaiUrl || ""}
                                   onChange={(e) => updateSetting("aiCustomOpenaiUrl", e.target.value)}
                                   placeholder="https://api.example.com/v1"
                                   className="flex-1 bg-base border border-strong rounded px-3 py-2 text-primary text-sm focus:outline-none focus:border-blue-500 w-full"
                               />
                               <p className="text-xs text-muted mt-1">
                                   {t("settings.ai.endpointUrlDesc")}
                               </p>
                           </div>
                       )}

                        {/* Ollama Configuration */}
                       {settings.aiProvider === 'ollama' && (
                            <div className="space-y-4">
                                <div className={clsx(
                                   "border rounded px-3 py-2 text-sm italic flex items-center gap-2",
                                   (settings.aiCustomModels?.['ollama'] || availableModels['ollama'] || []).length > 0 
                                       ? "bg-green-900/10 border-green-900/20 text-green-400" 
                                       : "bg-red-900/10 border-red-900/20 text-red-400"
                                )}>
                                   {(settings.aiCustomModels?.['ollama'] || availableModels['ollama'] || []).length > 0 ? (
                                       <>
                                           <CheckCircle2 size={14} />
                                           <span>{t("settings.ai.ollamaConnected", { count: (settings.aiCustomModels?.['ollama'] || availableModels['ollama'] || []).length })}</span>
                                       </>
                                   ) : (
                                       <>
                                           <AlertTriangle size={14} />
                                           <span>{t("settings.ai.ollamaNotDetected", { port: settings.aiOllamaPort || 11434 })}</span>
                                       </>
                                   )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                   <label className="text-sm text-secondary whitespace-nowrap">
                                       {t("settings.ai.ollamaPort")}:
                                   </label>
                                   <input 
                                       type="number" 
                                       value={settings.aiOllamaPort || 11434}
                                       onChange={(e) => updateSetting("aiOllamaPort", parseInt(e.target.value) || 11434)}
                                       className="w-24 bg-base border border-strong rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-blue-500 transition-colors"
                                   />
                                   <p className="text-xs text-muted">
                                       (Default: 11434)
                                   </p>
                                </div>
                            </div>
                       )}
                    </div>
                  )}

                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      {t("settings.ai.defaultModel")}
                    </label>
                    {settings.aiProvider ? (
                        (() => {
                            const currentModels = settings.aiCustomModels?.[settings.aiProvider] || availableModels[settings.aiProvider] || [];
                            const isModelValid = !settings.aiModel || currentModels.includes(settings.aiModel);

                            return (
                                <>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                value={settings.aiModel}
                                                onChange={(val) => updateSetting("aiModel", val)}
                                                options={currentModels}
                                                placeholder={t("settings.ai.modelPlaceholder")}
                                                searchPlaceholder={t("settings.ai.searchPlaceholder")}
                                                noResultsLabel={t("settings.ai.noResults")}
                                                hasError={!isModelValid && !!settings.aiModel}
                                            />
                                        </div>
                                        <button
                                            onClick={() => loadModels(true)}
                                            className="px-3 py-2 bg-surface-secondary hover:bg-surface-tertiary border border-default text-secondary hover:text-primary rounded transition-colors"
                                            title={t("settings.ai.refresh")}
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    </div>
                                    {!isModelValid && settings.aiModel && (
                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400 bg-red-900/10 p-2 rounded border border-red-900/20">
                                            <AlertTriangle size={12} className="shrink-0" />
                                            <span>
                                                <Trans
                                                    i18nKey="settings.ai.modelNotFound"
                                                    values={{ model: settings.aiModel, provider: getProviderLabel(settings.aiProvider) }}
                                                    components={{ strong: <strong className="font-semibold" /> }}
                                                />
                                            </span>
                                        </div>
                                    )}
                                </>
                            );
                        })()
                    ) : (
                        <div className="text-sm text-muted italic px-3 py-2 border border-default rounded bg-base">
                            {t("settings.ai.selectProviderFirst")}
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-muted">
                            {settings.aiProvider === "custom-openai" 
                                ? t("settings.ai.customOpenaiModelHelp") 
                                : t("settings.ai.modelDesc")}
                        </p>
                    </div>
                  </div>

                  {/* System Prompt Configuration */}
                  <div className="border-t border-default pt-6 mt-6">
                    <h4 className="text-md font-medium text-primary mb-4 flex items-center gap-2">
                      <Code2 size={16} /> {t("settings.ai.systemPrompt")}
                    </h4>
                    <p className="text-xs text-secondary mb-4">
                      {t("settings.ai.systemPromptDesc")}
                    </p>

                    <div className="space-y-4">
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-40 bg-base border border-strong rounded-lg p-3 text-primary text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors resize-y"
                        placeholder={t("settings.ai.enterSystemPrompt")}
                      />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleResetPrompt}
                                className="px-3 py-2 bg-surface-secondary hover:bg-surface-tertiary text-secondary rounded text-sm font-medium transition-colors border border-strong"
                            >
                                {t("settings.ai.resetDefault")}
                            </button>
                            <button
                                onClick={handleSavePrompt}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
                            >
                                {t("settings.ai.savePrompt")}
                            </button>
                        </div>
                     </div>
                  </div>

                  {/* Explain Prompt Configuration */}
                  <div className="border-t border-default pt-6 mt-6">
                     <h4 className="text-md font-medium text-primary mb-4 flex items-center gap-2">
                        <Code2 size={16} /> {t("settings.ai.explainPrompt")}
                     </h4>
                     <p className="text-xs text-secondary mb-4">
                        {t("settings.ai.explainPromptDesc")}
                     </p>
                     
                     <div className="space-y-4">
                        <textarea 
                           value={explainPrompt}
                           onChange={(e) => setExplainPrompt(e.target.value)}
                           className="w-full h-40 bg-base border border-strong rounded-lg p-3 text-primary text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors resize-y"
                           placeholder={t("settings.ai.enterExplainPrompt")}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleResetExplainPrompt}
                                className="px-3 py-2 bg-surface-secondary hover:bg-surface-tertiary text-secondary rounded text-sm font-medium transition-colors border border-strong"
                            >
                                {t("settings.ai.resetDefault")}
                            </button>
                            <button
                                onClick={handleSaveExplainPrompt}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
                            >
                                {t("settings.ai.savePrompt")}
                            </button>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Updates Tab */}
          {activeTab === "updates" && (
            <div className="space-y-6">
              <div className="bg-elevated border border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Download size={20} className="text-blue-400" />
                  {t("settings.updates")}
                </h3>

                <div className="space-y-4">
                  {/* Current Version */}
                  <div className="bg-base p-4 rounded-lg border border-default">
                    <div className="text-sm text-secondary">{t("settings.currentVersion")}</div>
                    <div className="text-lg font-mono text-primary mt-1">v{APP_VERSION}</div>
                  </div>

                  {/* Auto Check Toggle */}
                  <div className="flex items-center justify-between bg-base p-4 rounded-lg border border-default">
                    <div>
                      <div className="text-sm text-primary font-medium">
                        {t("settings.autoCheckUpdates")}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {t("settings.autoCheckUpdatesDesc")}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoCheckUpdatesOnStartup !== false}
                      onChange={(e) => updateSetting("autoCheckUpdatesOnStartup", e.target.checked)}
                      className="w-10 h-6 bg-base border border-strong rounded-full appearance-none cursor-pointer relative transition-colors checked:bg-blue-600 checked:border-blue-600 after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4"
                    />
                  </div>

                  {/* Manual Check Button */}
                  <button
                    onClick={() => checkForUpdates(true)}
                    disabled={isChecking}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {t("settings.checking")}
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        {t("settings.checkNow")}
                      </>
                    )}
                  </button>

                  {/* Up to Date Message */}
                  {isUpToDate && !updateInfo && (
                    <div className="bg-blue-900/20 border border-blue-900/50 text-blue-400 px-4 py-3 rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      <span className="text-sm">
                        {t("update.upToDate")}
                      </span>
                    </div>
                  )}

                  {/* Update Available Message */}
                  {updateInfo && (
                    <div className="bg-green-900/20 border border-green-900/50 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      <span className="text-sm">
                        {t("update.updateAvailable", { version: updateInfo.latestVersion })}
                      </span>
                    </div>
                  )}

                  {/* Error Message */}
                  {updateError && (
                    <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                      {updateError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && <LogsTab />}

          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="space-y-8">
              {/* Header / Hero */}
              <div className="bg-gradient-to-br from-blue-900/20 to-elevated border border-blue-500/20 rounded-2xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Code2 size={120} />
                </div>

                <div className="p-2">
                  <img
                    src="/logo.png"
                    alt="tabularis"
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg shadow-blue-500/30"
                    style={{
                      backgroundColor: !currentTheme?.id?.includes('-light')
                        ? currentTheme?.colors?.surface?.secondary || '#334155'
                        : currentTheme?.colors?.bg?.elevated || '#f8fafc'
                    }}
                  />
                </div>

                <h1 className="text-3xl font-bold text-primary mb-2">
                  tabularis
                </h1>
                <p className="text-secondary max-w-lg mx-auto mb-6">
                  A lightweight, developer-focused database manager built with
                  Tauri, Rust, and React. Born from a "vibe coding" experiment
                  to create a modern, native tool in record time.
                </p>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() =>
                      openUrl("https://github.com/debba/tabularis")
                    }
                    className="flex items-center gap-2 bg-surface-secondary hover:bg-surface-tertiary text-primary px-4 py-2 rounded-lg font-medium transition-colors border border-strong"
                  >
                    <Github size={18} />
                    {t("settings.starOnGithub")}
                  </button>
                  <div className="flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-lg border border-accent/30">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {t("settings.version")}
                    </span>
                    <span className="font-mono font-bold">
                      {APP_VERSION} (Beta)
                    </span>
                  </div>
                </div>
              </div>

              {/* Roadmap / Status */}
              <div>
                <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <Info size={20} className="text-blue-400" />
                  {t("settings.projectStatus")}
                </h2>
                <div className="bg-elevated border border-default rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-default bg-surface-secondary/50">
                    <p className="text-sm text-secondary">
                      {t("settings.roadmapDesc")}
                    </p>
                  </div>
                  <div className="divide-y divide-default">
                    {ROADMAP.map((item, i) => {
                      const content = (
                        <>
                          {item.done ? (
                            <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                          ) : (
                            <Circle size={18} className="text-surface-tertiary shrink-0" />
                          )}
                          <span
                            className={clsx(
                              "flex-1 text-left",
                              item.done ? "text-primary" : "text-muted"
                            )}
                          >
                            {item.label}
                          </span>
                          {item.url && (
                            <ExternalLink size={14} className="text-surface-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </>
                      );

                      if (item.url) {
                        return (
                          <button
                            key={i}
                            onClick={() => openUrl(item.url!)}
                            className="w-full p-4 flex items-center gap-3 hover:bg-surface-secondary/30 transition-colors group cursor-pointer"
                          >
                            {content}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={i}
                          className="p-4 flex items-center gap-3 hover:bg-surface-secondary/30 transition-colors group"
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Support */}

              <div className="bg-elevated/50 border border-default rounded-xl p-6 flex flex-col items-center text-center">
                <Heart size={32} className="text-red-500 mb-3 animate-pulse" />
                <h3 className="text-lg font-semibold text-primary mb-2">
                  {t("settings.support")}
                </h3>
                <p className="text-secondary text-sm mb-4 max-w-md">
                  {t("settings.supportDesc")}
                </p>
                <button
                  onClick={() => openUrl("https://github.com/debba/tabularis")}
                  className="text-blue-400 hover:text-blue-300 font-medium text-sm hover:underline"
                >
                  github.com/debba/tabularis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
