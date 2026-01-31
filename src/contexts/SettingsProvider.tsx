import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { SettingsContext, DEFAULT_SETTINGS, type Settings } from './SettingsContext';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const config = await invoke<Partial<Settings>>('get_config');
        
        // Migration logic: Check localStorage if backend is empty/default
        const savedLocal = localStorage.getItem('tabularis_settings');
        let finalSettings = { ...DEFAULT_SETTINGS };

        if (savedLocal && (!config.resultPageSize && !config.language)) {
           // Migration needed
           const localData = JSON.parse(savedLocal);
           finalSettings = {
             ...finalSettings,
             resultPageSize: localData.queryLimit || 500,
             language: localData.language || "auto",
           };
           // Save migrated data to backend
           await invoke('save_config', { config: finalSettings });
        } else {
         // Use backend config
           finalSettings = {
             ...DEFAULT_SETTINGS,
             ...config,
           };
           
           // If aiEnabled is null or undefined in config, treat it as disabled (false)
           if (config.aiEnabled === null || config.aiEnabled === undefined) {
             finalSettings.aiEnabled = false;
           }
        }

         // Smart detect AI Provider and Model if aiEnabled but provider/model not set
         if (finalSettings.aiEnabled && (!finalSettings.aiProvider || !finalSettings.aiModel)) {
             // First, detect which provider has an API key
             let detectedProvider: string | null = null;
             const hasOpenAI = await invoke<boolean>('check_ai_key', { provider: 'openai' });
             if (hasOpenAI) {
                 detectedProvider = 'openai';
             } else {
                 const hasAnthropic = await invoke<boolean>('check_ai_key', { provider: 'anthropic' });
                 if (hasAnthropic) {
                     detectedProvider = 'anthropic';
                 } else {
                     const hasOpenRouter = await invoke<boolean>('check_ai_key', { provider: 'openrouter' });
                     if (hasOpenRouter) detectedProvider = 'openrouter';
                 }
             }
             
             if (detectedProvider) {
                 // Get available models for the detected provider
                 const models = await invoke<Record<string, string[]>>('get_ai_models');
                 const providerModels = models[detectedProvider] || [];
                 const firstModel = providerModels[0] || null;
                 
                 // Only set provider if not already set
                 if (!finalSettings.aiProvider) {
                     finalSettings.aiProvider = detectedProvider as any;
                 }
                 // Only set model if not already set AND we have a model available
                 if (!finalSettings.aiModel && firstModel) {
                     finalSettings.aiModel = firstModel;
                 }
             }
         }

        setSettings(finalSettings);
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Update i18n when language changes
  useEffect(() => {
    if (settings.language === 'auto') {
      i18n.changeLanguage();
    } else {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      // Persist to backend
      invoke('save_config', { config: newSettings }).catch(err => 
        console.error("Failed to save settings:", err)
      );
      return newSettings;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
