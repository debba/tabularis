use crate::plugins::installer::{self, InstalledPluginInfo};
use crate::plugins::registry::{
    self, RegistryPluginWithStatus, RegistryReleaseWithStatus,
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

            let releases: Vec<RegistryReleaseWithStatus> = plugin
                .releases
                .iter()
                .map(|r| {
                    let platform_supported =
                        r.assets.contains_key(&platform) || r.assets.contains_key("universal");
                    RegistryReleaseWithStatus {
                        version: r.version.clone(),
                        min_tabularis_version: r.min_tabularis_version.clone(),
                        platform_supported,
                    }
                })
                .collect();

            let platform_supported = releases
                .iter()
                .any(|r| r.version == plugin.latest_version && r.platform_supported);

            RegistryPluginWithStatus {
                id: plugin.id,
                name: plugin.name,
                description: plugin.description,
                author: plugin.author,
                homepage: plugin.homepage,
                latest_version: plugin.latest_version,
                releases,
                installed_version,
                update_available,
                platform_supported,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn install_plugin(plugin_id: String, version: Option<String>) -> Result<(), String> {
    let remote = registry::fetch_registry().await?;
    let platform = registry::get_current_platform();

    let plugin = remote
        .plugins
        .iter()
        .find(|p| p.id == plugin_id)
        .ok_or_else(|| format!("Plugin '{}' not found in registry", plugin_id))?;

    let target_version = version.as_deref().unwrap_or(&plugin.latest_version);

    let release = plugin
        .releases
        .iter()
        .find(|r| r.version == target_version)
        .ok_or_else(|| format!("No release found for version {}", target_version))?;

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

/// Stops the plugin process and removes the driver from the registry.
/// The plugin files remain on disk and can be re-enabled with `enable_plugin`.
#[tauri::command]
pub async fn disable_plugin(plugin_id: String) -> Result<(), String> {
    crate::drivers::registry::unregister_driver(&plugin_id).await;
    Ok(())
}

/// Loads the plugin from disk and registers its driver, starting the plugin process.
#[tauri::command]
pub async fn enable_plugin(plugin_id: String) -> Result<(), String> {
    let plugins_dir = installer::get_plugins_dir()?;
    let plugin_dir = plugins_dir.join(&plugin_id);
    if !plugin_dir.exists() {
        return Err(format!("Plugin '{}' is not installed", plugin_id));
    }
    crate::plugins::manager::load_plugin_from_dir(&plugin_dir).await;
    Ok(())
}
