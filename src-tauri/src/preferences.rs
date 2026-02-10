use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::paths::get_app_config_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorPreferences {
    pub tabs: Vec<serde_json::Value>,
    pub active_tab_id: Option<String>,
}

/// Get the preferences directory path
fn get_preferences_dir() -> PathBuf {
    let mut config_dir = get_app_config_dir();
    config_dir.push("preferences");
    config_dir
}

/// Get the preferences file path for a specific connection
fn get_connection_preferences_path(connection_id: &str) -> PathBuf {
    let mut prefs_dir = get_preferences_dir();
    prefs_dir.push(connection_id);
    prefs_dir.push("preferences.json");
    prefs_dir
}

/// Ensure the preferences directory exists for a connection
fn ensure_preferences_dir(connection_id: &str) -> Result<(), String> {
    let mut prefs_dir = get_preferences_dir();
    prefs_dir.push(connection_id);

    fs::create_dir_all(&prefs_dir)
        .map_err(|e| format!("Failed to create preferences directory: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn save_editor_preferences(
    connection_id: String,
    preferences: EditorPreferences,
) -> Result<(), String> {
    ensure_preferences_dir(&connection_id)?;

    let path = get_connection_preferences_path(&connection_id);
    let json = serde_json::to_string_pretty(&preferences)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("Failed to write preferences file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn load_editor_preferences(
    connection_id: String,
) -> Result<Option<EditorPreferences>, String> {
    let path = get_connection_preferences_path(&connection_id);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences file: {}", e))?;

    let preferences: EditorPreferences = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse preferences file: {}", e))?;

    Ok(Some(preferences))
}

#[tauri::command]
pub async fn delete_editor_preferences(
    connection_id: String,
) -> Result<(), String> {
    let path = get_connection_preferences_path(&connection_id);

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete preferences file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn list_all_preferences() -> Result<HashMap<String, EditorPreferences>, String> {
    let prefs_dir = get_preferences_dir();

    if !prefs_dir.exists() {
        return Ok(HashMap::new());
    }

    let mut all_prefs = HashMap::new();

    let entries = fs::read_dir(&prefs_dir)
        .map_err(|e| format!("Failed to read preferences directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            if let Some(connection_id) = path.file_name().and_then(|n| n.to_str()) {
                let pref_file = path.join("preferences.json");

                if pref_file.exists() {
                    let content = fs::read_to_string(&pref_file)
                        .map_err(|e| format!("Failed to read preferences for {}: {}", connection_id, e))?;

                    let preferences: EditorPreferences = serde_json::from_str(&content)
                        .map_err(|e| format!("Failed to parse preferences for {}: {}", connection_id, e))?;

                    all_prefs.insert(connection_id.to_string(), preferences);
                }
            }
        }
    }

    Ok(all_prefs)
}
