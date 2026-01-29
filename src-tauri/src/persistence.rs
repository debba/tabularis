use crate::keychain_utils;
use crate::models::SavedConnection;
use std::fs;
use std::path::Path;

pub fn load_connections(path: &Path) -> Result<Vec<SavedConnection>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content)
        .map_err(|_| "Failed to parse connections file".to_string())?;

    // Populate passwords from keychain if needed
    for conn in &mut connections {
        if conn.params.save_in_keychain.unwrap_or(false) {
            match keychain_utils::get_db_password(&conn.id) {
                Ok(pwd) => conn.params.password = Some(pwd),
                Err(e) => eprintln!(
                    "[Keyring Error] Failed to get DB password for {}: {}",
                    conn.id, e
                ),
            }
            if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&conn.id) {
                conn.params.ssh_password = Some(ssh_pwd);
            }
        }
    }

    Ok(connections)
}

pub fn save_connections(path: &Path, connections: &[SavedConnection]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    // Create a copy to sanitize passwords before saving to JSON
    let mut to_save = Vec::new();
    for conn in connections {
        let mut c = conn.clone();
        if c.params.save_in_keychain.unwrap_or(false) {
            // Passwords are stored in keychain, remove from JSON
            c.params.password = None;
            c.params.ssh_password = None;
        }
        to_save.push(c);
    }

    let json = serde_json::to_string_pretty(&to_save).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}
