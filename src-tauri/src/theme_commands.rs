use crate::paths::get_app_config_dir;
use crate::theme_models::Theme;
use std::fs;
use std::path::PathBuf;

const THEMES_DIR: &str = "themes";

fn get_themes_dir() -> PathBuf {
    let config_dir = get_app_config_dir();
    let themes_dir = config_dir.join(THEMES_DIR);
    if !themes_dir.exists() {
        let _ = fs::create_dir_all(&themes_dir);
    }
    themes_dir
}

fn get_theme_path(theme_id: &str) -> PathBuf {
    get_themes_dir().join(format!("{}.json", theme_id))
}

#[tauri::command]
pub fn get_all_themes() -> Result<Vec<Theme>, String> {
    let themes_dir = get_themes_dir();
    let mut themes = Vec::new();

    if let Ok(entries) = fs::read_dir(&themes_dir) {
        for entry in entries.flatten() {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(theme) = serde_json::from_str::<Theme>(&content) {
                    themes.push(theme);
                }
            }
        }
    }

    Ok(themes)
}

#[tauri::command]
pub fn get_theme(theme_id: String) -> Result<Theme, String> {
    let theme_path = get_theme_path(&theme_id);

    if !theme_path.exists() {
        return Err(format!("Theme {} not found", theme_id));
    }

    let content = fs::read_to_string(&theme_path).map_err(|e| e.to_string())?;
    let theme = serde_json::from_str::<Theme>(&content).map_err(|e| e.to_string())?;

    Ok(theme)
}

#[tauri::command]
pub fn save_custom_theme(theme: Theme) -> Result<(), String> {
    if theme.is_preset {
        return Err("Cannot save preset themes".to_string());
    }

    let theme_path = get_theme_path(&theme.id);
    let content = serde_json::to_string_pretty(&theme).map_err(|e| e.to_string())?;

    fs::write(&theme_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_custom_theme(theme_id: String) -> Result<(), String> {
    let theme_path = get_theme_path(&theme_id);

    if !theme_path.exists() {
        return Err(format!("Theme {} not found", theme_id));
    }

    // Read theme first to verify it's not a preset
    let content = fs::read_to_string(&theme_path).map_err(|e| e.to_string())?;
    let theme = serde_json::from_str::<Theme>(&content).map_err(|e| e.to_string())?;

    if theme.is_preset {
        return Err("Cannot delete preset themes".to_string());
    }

    fs::remove_file(&theme_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn import_theme(theme_json: String) -> Result<Theme, String> {
    let mut theme = serde_json::from_str::<Theme>(&theme_json).map_err(|e| e.to_string())?;

    // Mark as custom and generate new ID
    theme.is_preset = false;
    theme.is_read_only = false;
    theme.id = format!(
        "custom-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    theme.created_at = Some(chrono::Local::now().to_rfc3339());
    theme.updated_at = Some(chrono::Local::now().to_rfc3339());

    // Save the imported theme
    let theme_path = get_theme_path(&theme.id);
    let content = serde_json::to_string_pretty(&theme).map_err(|e| e.to_string())?;
    fs::write(&theme_path, content).map_err(|e| e.to_string())?;

    Ok(theme)
}

#[tauri::command]
pub fn export_theme(theme_id: String) -> Result<String, String> {
    let theme_path = get_theme_path(&theme_id);

    if !theme_path.exists() {
        return Err(format!("Theme {} not found", theme_id));
    }

    let content = fs::read_to_string(&theme_path).map_err(|e| e.to_string())?;

    Ok(content)
}
