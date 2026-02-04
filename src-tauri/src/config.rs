use crate::keychain_utils;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub theme: Option<String>,
    pub language: Option<String>,
    pub result_page_size: Option<u32>,
    pub font_family: Option<String>,
    pub font_size: Option<u32>,
    pub ai_enabled: Option<bool>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub ai_custom_models: Option<HashMap<String, Vec<String>>>,
    pub ai_ollama_port: Option<u16>,
}

pub fn get_config_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok()
}

// Internal load
pub fn load_config_internal(app: &AppHandle) -> AppConfig {
    if let Some(config_dir) = get_config_dir(app) {
        let config_path = config_dir.join("config.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(config_path) {
                if let Ok(config) = serde_json::from_str(&content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
pub fn get_config(app: AppHandle) -> AppConfig {
    load_config_internal(&app)
}

#[tauri::command]
pub fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");

        // Load existing config and merge with new values
        let mut existing_config = load_config_internal(&app);

        // Merge: only update fields that are Some in the new config
        if config.theme.is_some() {
            existing_config.theme = config.theme;
        }
        if config.language.is_some() {
            existing_config.language = config.language;
        }
        if config.result_page_size.is_some() {
            existing_config.result_page_size = config.result_page_size;
        }
        if config.font_family.is_some() {
            existing_config.font_family = config.font_family;
        }
        if config.font_size.is_some() {
            existing_config.font_size = config.font_size;
        }
        if config.ai_enabled.is_some() {
            existing_config.ai_enabled = config.ai_enabled;
        }
        if config.ai_provider.is_some() {
            existing_config.ai_provider = config.ai_provider;
        }
        if config.ai_model.is_some() {
            existing_config.ai_model = config.ai_model;
        }
        if config.ai_custom_models.is_some() {
            existing_config.ai_custom_models = config.ai_custom_models;
        }
        if config.ai_ollama_port.is_some() {
            existing_config.ai_ollama_port = config.ai_ollama_port;
        }

        let content = serde_json::to_string_pretty(&existing_config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

#[tauri::command]
pub fn set_ai_key(provider: String, key: String) -> Result<(), String> {
    keychain_utils::set_ai_key(&provider, &key)
}

pub fn get_ai_api_key(provider: &str) -> Result<String, String> {
    // 1. Try Env Var
    let env_var = match provider {
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        _ => "",
    };

    if !env_var.is_empty() {
        if let Ok(key) = std::env::var(env_var) {
            if !key.is_empty() {
                return Ok(key);
            }
        }
    }

    // 2. Try Keychain
    keychain_utils::get_ai_key(provider).map_err(|_| {
        format!(
            "API Key for {} not found in Keychain or Environment",
            provider
        )
    })
}

#[tauri::command]
pub fn check_ai_key(provider: String) -> bool {
    get_ai_api_key(&provider).is_ok()
}

const DEFAULT_SYSTEM_PROMPT: &str = "You are an expert SQL assistant. Your task is to generate a SQL query based on the user's request and the provided database schema.\nReturn ONLY the SQL query, without any markdown formatting, explanations, or code blocks.\n\nSchema:\n{{SCHEMA}}";
const DEFAULT_EXPLAIN_PROMPT: &str =
    "You are a helpful SQL assistant. Explain SQL queries in {{LANGUAGE}}.";
const DEFAULT_CHAT_PROMPT: &str = "You are the Tabularis AI Assistant. Provide focused, accurate help with SQL, schema exploration, and query troubleshooting. Use the provided context to tailor your answers.\n\nContext:\n{{CONTEXT}}";

#[tauri::command]
pub fn get_system_prompt(app: AppHandle) -> String {
    if let Some(config_dir) = get_config_dir(&app) {
        let prompt_path = config_dir.join("prompt_query.txt");
        if prompt_path.exists() {
            if let Ok(content) = fs::read_to_string(prompt_path) {
                return content;
            }
        }
    }
    DEFAULT_SYSTEM_PROMPT.to_string()
}

#[tauri::command]
pub fn save_system_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let prompt_path = config_dir.join("prompt_query.txt");
        fs::write(prompt_path, prompt).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

#[tauri::command]
pub fn reset_system_prompt(app: AppHandle) -> Result<String, String> {
    if let Some(config_dir) = get_config_dir(&app) {
        let prompt_path = config_dir.join("prompt_query.txt");
        if prompt_path.exists() {
            fs::remove_file(prompt_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(DEFAULT_SYSTEM_PROMPT.to_string())
}

#[tauri::command]
pub fn get_explain_prompt(app: AppHandle) -> String {
    if let Some(config_dir) = get_config_dir(&app) {
        let prompt_path = config_dir.join("prompt_explain.txt");
        if prompt_path.exists() {
            if let Ok(content) = fs::read_to_string(prompt_path) {
                return content;
            }
        }
    }
    DEFAULT_EXPLAIN_PROMPT.to_string()
}

#[tauri::command]
pub fn save_explain_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let prompt_path = config_dir.join("prompt_explain.txt");
        fs::write(prompt_path, prompt).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

#[tauri::command]
pub fn reset_explain_prompt(app: AppHandle) -> Result<String, String> {
    if let Some(config_dir) = get_config_dir(&app) {
        let prompt_path = config_dir.join("prompt_explain.txt");
        if prompt_path.exists() {
            fs::remove_file(prompt_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(DEFAULT_EXPLAIN_PROMPT.to_string())
}

#[tauri::command]
pub fn get_chat_prompt(app: AppHandle) -> String {
    if let Some(config_dir) = get_config_dir(&app) {
        let prompt_path = config_dir.join("prompt_chat.txt");
        if prompt_path.exists() {
            if let Ok(content) = fs::read_to_string(prompt_path) {
                return content;
            }
        }
    }
    DEFAULT_CHAT_PROMPT.to_string()
}

#[tauri::command]
pub fn save_chat_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let prompt_path = config_dir.join("prompt_chat.txt");
        fs::write(prompt_path, prompt).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

#[tauri::command]
pub fn reset_chat_prompt(app: AppHandle) -> Result<String, String> {
    if let Some(config_dir) = get_config_dir(&app) {
        let prompt_path = config_dir.join("prompt_chat.txt");
        if prompt_path.exists() {
            fs::remove_file(prompt_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(DEFAULT_CHAT_PROMPT.to_string())
}
