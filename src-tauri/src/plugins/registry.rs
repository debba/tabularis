use std::collections::HashMap;

use serde::{Deserialize, Serialize};

const REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/debba/tabularis/main/plugins/registry.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PluginRegistry {
    pub schema_version: u32,
    pub plugins: Vec<RegistryPlugin>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RegistryPlugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub homepage: String,
    pub latest_version: String,
    pub min_tabularis_version: String,
    pub releases: Vec<PluginRelease>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PluginRelease {
    pub version: String,
    pub assets: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RegistryPluginWithStatus {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub homepage: String,
    pub latest_version: String,
    pub min_tabularis_version: String,
    pub installed_version: Option<String>,
    pub update_available: bool,
    pub platform_supported: bool,
}

pub fn get_current_platform() -> String {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    match (os, arch) {
        ("linux", "x86_64") => "linux-x64".to_string(),
        ("linux", "aarch64") => "linux-arm64".to_string(),
        ("macos", "aarch64") => "darwin-arm64".to_string(),
        ("macos", "x86_64") => "darwin-x64".to_string(),
        ("windows", "x86_64") => "win-x64".to_string(),
        _ => format!("{}-{}", os, arch),
    }
}

pub async fn fetch_registry() -> Result<PluginRegistry, String> {
    let response = reqwest::get(REGISTRY_URL)
        .await
        .map_err(|e| format!("Failed to fetch plugin registry: {}", e))?;

    let registry: PluginRegistry = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse plugin registry: {}", e))?;

    Ok(registry)
}
