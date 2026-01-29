import { createContext } from "react";

export type AppLanguage = "auto" | "en" | "it";
export type AiProvider = "openai" | "anthropic" | "openrouter";

export interface Settings {
  resultPageSize: number; // Changed from queryLimit to match backend config
  language: AppLanguage;
  aiEnabled: boolean;
  aiProvider: AiProvider | null;
  aiModel: string | null;
  aiCustomModels?: Record<string, string[]>;
}

export interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  isLoading: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const DEFAULT_SETTINGS: Settings = {
  resultPageSize: 500,
  language: "auto",
  aiEnabled: true,
  aiProvider: null,
  aiModel: null,
  aiCustomModels: undefined,
};
