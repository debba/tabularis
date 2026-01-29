use tauri::{AppHandle, Runtime};
use std::fs;
use std::path::PathBuf;
use directories::{ProjectDirs, BaseDirs};
use serde_json::json;

#[derive(serde::Serialize)]
pub struct McpInstallStatus {
    installed: bool,
    config_path: Option<String>,
    executable_path: String,
}

fn get_claude_config_path() -> Option<PathBuf> {
    // Attempt to find standard Claude Desktop config paths
    
    // MacOS: ~/Library/Application Support/Claude/claude_desktop_config.json
    #[cfg(target_os = "macos")]
    {
        if let Some(base) = BaseDirs::new() {
            return Some(base.home_dir().join("Library/Application Support/Claude/claude_desktop_config.json"));
        }
    }
    
    // Windows: %APPDATA%\Claude\claude_desktop_config.json
    #[cfg(target_os = "windows")]
    {
        if let Some(proj) = ProjectDirs::from("", "", "Claude") {
             return Some(proj.config_dir().join("claude_desktop_config.json"));
        }
    }
    
    // Linux/Fallback (Unofficial but standard if it existed)
    // ~/.config/Claude/claude_desktop_config.json
    #[cfg(target_os = "linux")]
    {
        if let Some(base) = BaseDirs::new() {
             return Some(base.config_dir().join("Claude/claude_desktop_config.json"));
        }
    }

    None
}

#[tauri::command]
pub async fn get_mcp_status<R: Runtime>(_app: AppHandle<R>) -> Result<McpInstallStatus, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .to_string_lossy()
        .to_string();

    let config_path = get_claude_config_path();
    let mut installed = false;

    if let Some(path) = &config_path {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(servers) = json.get("mcpServers") {
                         if servers.get("tabularis").is_some() {
                             installed = true;
                         }
                    }
                }
            }
        }
    }

    Ok(McpInstallStatus {
        installed,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        executable_path: exe_path,
    })
}

#[tauri::command]
pub async fn install_mcp_config<R: Runtime>(_app: AppHandle<R>) -> Result<String, String> {
    let config_path = get_claude_config_path()
        .ok_or("Could not determine Claude config path for this OS")?;

    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Read existing or create new
    let mut config: serde_json::Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(json!({}))
    } else {
        json!({})
    };

    // Prepare tabularis config
    let tabularis_config = json!({
        "command": exe_path.to_string_lossy(),
        "args": ["--mcp"]
    });

    // Update JSON
    if !config.get("mcpServers").is_some() {
        config["mcpServers"] = json!({});
    }
    
    config["mcpServers"]["tabularis"] = tabularis_config;

    // Write back
    let new_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, new_content).map_err(|e| e.to_string())?;

    Ok("Successfully configured Claude Desktop with Tabularis MCP!".to_string())
}
