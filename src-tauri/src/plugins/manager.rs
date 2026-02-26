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

pub async fn load_plugins() {
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
        if path.is_dir() {
            load_plugin_from_dir(&path).await;
        }
    }
}

pub async fn load_plugin_from_dir(path: &Path) {
    let manifest_path = path.join("manifest.json");
    if !manifest_path.exists() {
        return;
    }

    let manifest_str = match fs::read_to_string(&manifest_path) {
        Ok(s) => s,
        Err(e) => {
            log::error!("Failed to read plugin manifest {:?}: {}", manifest_path, e);
            return;
        }
    };

    let config: ConfigManifest = match serde_json::from_str(&manifest_str) {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to parse plugin manifest {:?}: {}", manifest_path, e);
            return;
        }
    };

    let exec_path = path.join(&config.executable);
    if !exec_path.exists() {
        log::error!("Plugin executable not found: {:?}", exec_path);
        return;
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

    let driver = RpcDriver::new(manifest, exec_path, config.data_types);
    crate::drivers::registry::register_driver(driver).await;
}
