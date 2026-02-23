use std::collections::HashMap;
use std::sync::Arc;

use once_cell::sync::Lazy;
use tokio::sync::RwLock;

use super::driver_trait::{DatabaseDriver, PluginManifest};

type Registry = Arc<RwLock<HashMap<String, Arc<dyn DatabaseDriver>>>>;

static REGISTRY: Lazy<Registry> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Register a driver. Called once at application startup for each built-in
/// driver, and can be called again at any point to add third-party drivers.
pub async fn register_driver(driver: impl DatabaseDriver + 'static) {
    let id = driver.manifest().id.clone();
    log::info!("Registering driver: {} ({})", driver.manifest().name, id);
    let mut reg = REGISTRY.write().await;
    reg.insert(id, Arc::new(driver));
}

/// Look up a driver by its `id` (matches `ConnectionParams.driver`).
/// Returns `None` if no driver with that id is registered.
pub async fn get_driver(id: &str) -> Option<Arc<dyn DatabaseDriver>> {
    let reg = REGISTRY.read().await;
    reg.get(id).cloned()
}

/// Unregister a driver by its id. Returns `true` if a driver was removed.
pub async fn unregister_driver(id: &str) -> bool {
    let mut reg = REGISTRY.write().await;
    let removed = reg.remove(id).is_some();
    if removed {
        log::info!("Unregistered driver: {}", id);
    }
    removed
}

/// Returns the manifests of all registered drivers, sorted by id.
/// Called by the `get_registered_drivers` Tauri command.
pub async fn list_drivers() -> Vec<PluginManifest> {
    let reg = REGISTRY.read().await;
    let mut manifests: Vec<PluginManifest> =
        reg.values().map(|d| d.manifest().clone()).collect();
    manifests.sort_by(|a, b| a.id.cmp(&b.id));
    manifests
}
