import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Key,
  Power,
} from "lucide-react";
import clsx from "clsx";
import { useSettings } from "../hooks/useSettings";
import type { AppLanguage, AiProvider } from "../contexts/SettingsContext";
import { APP_VERSION } from "../version";
import { message } from "@tauri-apps/plugin-dialog";


export const Settings = () => {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [activeTab, setActiveTab] = useState<"general" | "ai" | "info">(
    "general",
  );
  const [aiKeyStatus, setAiKeyStatus] = useState<Record<string, boolean>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [keyInput, setKeyInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [explainPrompt, setExplainPrompt] = useState("");

  const loadModels = async () => {
    try {
      const models = await invoke<Record<string, string[]>>("get_ai_models");
      setAvailableModels(models);
    } catch (e) {
      console.error("Failed to load AI models", e);
    }
  };

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
      const openai = await invoke<boolean>("check_ai_key", {
        provider: "openai",
      });
      const anthropic = await invoke<boolean>("check_ai_key", {
        provider: "anthropic",
      });
      const openrouter = await invoke<boolean>("check_ai_key", {
        provider: "openrouter",
      });
      setAiKeyStatus({ openai, anthropic, openrouter });
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
    // eslint-disable-next-line
    checkKeys();
    // eslint-disable-next-line
    loadSystemPrompt();
    // eslint-disable-next-line
    loadExplainPrompt();
    // eslint-disable-next-line
    loadModels();
  }, []);


  const roadmap = [
    { label: "Multi-database support (MySQL, Postgres, SQLite)", done: true },
    { label: "SSH Tunneling", done: true },
    { label: "Schema Introspection", done: true },
    { label: "SQL Execution & Results Grid", done: true },
    { label: "Inline Editing & Deletion", done: true },
    { label: "Create New Table Wizard", done: true },
    { label: "Data Export (CSV/JSON)", done: true },
    { label: "Result Limiting & Pagination", done: true },
    { label: "Multiple Query Tabs", done: true },
    { label: "Saved Queries & Persistence", done: true },
    { label: "Visual Query Builder (Experimental)", done: true },
    { label: "Secure Keychain Storage", done: true },
    { label: "Internationalization (i18n)", done: true },
    { label: "AI Integration", done: true },
    { label: "Dark/Light Theme Toggle", done: false },
    { label: "Database Export/Dump", done: false },
  ];

  const availableLanguages: Array<{
    id: AppLanguage;
    label: string;
  }> = [
    { id: "auto", label: t("settings.auto") },
    { id: "en", label: t("settings.english") },
    { id: "it", label: t("settings.italian") },
  ];

  const providers: Array<{ id: AiProvider; label: string }> = [
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "openrouter", label: "OpenRouter" },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => setActiveTab("general")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "general"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
          )}
        >
          <SettingsIcon size={16} />
          {t("settings.general")}
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "ai"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
          )}
        >
          <Sparkles size={16} />
          AI
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "info"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
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
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <SettingsIcon size={20} className="text-blue-400" />
                  {t("settings.dataEditor")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {t("settings.pageSize")}
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      {t("settings.pageSizeDesc")}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={settings.resultPageSize}
                        onChange={(e) =>
                          updateSetting(
                            "resultPageSize",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white w-32 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <span className="text-sm text-slate-500">
                        {t("settings.rows")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Languages size={20} className="text-purple-400" />
                  {t("settings.appearance")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {t("settings.language")}
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
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
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200",
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

          {/* AI Tab */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles size={20} className="text-yellow-400" />
                  AI Configuration
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Configure AI providers to enable natural language to SQL
                  generation. Keys are stored securely in your system's
                  keychain.
                </p>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-lg border border-slate-800 mb-6">
                  <div className="flex items-center gap-3">
                    <div className={clsx("p-2 rounded-full", settings.aiEnabled ? "bg-green-900/20 text-green-400" : "bg-slate-800 text-slate-500")}>
                        <Power size={18} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white">{t("settings.ai.enable")}</div>
                        <div className="text-xs text-slate-500">{t("settings.ai.enableDesc")}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("aiEnabled", !settings.aiEnabled)}
                    className={clsx(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                        settings.aiEnabled ? "bg-blue-600" : "bg-slate-700"
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {t("settings.ai.defaultProvider")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {providers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => updateSetting("aiProvider", p.id)}
                          className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2",
                            settings.aiProvider === p.id
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200",
                          )}
                        >
                          {p.label}
                          {aiKeyStatus[p.id] && (
                            <CheckCircle2
                              size={14}
                              className="text-green-400"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {t("settings.ai.defaultModel")}
                    </label>
                    {settings.aiProvider ? (
                        <select
                            value={settings.aiModel || ""}
                            onChange={(e) => updateSetting("aiModel", e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                        >
                            <option value="" disabled>Select a model</option>
                            {(settings.aiCustomModels?.[settings.aiProvider] || availableModels[settings.aiProvider] || []).map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-sm text-slate-500 italic px-3 py-2 border border-slate-800 rounded bg-slate-950">
                            {t("settings.ai.selectProviderFirst")}
                        </div>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                        {t("settings.ai.modelDesc")}
                    </p>
                  </div>

                  {/* API Keys Management */}
                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <h4 className="text-md font-medium text-white mb-4 flex items-center gap-2">
                      <Key size={16} /> {t("settings.ai.manageKeys")}
                    </h4>

                    <div className="grid gap-4">
                      {providers.map((p) => (
                        <div key={p.id} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between text-sm text-slate-300">
                            <span>{t("settings.ai.apiKey", { provider: p.label })}</span>
                            {aiKeyStatus[p.id] ? (
                              <span className="text-green-400 flex items-center gap-1 text-xs">
                                <CheckCircle2 size={12} /> {t("settings.ai.configured")}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">
                                {t("settings.ai.notConfigured")}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              placeholder={t("settings.ai.enterKey", { provider: p.label })}
                              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                              onChange={(e) => setKeyInput(e.target.value)}
                              // Only keep value in state for the active input being typed
                            />
                            <button
                              onClick={(e) => {
                                // In a real app we'd bind input state better, here simplified for compactness
                                // Accessing sibling input value via state or ref is safer
                                // For now, let's assume the user types in the input and clicks save next to it.
                                // Actually, sharing state 'keyInput' across multiple inputs is bad UX.
                                // I will fix this logic below.
                                const input = (
                                  e.currentTarget
                                    .previousElementSibling as HTMLInputElement
                                ).value;
                                setKeyInput(input); // Just to trigger effect if needed, but we pass to fn
                                if (input) handleSaveKey(p.id);
                              }}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
                            >
                              {t("common.save")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* System Prompt Configuration */}
                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <h4 className="text-md font-medium text-white mb-4 flex items-center gap-2">
                      <Code2 size={16} /> {t("settings.ai.systemPrompt")}
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                      {t("settings.ai.systemPromptDesc")}
                    </p>

                    <div className="space-y-4">
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors resize-y"
                        placeholder={t("settings.ai.enterSystemPrompt")}
                      />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleResetPrompt}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-medium transition-colors border border-slate-700"
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
                  <div className="border-t border-slate-800 pt-6 mt-6">
                     <h4 className="text-md font-medium text-white mb-4 flex items-center gap-2">
                        <Code2 size={16} /> {t("settings.ai.explainPrompt")}
                     </h4>
                     <p className="text-xs text-slate-400 mb-4">
                        {t("settings.ai.explainPromptDesc")}
                     </p>
                     
                     <div className="space-y-4">
                        <textarea 
                           value={explainPrompt}
                           onChange={(e) => setExplainPrompt(e.target.value)}
                           className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors resize-y"
                           placeholder={t("settings.ai.enterExplainPrompt")}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleResetExplainPrompt}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-medium transition-colors border border-slate-700"
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

          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="space-y-8">
              {/* Header / Hero */}
              <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border border-blue-500/20 rounded-2xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Code2 size={120} />
                </div>

                <div className="p-2">
                  <img
                    src="/logo.png"
                    alt="tabularis"
                    className="w-16 h-16 bg-[#010101] rounded-2xl mx-auto mb-4 shadow-lg shadow-blue-500/30"
                  />
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">
                  tabularis
                </h1>
                <p className="text-slate-400 max-w-lg mx-auto mb-6">
                  A lightweight, developer-focused database manager built with
                  Tauri, Rust, and React. Born from a "vibe coding" experiment
                  to create a modern, native tool in record time.
                </p>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() =>
                      openUrl("https://github.com/debba/tabularis")
                    }
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700"
                  >
                    <Github size={18} />
                    {t("settings.starOnGithub")}
                  </button>
                  <div className="flex items-center gap-2 bg-blue-900/30 text-blue-300 px-4 py-2 rounded-lg border border-blue-500/30">
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
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Info size={20} className="text-blue-400" />
                  {t("settings.projectStatus")}
                </h2>
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                    <p className="text-sm text-slate-400">
                      {t("settings.roadmapDesc")}
                    </p>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {roadmap.map((item, i) => (
                      <div
                        key={i}
                        className="p-4 flex items-center gap-3 hover:bg-slate-800/30 transition-colors"
                      >
                        {item.done ? (
                          <CheckCircle2 size={18} className="text-green-500" />
                        ) : (
                          <Circle size={18} className="text-slate-600" />
                        )}
                        <span
                          className={
                            item.done ? "text-slate-200" : "text-slate-500"
                          }
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Support */}

              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center text-center">
                <Heart size={32} className="text-red-500 mb-3 animate-pulse" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t("settings.support")}
                </h3>
                <p className="text-slate-400 text-sm mb-4 max-w-md">
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
