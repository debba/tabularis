use std::fs;
use std::path::Path;

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};

use crate::drivers::driver_trait::{DriverCapabilities, PluginManifest};
use crate::models::DataTypeInfo;
use crate::plugins::driver::RpcDriver;

#[derive(Serialize, Deserialize)]
struct ConfigManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub default_port: Option<u16>,
    pub capabilities: DriverCapabilities,
    pub data_types: Vec<DataTypeInfo>,
    pub executable: String,
    #[serde(default)]
    pub default_username: Option<String>,
}

/// Load installed plugins at startup.
///
/// `enabled_ids` controls which plugins are started:
/// - `None`  → load all installed plugins (first-run or no preference saved).
/// - `Some(ids)` → load only the plugins whose directory name (= plugin ID) is in `ids`.
pub async fn load_plugins(enabled_ids: Option<&[String]>) {
    let proj_dirs = match ProjectDirs::from("com", "debba", "tabularis") {
        Some(d) => d,
        None => return,
    };

    let plugins_dir = proj_dirs.data_dir().join("plugins");

    if !plugins_dir.exists() {
        if let Err(e) = fs::create_dir_all(&plugins_dir) {
            log::error!("Failed to create plugins directory: {}", e);
            return;
        }
    }

    let entries = match fs::read_dir(&plugins_dir) {
        Ok(e) => e,
        Err(e) => {
            log::error!("Failed to read plugins directory: {}", e);
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        if let Some(enabled) = enabled_ids {
            if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                if !enabled.iter().any(|id| id == dir_name) {
                    log::info!("Skipping disabled plugin: {}", dir_name);
                    continue;
                }
            }
        }

        if let Err(e) = load_plugin_from_dir(&path).await {
            log::error!("Failed to load plugin {:?}: {}", path, e);
        }
    }
}

pub async fn load_plugin_from_dir(path: &Path) -> Result<(), String> {
    let manifest_path = path.join("manifest.json");
    if !manifest_path.exists() {
        return Err(format!("manifest.json not found in {:?}", path));
    }

    let manifest_str = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin manifest {:?}: {}", manifest_path, e))?;

    let config: ConfigManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| format!("Failed to parse plugin manifest {:?}: {}", manifest_path, e))?;

    let exec_path = path.join(&config.executable);
    if !exec_path.exists() {
        return Err(format!("Plugin executable not found: {:?}", exec_path));
    }

    let manifest = PluginManifest {
        id: config.id,
        name: config.name,
        version: config.version,
        description: config.description,
        default_port: config.default_port,
        capabilities: config.capabilities,
        is_builtin: false,
        default_username: config.default_username.unwrap_or_default(),
    };

    let driver = RpcDriver::new(manifest, exec_path, config.data_types).await?;
    crate::drivers::registry::register_driver(driver).await;
    Ok(())
}
