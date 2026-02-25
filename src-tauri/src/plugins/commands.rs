use crate::plugins::installer::{self, InstalledPluginInfo};
use crate::plugins::registry::{
    self, RegistryPluginWithStatus,
};

#[tauri::command]
pub async fn fetch_plugin_registry() -> Result<Vec<RegistryPluginWithStatus>, String> {
    let remote = registry::fetch_registry().await?;
    let installed = installer::list_installed()?;
    let platform = registry::get_current_platform();

    let result = remote
        .plugins
        .into_iter()
        .map(|plugin| {
            let installed_version = installed
                .iter()
                .find(|i| i.id == plugin.id)
                .map(|i| i.version.clone());

            let update_available = installed_version
                .as_ref()
                .map(|iv| iv != &plugin.latest_version)
                .unwrap_or(false);

            let platform_supported = plugin
                .releases
                .iter()
                .any(|r| r.version == plugin.latest_version && (r.assets.contains_key(&platform) || r.assets.contains_key("universal")));

            RegistryPluginWithStatus {
                id: plugin.id,
                name: plugin.name,
                description: plugin.description,
                author: plugin.author,
                homepage: plugin.homepage,
                latest_version: plugin.latest_version,
                min_tabularis_version: plugin.min_tabularis_version,
                installed_version,
                update_available,
                platform_supported,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn install_plugin(plugin_id: String) -> Result<(), String> {
    let remote = registry::fetch_registry().await?;
    let platform = registry::get_current_platform();

    let plugin = remote
        .plugins
        .iter()
        .find(|p| p.id == plugin_id)
        .ok_or_else(|| format!("Plugin '{}' not found in registry", plugin_id))?;

    let release = plugin
        .releases
        .iter()
        .find(|r| r.version == plugin.latest_version)
        .ok_or_else(|| {
            format!(
                "No release found for version {}",
                plugin.latest_version
            )
        })?;

    let download_url = release
        .assets
        .get(&platform)
        .or_else(|| release.assets.get("universal"))
        .ok_or_else(|| {
            format!(
                "Plugin '{}' does not support platform '{}'",
                plugin_id, platform
            )
        })?;

    installer::download_and_install(&plugin_id, download_url).await?;

    // Hot-register the new driver (no restart needed)
    let plugins_dir = installer::get_plugins_dir()?;
    let plugin_dir = plugins_dir.join(&plugin_id);
    crate::plugins::manager::load_plugin_from_dir(&plugin_dir).await;

    Ok(())
}

#[tauri::command]
pub async fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    // Unregister from in-memory driver registry first
    crate::drivers::registry::unregister_driver(&plugin_id).await;

    // Remove from filesystem
    installer::uninstall(&plugin_id)?;

    Ok(())
}

#[tauri::command]
pub async fn get_installed_plugins() -> Result<Vec<InstalledPluginInfo>, String> {
    installer::list_installed()
}
