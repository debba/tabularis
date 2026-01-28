import { useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Github,
  CheckCircle2,
  Circle,
  Heart,
  Info,
  Code2,
  Settings as SettingsIcon,
  Languages,
} from "lucide-react";
import clsx from "clsx";
import { useSettings } from "../hooks/useSettings";
import type { AppLanguage } from "../contexts/SettingsContext";
import { APP_VERSION } from "../version";

export const Settings = () => {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [activeTab, setActiveTab] = useState<"general" | "info">("general");

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
                        value={settings.queryLimit}
                        onChange={(e) =>
                          updateSetting(
                            "queryLimit",
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

          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="space-y-8">
              {/* Header / Hero */}
              <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border border-blue-500/20 rounded-2xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Code2 size={120} />
                </div>

                <img
                  src="/logo.png"
                  alt="tabularis"
                  className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 shadow-lg shadow-blue-500/30"
                />

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
                    onClick={() => openUrl("https://github.com/debba/tabularis")}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700"
                  >
                    <Github size={18} />
                    {t("settings.starOnGithub")}
                  </button>
                  <div className="flex items-center gap-2 bg-blue-900/30 text-blue-300 px-4 py-2 rounded-lg border border-blue-500/30">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {t("settings.version")}
                    </span>
                    <span className="font-mono font-bold">{APP_VERSION} (Beta)</span>
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
