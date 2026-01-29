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
    pub ai_enabled: Option<bool>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub ai_custom_models: Option<HashMap<String, Vec<String>>>,
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
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
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

#[tauri::command]
pub fn check_ai_key(provider: String) -> bool {
    // Check Env
    let env_var = match provider.as_str() {
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        _ => "",
    };

    if !env_var.is_empty() {
        if let Ok(key) = std::env::var(env_var) {
            if !key.is_empty() {
                return true;
            }
        }
    }

    // Check Keychain
    keychain_utils::get_ai_key(&provider).is_ok()
}

const DEFAULT_SYSTEM_PROMPT: &str = "You are an expert SQL assistant. Your task is to generate a SQL query based on the user's request and the provided database schema.\nReturn ONLY the SQL query, without any markdown formatting, explanations, or code blocks.\n\nSchema:\n{{SCHEMA}}";
const DEFAULT_EXPLAIN_PROMPT: &str =
    "You are a helpful SQL assistant. Explain SQL queries in {{LANGUAGE}}.";

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
