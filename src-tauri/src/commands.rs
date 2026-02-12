use sqlx::any::AnyConnectOptions;
use sqlx::{AnyConnection, Connection};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime, State};
use tokio::task::AbortHandle;
use urlencoding::encode;
use uuid::Uuid;

use crate::drivers::{mysql, postgres, sqlite};
use crate::keychain_utils;
use crate::models::{
    ConnectionParams, ForeignKey, Index, QueryResult, RoutineInfo, RoutineParameter,
    SavedConnection, SshConnection, SshConnectionInput, SshTestParams, TableColumn, TableInfo,
    TestConnectionRequest,
};
use crate::ssh_tunnel::{get_tunnels, SshTunnel};

// Constants
const DEFAULT_MYSQL_PORT: u16 = 3306;
const DEFAULT_POSTGRES_PORT: u16 = 5432;

pub struct QueryCancellationState {
    pub handles: Arc<Mutex<HashMap<String, AbortHandle>>>,
}

impl Default for QueryCancellationState {
    fn default() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// --- Persistence Helpers ---

pub async fn expand_ssh_connection_params<R: Runtime>(
    app: &AppHandle<R>,
    params: &ConnectionParams,
) -> Result<ConnectionParams, String> {
    let mut expanded_params = params.clone();

    // If ssh_connection_id is set and SSH is enabled, load the SSH connection and merge it
    if params.ssh_enabled.unwrap_or(false) {
        println!("[expand_ssh_connection_params] SSH is enabled");
        if let Some(ssh_id) = &params.ssh_connection_id {
            println!(
                "[expand_ssh_connection_params] Loading SSH connection: {}",
                ssh_id
            );
            let ssh_connections = get_ssh_connections(app.clone()).await?;
            let ssh_conn = ssh_connections
                .iter()
                .find(|s| &s.id == ssh_id)
                .ok_or_else(|| format!("SSH connection with ID {} not found", ssh_id))?;

            // Populate legacy SSH fields from the SSH connection
            // Passwords are already loaded by get_ssh_connections
            expanded_params.ssh_host = Some(ssh_conn.host.clone());
            expanded_params.ssh_port = Some(ssh_conn.port);
            expanded_params.ssh_user = Some(ssh_conn.user.clone());
            expanded_params.ssh_password = ssh_conn.password.clone();
            expanded_params.ssh_key_file = ssh_conn.key_file.clone();
            expanded_params.ssh_key_passphrase = ssh_conn.key_passphrase.clone();
        }
    }

    Ok(expanded_params)
}

/// Check if a string option is empty or contains only whitespace.
#[inline]
#[cfg(test)]
fn is_empty_or_whitespace(s: &Option<String>) -> bool {
    s.as_ref().map(|p| p.trim().is_empty()).unwrap_or(true)
}

/// Build the SSH tunnel map key for caching tunnels.
#[inline]
fn build_tunnel_map_key(
    ssh_user: &str,
    ssh_host: &str,
    ssh_port: u16,
    remote_host: &str,
    remote_port: u16,
) -> String {
    crate::ssh_tunnel::build_tunnel_key(ssh_user, ssh_host, ssh_port, remote_host, remote_port)
}

pub fn resolve_connection_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
    if !params.ssh_enabled.unwrap_or(false) {
        return Ok(params.clone());
    }

    let ssh_host = params.ssh_host.as_deref().ok_or("Missing SSH Host")?;
    let ssh_port = params.ssh_port.unwrap_or(22);
    let ssh_user = params.ssh_user.as_deref().ok_or("Missing SSH User")?;
    let remote_host = params.host.as_deref().unwrap_or("localhost");
    let remote_port = params.port.unwrap_or(DEFAULT_MYSQL_PORT);

    let map_key = build_tunnel_map_key(ssh_user, ssh_host, ssh_port, remote_host, remote_port);

    // Check for existing tunnel
    {
        let tunnels = get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&map_key) {
            log::debug!("Reusing existing SSH tunnel on port {}", tunnel.local_port);
            let mut new_params = params.clone();
            new_params.host = Some("127.0.0.1".to_string());
            new_params.port = Some(tunnel.local_port);
            return Ok(new_params);
        }
    }

    // Create new tunnel
    log::info!(
        "Creating new SSH tunnel for {}@{}:{}",
        ssh_user,
        ssh_host,
        ssh_port
    );
    let tunnel = SshTunnel::new(
        ssh_host,
        ssh_port,
        ssh_user,
        params.ssh_password.as_deref(),
        params.ssh_key_file.as_deref(),
        params.ssh_key_passphrase.as_deref(),
        remote_host,
        remote_port,
    )
    .map_err(|e| {
        eprintln!("[Connection Error] SSH Tunnel setup failed: {}", e);
        e
    })?;

    let local_port = tunnel.local_port;
    log::info!("SSH tunnel created successfully on port {}", local_port);

    {
        let mut tunnels = get_tunnels().lock().unwrap();
        tunnels.insert(map_key, tunnel);
    }

    let mut new_params = params.clone();
    new_params.host = Some("127.0.0.1".to_string());
    new_params.port = Some(local_port);
    Ok(new_params)
}

/// Resolve connection params and set connection_id for stable pooling
pub fn resolve_connection_params_with_id(
    params: &ConnectionParams,
    connection_id: &str,
) -> Result<ConnectionParams, String> {
    let mut resolved = resolve_connection_params(params)?;
    resolved.connection_id = Some(connection_id.to_string());
    Ok(resolved)
}

pub fn get_config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("connections.json"))
}

pub fn get_ssh_config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("ssh_connections.json"))
}

pub fn find_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
) -> Result<SavedConnection, String> {
    let path = get_config_path(app)?;
    if !path.exists() {
        return Err("Connection not found".into());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();
    let mut conn = connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Connection not found".to_string())?;

    // Load passwords from keychain if needed (like get_connections in v0.8.8)
    if conn.params.save_in_keychain.unwrap_or(false) {
        match keychain_utils::get_db_password(&conn.id) {
            Ok(pwd) => conn.params.password = Some(pwd),
            Err(e) => eprintln!(
                "[Keyring Error] Failed to get DB password for {}: {}",
                conn.id, e
            ),
        }
        if conn.params.ssh_enabled.unwrap_or(false) {
            if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&conn.id) {
                if !ssh_pwd.trim().is_empty() {
                    conn.params.ssh_password = Some(ssh_pwd);
                }
            }
            if let Ok(ssh_passphrase) = keychain_utils::get_ssh_key_passphrase(&conn.id) {
                if !ssh_passphrase.trim().is_empty() {
                    conn.params.ssh_key_passphrase = Some(ssh_passphrase);
                }
            }
        }
    }

    Ok(conn)
}

// --- Commands ---

#[tauri::command]
pub async fn get_schemas<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<String>, String> {
    log::info!("Fetching schemas for connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_schemas(&params).await,
        "postgres" => postgres::get_schemas(&params).await,
        "sqlite" => sqlite::get_schemas(&params).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_routines<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<RoutineInfo>, String> {
    log::info!("Fetching routines for connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_routines(&params).await,
        "postgres" => postgres::get_routines(&params, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_routines(&params).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_routine_parameters<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    schema: Option<String>,
) -> Result<Vec<RoutineParameter>, String> {
    log::info!(
        "Fetching routine parameters for: {} on connection: {}",
        routine_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_routine_parameters(&params, &routine_name).await,
        "postgres" => postgres::get_routine_parameters(&params, &routine_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_routine_parameters(&params, &routine_name).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_routine_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    routine_type: String, // "PROCEDURE" or "FUNCTION" - mainly for MySQL SHOW CREATE
    schema: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching routine definition for: {} ({}) on connection: {}",
        routine_name,
        routine_type,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_routine_definition(&params, &routine_name, &routine_type).await,
        "postgres" => postgres::get_routine_definition(&params, &routine_name, &routine_type, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_routine_definition(&params, &routine_name, &routine_type).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_schema_snapshot<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<crate::models::TableSchema>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let driver = saved_conn.params.driver.clone();
    let pg_schema = schema.as_deref().unwrap_or("public");

    // 1. Get Tables
    let tables = match driver.as_str() {
        "mysql" => mysql::get_tables(&params).await,
        "postgres" => postgres::get_tables(&params, pg_schema).await,
        "sqlite" => sqlite::get_tables(&params).await,
        _ => Err("Unsupported driver".into()),
    }?;

    // 2. Fetch ALL columns and foreign keys in batch (2 queries instead of N*2)
    let result = match driver.as_str() {
        "mysql" => {
            let mut columns_map = mysql::get_all_columns_batch(&params).await?;
            let mut fks_map = mysql::get_all_foreign_keys_batch(&params).await?;

            tables
                .into_iter()
                .map(|table| crate::models::TableSchema {
                    name: table.name.clone(),
                    columns: columns_map.remove(&table.name).unwrap_or_default(),
                    foreign_keys: fks_map.remove(&table.name).unwrap_or_default(),
                })
                .collect()
        }
        "postgres" => {
            let mut columns_map = postgres::get_all_columns_batch(&params, pg_schema).await?;
            let mut fks_map = postgres::get_all_foreign_keys_batch(&params, pg_schema).await?;

            tables
                .into_iter()
                .map(|table| crate::models::TableSchema {
                    name: table.name.clone(),
                    columns: columns_map.remove(&table.name).unwrap_or_default(),
                    foreign_keys: fks_map.remove(&table.name).unwrap_or_default(),
                })
                .collect()
        }
        "sqlite" => {
            let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
            let mut columns_map = sqlite::get_all_columns_batch(&params, &table_names).await?;
            let mut fks_map = sqlite::get_all_foreign_keys_batch(&params, &table_names).await?;

            tables
                .into_iter()
                .map(|table| crate::models::TableSchema {
                    name: table.name.clone(),
                    columns: columns_map.remove(&table.name).unwrap_or_default(),
                    foreign_keys: fks_map.remove(&table.name).unwrap_or_default(),
                })
                .collect()
        }
        _ => return Err("Unsupported driver".into()),
    };

    Ok(result)
}

#[tauri::command]
pub async fn save_connection<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    params: ConnectionParams,
) -> Result<SavedConnection, String> {
    log::info!("Saving new connection: {}", name);

    let path = get_config_path(&app)?;
    let mut connections: Vec<SavedConnection> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let id = Uuid::new_v4().to_string();
    let mut params_to_save = params.clone();

    if params.save_in_keychain.unwrap_or(false) {
        log::debug!("Storing passwords in keychain for connection: {}", name);
        if let Some(pwd) = &params.password {
            keychain_utils::set_db_password(&id, pwd)?;
        }
        if params.ssh_enabled.unwrap_or(false) {
            if let Some(ssh_pwd) = &params.ssh_password {
                keychain_utils::set_ssh_password(&id, ssh_pwd)?;
            }
            if let Some(ssh_passphrase) = &params.ssh_key_passphrase {
                if !ssh_passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&id, ssh_passphrase)?;
                }
            }
        }
        params_to_save.password = None;
        params_to_save.ssh_password = None;
        params_to_save.ssh_key_passphrase = None;
    }

    let new_conn = SavedConnection {
        id: id.clone(),
        name: name.clone(),
        params: params_to_save,
    };
    connections.push(new_conn.clone());
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    log::info!("Connection saved successfully: {} (ID: {})", name, id);

    let mut returned_conn = new_conn;
    returned_conn.params = params; // Return with password for frontend state
    Ok(returned_conn)
}

#[tauri::command]
pub async fn delete_connection<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    log::info!("Deleting connection: {}", id);

    let path = get_config_path(&app)?;
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

    let initial_count = connections.len();
    connections.retain(|c| c.id != id);
    let deleted = connections.len() < initial_count;

    // Attempt to remove passwords from keychain (ignore if not found)
    keychain_utils::delete_db_password(&id).ok();
    keychain_utils::delete_ssh_password(&id).ok();
    keychain_utils::delete_ssh_key_passphrase(&id).ok();

    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    if deleted {
        log::info!("Connection deleted successfully: {}", id);
    } else {
        log::warn!("Connection not found for deletion: {}", id);
    }

    Ok(())
}

#[tauri::command]
pub async fn update_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    name: String,
    params: ConnectionParams,
) -> Result<SavedConnection, String> {
    let path = get_config_path(&app)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

    let conn_idx = connections
        .iter()
        .position(|c| c.id == id)
        .ok_or("Connection not found")?;

    let mut params_to_save = params.clone();

    if params.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &params.password {
            keychain_utils::set_db_password(&id, pwd)?;
        }
        if params.ssh_enabled.unwrap_or(false) {
            if let Some(ssh_pwd) = &params.ssh_password {
                keychain_utils::set_ssh_password(&id, ssh_pwd)?;
            }
            if let Some(ssh_passphrase) = &params.ssh_key_passphrase {
                if !ssh_passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&id, ssh_passphrase)?;
                }
            }
        } else {
            keychain_utils::delete_ssh_password(&id).ok();
            keychain_utils::delete_ssh_key_passphrase(&id).ok();
        }
        params_to_save.password = None;
        params_to_save.ssh_password = None;
        params_to_save.ssh_key_passphrase = None;
    } else {
        keychain_utils::delete_db_password(&id).ok();
        keychain_utils::delete_ssh_password(&id).ok();
        keychain_utils::delete_ssh_key_passphrase(&id).ok();
    }

    let updated = SavedConnection {
        id: id.clone(),
        name,
        params: params_to_save,
    };

    connections[conn_idx] = updated.clone();

    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_conn = updated;
    returned_conn.params = params;
    Ok(returned_conn)
}

#[tauri::command]
pub async fn duplicate_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<SavedConnection, String> {
    let path = get_config_path(&app)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

    let original_idx = connections
        .iter()
        .position(|c| c.id == id)
        .ok_or("Connection not found")?;
    let mut original = connections[original_idx].clone();

    // Recover passwords if in keychain
    if original.params.save_in_keychain.unwrap_or(false) {
        if let Ok(pwd) = keychain_utils::get_db_password(&original.id) {
            original.params.password = Some(pwd);
        }
        if original.params.ssh_enabled.unwrap_or(false) {
            if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&original.id) {
                if !ssh_pwd.trim().is_empty() {
                    original.params.ssh_password = Some(ssh_pwd);
                }
            }
            if let Ok(ssh_passphrase) = keychain_utils::get_ssh_key_passphrase(&original.id) {
                if !ssh_passphrase.trim().is_empty() {
                    original.params.ssh_key_passphrase = Some(ssh_passphrase);
                }
            }
        }
    }

    let new_id = Uuid::new_v4().to_string();
    let mut new_params = original.params.clone();

    // Save passwords to new keychain entries if enabled
    if new_params.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &new_params.password {
            keychain_utils::set_db_password(&new_id, pwd)?;
        }
        if new_params.ssh_enabled.unwrap_or(false) {
            if let Some(ssh_pwd) = &new_params.ssh_password {
                keychain_utils::set_ssh_password(&new_id, ssh_pwd)?;
            }
            if let Some(ssh_passphrase) = &new_params.ssh_key_passphrase {
                if !ssh_passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&new_id, ssh_passphrase)?;
                }
            }
        }
        new_params.password = None;
        new_params.ssh_password = None;
        new_params.ssh_key_passphrase = None;
    }

    let new_conn = SavedConnection {
        id: new_id,
        name: format!("{} (Copy)", original.name),
        params: new_params,
    };

    connections.push(new_conn.clone());

    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_conn = new_conn;
    // Return with passwords for frontend consistency
    if returned_conn.params.save_in_keychain.unwrap_or(false) {
        // We can just use the values from `original.params` as they are identical (unless we cleared them in new_params)
        // Actually original.params holds the clear text now.
        returned_conn.params.password = original.params.password;
        returned_conn.params.ssh_password = original.params.ssh_password;
        returned_conn.params.ssh_key_passphrase = original.params.ssh_key_passphrase;
    }

    Ok(returned_conn)
}

#[tauri::command]
pub async fn get_connections<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<SavedConnection>, String> {
    // Run migration if needed
    migrate_ssh_connections(&app).await.ok();

    let path = get_config_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

    Ok(connections)
}

// ==================== SSH Connection Management ====================

/// Migrates old embedded SSH connections to separate SSH connection entries
async fn migrate_ssh_connections<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let conn_path = get_config_path(app)?;
    if !conn_path.exists() {
        return Ok(()); // Nothing to migrate
    }

    let content = fs::read_to_string(&conn_path).map_err(|e| e.to_string())?;
    let connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

    // Check if any connections have old embedded SSH params
    let needs_migration = connections
        .iter()
        .any(|c| c.params.ssh_enabled.unwrap_or(false) && c.params.ssh_connection_id.is_none());

    if !needs_migration {
        return Ok(()); // No migration needed
    }

    println!("[Migration] Starting SSH connections migration...");

    let ssh_path = get_ssh_config_path(app)?;
    let mut ssh_connections: Vec<SshConnection> = if ssh_path.exists() {
        let ssh_content = fs::read_to_string(&ssh_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&ssh_content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let mut migrated_connections = Vec::new();
    let mut ssh_connection_map: HashMap<String, String> = HashMap::new(); // (ssh_key -> ssh_id)

    for mut conn in connections {
        if conn.params.ssh_enabled.unwrap_or(false) && conn.params.ssh_connection_id.is_none() {
            // Extract SSH params
            if let (Some(host), Some(user)) = (&conn.params.ssh_host, &conn.params.ssh_user) {
                let port = conn.params.ssh_port.unwrap_or(22);
                let key_file = conn.params.ssh_key_file.clone().unwrap_or_default();

                // Create unique key for this SSH config
                let ssh_key = format!("{}:{}:{}:{}", host, port, user, key_file);

                // Check if we already created an SSH connection for this config
                let ssh_id = if let Some(existing_id) = ssh_connection_map.get(&ssh_key) {
                    existing_id.clone()
                } else {
                    // Create new SSH connection
                    let new_ssh_id = Uuid::new_v4().to_string();
                    let ssh_name = format!("{}@{}", user, host);

                    // Migrate credentials from connection keychain to SSH keychain
                    if conn.params.save_in_keychain.unwrap_or(false) {
                        if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&conn.id) {
                            if !ssh_pwd.trim().is_empty() {
                                keychain_utils::set_ssh_password(&new_ssh_id, &ssh_pwd).ok();
                            }
                        }
                        if let Ok(ssh_pass) = keychain_utils::get_ssh_key_passphrase(&conn.id) {
                            if !ssh_pass.trim().is_empty() {
                                keychain_utils::set_ssh_key_passphrase(&new_ssh_id, &ssh_pass).ok();
                            }
                        }
                    }

                    let new_ssh_conn = SshConnection {
                        id: new_ssh_id.clone(),
                        name: ssh_name,
                        host: host.clone(),
                        port,
                        user: user.clone(),
                        auth_type: Some(if !key_file.is_empty() {
                            "ssh_key".to_string()
                        } else {
                            "password".to_string()
                        }),
                        password: None,
                        key_file: if key_file.is_empty() {
                            None
                        } else {
                            Some(key_file.clone())
                        },
                        key_passphrase: None,
                        save_in_keychain: conn.params.save_in_keychain,
                    };

                    ssh_connections.push(new_ssh_conn);
                    ssh_connection_map.insert(ssh_key, new_ssh_id.clone());
                    new_ssh_id
                };

                // Update connection to reference the SSH connection
                conn.params.ssh_connection_id = Some(ssh_id);
                // Clear old embedded SSH params
                conn.params.ssh_host = None;
                conn.params.ssh_port = None;
                conn.params.ssh_user = None;
                conn.params.ssh_password = None;
                conn.params.ssh_key_file = None;
                conn.params.ssh_key_passphrase = None;
            }
        }

        migrated_connections.push(conn);
    }

    // Save migrated SSH connections
    let ssh_json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(ssh_path, ssh_json).map_err(|e| e.to_string())?;

    // Save migrated connections
    let conn_json =
        serde_json::to_string_pretty(&migrated_connections).map_err(|e| e.to_string())?;
    fs::write(conn_path, conn_json).map_err(|e| e.to_string())?;

    println!(
        "[Migration] Successfully migrated {} SSH connections",
        ssh_connections.len()
    );
    Ok(())
}

#[tauri::command]
pub async fn get_ssh_connections<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<SshConnection>, String> {
    let path = get_ssh_config_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut ssh_connections: Vec<SshConnection> =
        serde_json::from_str(&content).unwrap_or_default();

    // Populate passwords from keychain if needed and determine auth_type for backward compatibility
    for ssh in &mut ssh_connections {
        // Backward compatibility: determine auth_type if missing
        if ssh.auth_type.is_none() {
            ssh.auth_type = Some(
                if ssh.key_file.is_some()
                    && ssh
                        .key_file
                        .as_ref()
                        .map_or(false, |k| !k.trim().is_empty())
                {
                    "ssh_key".to_string()
                } else {
                    "password".to_string()
                },
            );
        }

        if ssh.save_in_keychain.unwrap_or(false) {
            if let Ok(pwd) = keychain_utils::get_ssh_password(&ssh.id) {
                if !pwd.trim().is_empty() {
                    ssh.password = Some(pwd);
                }
            }
            if let Ok(passphrase) = keychain_utils::get_ssh_key_passphrase(&ssh.id) {
                if !passphrase.trim().is_empty() {
                    ssh.key_passphrase = Some(passphrase);
                }
            }
        }
    }

    Ok(ssh_connections)
}

#[tauri::command]
pub async fn save_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    ssh: SshConnectionInput,
) -> Result<SshConnection, String> {
    let path = get_ssh_config_path(&app)?;
    let mut ssh_connections: Vec<SshConnection> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let id = Uuid::new_v4().to_string();
    let ssh_to_save = SshConnection {
        id: id.clone(),
        name: name.clone(),
        host: ssh.host,
        port: ssh.port,
        user: ssh.user,
        auth_type: Some(ssh.auth_type.clone()),
        password: if ssh.save_in_keychain.unwrap_or(false) {
            if let Some(pwd) = &ssh.password {
                keychain_utils::set_ssh_password(&id, pwd)?;
            }
            None
        } else {
            ssh.password.clone()
        },
        key_file: ssh.key_file.clone(),
        key_passphrase: if ssh.save_in_keychain.unwrap_or(false) {
            if let Some(passphrase) = &ssh.key_passphrase {
                if !passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&id, passphrase)?;
                }
            }
            None
        } else {
            ssh.key_passphrase.clone()
        },
        save_in_keychain: ssh.save_in_keychain,
    };

    ssh_connections.push(ssh_to_save.clone());
    let json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_ssh = ssh_to_save;
    returned_ssh.password = ssh.password;
    returned_ssh.key_passphrase = ssh.key_passphrase;
    Ok(returned_ssh)
}

#[tauri::command]
pub async fn update_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    name: String,
    ssh: SshConnectionInput,
) -> Result<SshConnection, String> {
    let path = get_ssh_config_path(&app)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut ssh_connections: Vec<SshConnection> =
        serde_json::from_str(&content).unwrap_or_default();

    let ssh_idx = ssh_connections
        .iter()
        .position(|s| s.id == id)
        .ok_or("SSH connection not found")?;

    if ssh.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &ssh.password {
            keychain_utils::set_ssh_password(&id, pwd)?;
        }
        if let Some(passphrase) = &ssh.key_passphrase {
            if !passphrase.trim().is_empty() {
                keychain_utils::set_ssh_key_passphrase(&id, passphrase)?;
            }
        }
    } else {
        keychain_utils::delete_ssh_password(&id).ok();
        keychain_utils::delete_ssh_key_passphrase(&id).ok();
    }

    let ssh_to_save = SshConnection {
        id: id.clone(),
        name: name.clone(),
        host: ssh.host,
        port: ssh.port,
        user: ssh.user,
        auth_type: Some(ssh.auth_type.clone()),
        password: if ssh.save_in_keychain.unwrap_or(false) {
            None
        } else {
            ssh.password.clone()
        },
        key_file: ssh.key_file.clone(),
        key_passphrase: if ssh.save_in_keychain.unwrap_or(false) {
            None
        } else {
            ssh.key_passphrase.clone()
        },
        save_in_keychain: ssh.save_in_keychain,
    };

    ssh_connections[ssh_idx] = ssh_to_save.clone();

    let json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_ssh = ssh_to_save;
    returned_ssh.password = ssh.password;
    returned_ssh.key_passphrase = ssh.key_passphrase;
    Ok(returned_ssh)
}

#[tauri::command]
pub async fn delete_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let path = get_ssh_config_path(&app)?;
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut ssh_connections: Vec<SshConnection> =
        serde_json::from_str(&content).unwrap_or_default();

    ssh_connections.retain(|s| s.id != id);

    // Remove credentials from keychain
    keychain_utils::delete_ssh_password(&id).ok();
    keychain_utils::delete_ssh_key_passphrase(&id).ok();

    let json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn test_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    ssh: SshTestParams,
) -> Result<String, String> {
    use crate::ssh_tunnel;

    // Resolve password using same logic as database connections
    let resolved_password = resolve_ssh_test_password(
        ssh.password.as_deref(),
        ssh.connection_id.as_deref(),
        |conn_id| {
            let path = get_ssh_config_path(&app).ok()?;
            if !path.exists() {
                return None;
            }
            let content = fs::read_to_string(path).ok()?;
            let connections: Vec<SshConnection> =
                serde_json::from_str(&content).unwrap_or_default();
            connections.into_iter().find(|c| c.id == conn_id)
        },
        |conn_id| keychain_utils::get_ssh_password(conn_id),
    );

    // Resolve passphrase using same logic
    let resolved_passphrase = resolve_ssh_test_credential(
        ssh.key_passphrase.as_deref(),
        ssh.connection_id.as_deref(),
        |conn_id| {
            let path = get_ssh_config_path(&app).ok()?;
            if !path.exists() {
                return None;
            }
            let content = fs::read_to_string(path).ok()?;
            let connections: Vec<SshConnection> =
                serde_json::from_str(&content).unwrap_or_default();
            connections.into_iter().find(|c| c.id == conn_id)
        },
        |conn_id| keychain_utils::get_ssh_key_passphrase(conn_id),
        |conn| {
            conn.key_passphrase
                .as_ref()
                .filter(|p| !p.trim().is_empty())
                .cloned()
        },
    );

    ssh_tunnel::test_ssh_connection(
        &ssh.host,
        ssh.port,
        &ssh.user,
        resolved_password.as_deref(),
        ssh.key_file.as_deref(),
        resolved_passphrase.as_deref(),
    )
}

#[tauri::command]
pub async fn test_connection<R: Runtime>(
    app: AppHandle<R>,
    request: TestConnectionRequest,
) -> Result<String, String> {
    log::info!(
        "Testing connection to database: {}",
        request.params.database
    );

    let mut expanded_params = expand_ssh_connection_params(&app, &request.params).await?;

    if request.params.password.is_none() && expanded_params.password.is_none() {
        let saved_conn = match &request.connection_id {
            Some(id) => find_connection_by_id(&app, id).ok(),
            None => None,
        };
        expanded_params.password =
            resolve_test_connection_password(&request.params, saved_conn.as_ref(), |conn_id| {
                keychain_utils::get_db_password(conn_id)
            });
    }

    let resolved_params = if let Some(conn_id) = &request.connection_id {
        resolve_connection_params_with_id(&expanded_params, conn_id)?
    } else {
        resolve_connection_params(&expanded_params)?
    };
    log::debug!(
        "Test connection params: Host={:?}, Port={:?}",
        resolved_params.host,
        resolved_params.port
    );

    let url = build_connection_url(&resolved_params)?;
    log::debug!("Connection URL: {}", url);

    let options = AnyConnectOptions::from_str(&url).map_err(|e| e.to_string())?;
    let mut conn = AnyConnection::connect_with(&options)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    conn.ping().await.map_err(|e: sqlx::Error| e.to_string())?;

    log::info!(
        "Connection test successful for database: {}",
        request.params.database
    );
    Ok("Connection successful!".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_params() -> ConnectionParams {
        ConnectionParams {
            driver: "mysql".to_string(),
            host: Some("localhost".to_string()),
            port: Some(3306),
            username: Some("root".to_string()),
            password: None,
            database: "testdb".to_string(),
            ssh_enabled: None,
            ssh_connection_id: None,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_password: None,
            ssh_key_file: None,
            ssh_key_passphrase: None,
            save_in_keychain: None,
            connection_id: None,
        }
    }

    fn saved_conn(id: &str, password: Option<&str>, save_in_keychain: bool) -> SavedConnection {
        SavedConnection {
            id: id.to_string(),
            name: "Test".to_string(),
            params: ConnectionParams {
                password: password.map(|p| p.to_string()),
                save_in_keychain: Some(save_in_keychain),
                ..base_params()
            },
        }
    }

    #[test]
    fn test_resolve_password_prefers_request() {
        let mut params = base_params();
        params.password = Some("from_request".to_string());
        let result = resolve_test_connection_password(&params, None, |_| Ok("kc".to_string()));
        assert_eq!(result, Some("from_request".to_string()));
    }

    #[test]
    fn test_resolve_password_from_keychain() {
        let params = base_params();
        let saved = saved_conn("id1", None, true);
        let result =
            resolve_test_connection_password(&params, Some(&saved), |_| Ok("kc".to_string()));
        assert_eq!(result, Some("kc".to_string()));
    }

    #[test]
    fn test_resolve_password_from_saved_when_not_keychain() {
        let params = base_params();
        let saved = saved_conn("id1", Some("stored"), false);
        let result =
            resolve_test_connection_password(&params, Some(&saved), |_| Ok("kc".to_string()));
        assert_eq!(result, Some("stored".to_string()));
    }

    #[test]
    fn test_resolve_password_fallback_to_saved_when_keychain_empty() {
        let params = base_params();
        let saved = saved_conn("id1", Some("stored"), true);
        let result =
            resolve_test_connection_password(&params, Some(&saved), |_| Ok("  ".to_string()));
        assert_eq!(result, Some("stored".to_string()));
    }

    mod build_connection_url_tests {
        use super::*;

        fn create_params(
            driver: &str,
            host: &str,
            port: Option<u16>,
            username: &str,
            password: Option<&str>,
            database: &str,
        ) -> ConnectionParams {
            ConnectionParams {
                driver: driver.to_string(),
                host: Some(host.to_string()),
                port,
                username: Some(username.to_string()),
                password: password.map(|p| p.to_string()),
                database: database.to_string(),
                ssh_enabled: None,
                ssh_connection_id: None,
                ssh_host: None,
                ssh_port: None,
                ssh_user: None,
                ssh_password: None,
                ssh_key_file: None,
                ssh_key_passphrase: None,
                save_in_keychain: None,
                connection_id: None,
            }
        }

        #[test]
        fn test_mysql_url_basic() {
            let params = create_params(
                "mysql",
                "localhost",
                Some(3306),
                "root",
                Some("secret"),
                "testdb",
            );
            let url = build_connection_url(&params).unwrap();
            assert_eq!(url, "mysql://root:secret@localhost:3306/testdb");
        }

        #[test]
        fn test_postgres_url_basic() {
            let params = create_params(
                "postgres",
                "localhost",
                Some(5432),
                "postgres",
                Some("secret"),
                "testdb",
            );
            let url = build_connection_url(&params).unwrap();
            assert_eq!(url, "postgres://postgres:secret@localhost:5432/testdb");
        }

        #[test]
        fn test_sqlite_url() {
            let params = create_params("sqlite", "", None, "", None, "/path/to/db.sqlite");
            let url = build_connection_url(&params).unwrap();
            assert_eq!(url, "sqlite:///path/to/db.sqlite");
        }

        #[test]
        fn test_url_encoding_special_chars() {
            let params = create_params(
                "mysql",
                "localhost",
                Some(3306),
                "user@domain",
                Some("pass#word"),
                "mydb",
            );
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains("user%40domain"));
            assert!(url.contains("pass%23word"));
        }

        #[test]
        fn test_default_ports() {
            let mysql_params = create_params("mysql", "localhost", None, "root", None, "testdb");
            let pg_params =
                create_params("postgres", "localhost", None, "postgres", None, "testdb");

            let mysql_url = build_connection_url(&mysql_params).unwrap();
            let pg_url = build_connection_url(&pg_params).unwrap();

            assert!(mysql_url.contains(":3306/"));
            assert!(pg_url.contains(":5432/"));
        }

        #[test]
        fn test_no_password() {
            let params = create_params("mysql", "localhost", Some(3306), "root", None, "testdb");
            let url = build_connection_url(&params).unwrap();
            assert_eq!(url, "mysql://root:@localhost:3306/testdb");
        }

        #[test]
        fn test_unsupported_driver() {
            let params = create_params("mongodb", "localhost", Some(27017), "user", None, "testdb");
            let result = build_connection_url(&params);
            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), "Unsupported driver");
        }

        #[test]
        fn test_remote_host() {
            let params = create_params(
                "postgres",
                "db.example.com",
                Some(5432),
                "admin",
                Some("pass"),
                "production",
            );
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains("db.example.com"));
            assert!(!url.contains("localhost"));
        }
    }

    mod resolve_ssh_password_tests {
        use super::*;
        use crate::models::SshConnection;

        fn create_ssh_conn(
            id: &str,
            password: Option<&str>,
            save_in_keychain: bool,
        ) -> SshConnection {
            SshConnection {
                id: id.to_string(),
                name: "Test".to_string(),
                host: "localhost".to_string(),
                port: 22,
                user: "root".to_string(),
                auth_type: Some("password".to_string()),
                password: password.map(|p| p.to_string()),
                key_file: None,
                key_passphrase: None,
                save_in_keychain: Some(save_in_keychain),
            }
        }

        #[test]
        fn test_ssh_password_prefers_request() {
            let result = resolve_ssh_test_password(
                Some("from_request"),
                Some("conn_id"),
                |_| None,
                |_| Ok("kc".to_string()),
            );
            assert_eq!(result, Some("from_request".to_string()));
        }

        #[test]
        fn test_ssh_password_from_keychain() {
            let saved = create_ssh_conn("id1", None, true);
            let result = resolve_ssh_test_password(
                None,
                Some("id1"),
                |_| Some(saved.clone()),
                |_| Ok("kc".to_string()),
            );
            assert_eq!(result, Some("kc".to_string()));
        }

        #[test]
        fn test_ssh_password_from_saved_when_not_keychain() {
            let saved = create_ssh_conn("id1", Some("stored"), false);
            let result = resolve_ssh_test_password(
                None,
                Some("id1"),
                |_| Some(saved.clone()),
                |_| Ok("kc".to_string()),
            );
            assert_eq!(result, Some("stored".to_string()));
        }

        #[test]
        fn test_ssh_password_fallback_to_saved_when_keychain_empty() {
            let saved = create_ssh_conn("id1", Some("stored"), true);
            let result = resolve_ssh_test_password(
                None,
                Some("id1"),
                |_| Some(saved.clone()),
                |_| Ok("  ".to_string()),
            );
            assert_eq!(result, Some("stored".to_string()));
        }

        #[test]
        fn test_ssh_password_returns_none_when_no_id() {
            let result = resolve_ssh_test_password(
                None,
                None,
                |_| panic!("should not be called"),
                |_| panic!("should not be called"),
            );
            assert_eq!(result, None);
        }

        #[test]
        fn test_ssh_password_prefers_request_over_keychain() {
            let saved = create_ssh_conn("id1", None, true);
            let result = resolve_ssh_test_password(
                Some("request_pwd"),
                Some("id1"),
                |_| Some(saved.clone()),
                |_| Ok("kc".to_string()),
            );
            assert_eq!(result, Some("request_pwd".to_string()));
        }

        #[test]
        fn test_ssh_empty_request_password_is_used() {
            let saved = create_ssh_conn("id1", None, true);
            let result = resolve_ssh_test_password(
                Some("   "),
                Some("id1"),
                |_| Some(saved.clone()),
                |_| Ok("kc".to_string()),
            );
            // Empty password from request should be used, not keychain
            assert_eq!(result, Some("   ".to_string()));
        }

        #[test]
        fn test_ssh_returns_none_when_no_password_anywhere() {
            let saved = create_ssh_conn("id1", None, false);
            let result = resolve_ssh_test_password(
                None,
                Some("id1"),
                |_| Some(saved.clone()),
                |_| Ok("".to_string()),
            );
            assert_eq!(result, None);
        }
    }

    mod is_empty_or_whitespace_tests {
        use super::*;

        #[test]
        fn test_none_is_empty() {
            assert!(is_empty_or_whitespace(&None));
        }

        #[test]
        fn test_empty_string_is_empty() {
            assert!(is_empty_or_whitespace(&Some("".to_string())));
        }

        #[test]
        fn test_whitespace_only_is_empty() {
            assert!(is_empty_or_whitespace(&Some("   ".to_string())));
        }

        #[test]
        fn test_tab_newline_is_empty() {
            assert!(is_empty_or_whitespace(&Some("\t\n  ".to_string())));
        }

        #[test]
        fn test_content_is_not_empty() {
            assert!(!is_empty_or_whitespace(&Some("content".to_string())));
        }

        #[test]
        fn test_content_with_whitespace_is_not_empty() {
            assert!(!is_empty_or_whitespace(&Some("  content  ".to_string())));
        }
    }

    mod resolve_connection_params_tests {
        use super::*;

        fn create_ssh_params(
            ssh_host: &str,
            ssh_port: u16,
            ssh_user: &str,
            remote_host: &str,
            remote_port: u16,
        ) -> ConnectionParams {
            ConnectionParams {
                driver: "mysql".to_string(),
                host: Some(remote_host.to_string()),
                port: Some(remote_port),
                username: Some("dbuser".to_string()),
                password: Some("dbpass".to_string()),
                database: "testdb".to_string(),
                ssh_enabled: Some(true),
                ssh_connection_id: None,
                ssh_host: Some(ssh_host.to_string()),
                ssh_port: Some(ssh_port),
                ssh_user: Some(ssh_user.to_string()),
                ssh_password: None,
                ssh_key_file: Some("/home/user/.ssh/id_rsa".to_string()),
                ssh_key_passphrase: None,
                save_in_keychain: None,
                connection_id: None,
            }
        }

        #[test]
        fn test_non_ssh_params_unchanged() {
            let params = base_params();
            let result = resolve_connection_params(&params).unwrap();
            assert_eq!(result.host, Some("localhost".to_string()));
            assert_eq!(result.port, Some(3306));
        }

        #[test]
        fn test_ssh_params_require_host() {
            let mut params = create_ssh_params("jump.server", 22, "admin", "db.internal", 3306);
            params.ssh_host = None;
            let result = resolve_connection_params(&params);
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("SSH Host"));
        }

        #[test]
        fn test_ssh_params_require_user() {
            let mut params = create_ssh_params("jump.server", 22, "admin", "db.internal", 3306);
            params.ssh_user = None;
            let result = resolve_connection_params(&params);
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("SSH User"));
        }
    }

    mod url_encoding_edge_cases {
        use super::*;

        #[test]
        fn test_unicode_username() {
            let mut params = base_params();
            params.username = Some("用户".to_string());
            let url = build_connection_url(&params).unwrap();
            // URL should contain percent-encoded UTF-8
            assert!(url.contains("%E7%94%A8%E6%88%B7"));
        }

        #[test]
        fn test_password_with_colon() {
            let mut params = base_params();
            params.password = Some("pass:word".to_string());
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains("pass%3Aword"));
        }

        #[test]
        fn test_password_with_at_sign() {
            let mut params = base_params();
            params.password = Some("pass@word".to_string());
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains("pass%40word"));
        }

        #[test]
        fn test_password_with_slash() {
            let mut params = base_params();
            params.password = Some("pass/word".to_string());
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains("pass%2Fword"));
        }

        #[test]
        fn test_empty_username_and_password() {
            let mut params = base_params();
            params.username = None;
            params.password = None;
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains(":@localhost"));
        }

        #[test]
        fn test_host_with_port_in_url() {
            let mut params = base_params();
            params.host = Some("192.168.1.100".to_string());
            params.port = Some(33060);
            let url = build_connection_url(&params).unwrap();
            assert!(url.contains("192.168.1.100:33060"));
        }
    }
}

#[tauri::command]
pub async fn list_databases<R: Runtime>(
    app: AppHandle<R>,
    request: TestConnectionRequest,
) -> Result<Vec<String>, String> {
    let mut expanded_params = expand_ssh_connection_params(&app, &request.params).await?;

    if request.params.password.is_none() && expanded_params.password.is_none() {
        let saved_conn = match &request.connection_id {
            Some(id) => find_connection_by_id(&app, id).ok(),
            None => None,
        };
        expanded_params.password =
            resolve_test_connection_password(&request.params, saved_conn.as_ref(), |conn_id| {
                keychain_utils::get_db_password(conn_id)
            });
    }

    let resolved_params = if let Some(conn_id) = &request.connection_id {
        resolve_connection_params_with_id(&expanded_params, conn_id)?
    } else {
        resolve_connection_params(&expanded_params)?
    };

    println!(
        "[List Databases] Resolved Params: Host={:?}, Port={:?}, Username={:?}, Password={:?}",
        resolved_params.host,
        resolved_params.port,
        resolved_params.username,
        resolved_params.password
    );

    match resolved_params.driver.as_str() {
        "mysql" => {
            let mut params = resolved_params.clone();
            params.database = "information_schema".to_string();
            mysql::get_databases(&params).await
        }
        "postgres" => {
            let mut params = resolved_params.clone();
            params.database = "postgres".to_string();
            postgres::get_databases(&params).await
        }
        "sqlite" => sqlite::get_databases(&resolved_params).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_tables<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    log::info!("Fetching tables for connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    log::debug!(
        "Getting tables from {} database: {}",
        saved_conn.params.driver,
        params.database
    );

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_tables(&params).await,
        "postgres" => postgres::get_tables(&params, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_tables(&params).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(tables) => log::info!("Retrieved {} tables from {}", tables.len(), params.database),
        Err(e) => log::error!("Failed to get tables from {}: {}", params.database, e),
    }

    result
}

#[tauri::command]
pub async fn get_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
) -> Result<Vec<TableColumn>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_columns(&params, &table_name).await,
        "postgres" => postgres::get_columns(&params, &table_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_columns(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_foreign_keys<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
) -> Result<Vec<ForeignKey>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_foreign_keys(&params, &table_name).await,
        "postgres" => postgres::get_foreign_keys(&params, &table_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_foreign_keys(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_indexes<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
) -> Result<Vec<Index>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_indexes(&params, &table_name).await,
        "postgres" => postgres::get_indexes(&params, &table_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_indexes(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn delete_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    pk_col: String,
    pk_val: serde_json::Value,
    schema: Option<String>,
) -> Result<u64, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::delete_record(&params, &table, &pk_col, pk_val).await,
        "postgres" => postgres::delete_record(&params, &table, &pk_col, pk_val, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::delete_record(&params, &table, &pk_col, pk_val).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn update_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    pk_col: String,
    pk_val: serde_json::Value,
    col_name: String,
    new_val: serde_json::Value,
    schema: Option<String>,
) -> Result<u64, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val).await,
        "postgres" => {
            postgres::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref().unwrap_or("public")).await
        }
        "sqlite" => {
            sqlite::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val).await
        }
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn insert_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    data: std::collections::HashMap<String, serde_json::Value>,
    schema: Option<String>,
) -> Result<u64, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::insert_record(&params, &table, data).await,
        "postgres" => postgres::insert_record(&params, &table, data, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::insert_record(&params, &table, data).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, QueryCancellationState>,
    connection_id: String,
) -> Result<(), String> {
    let mut handles = state.handles.lock().unwrap();
    if let Some(handle) = handles.remove(&connection_id) {
        handle.abort();
        Ok(())
    } else {
        Err("No running query found".into())
    }
}

#[tauri::command]
pub async fn execute_query<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, QueryCancellationState>,
    connection_id: String,
    query: String,
    limit: Option<u32>,
    page: Option<u32>,
    schema: Option<String>,
) -> Result<QueryResult, String> {
    log::info!(
        "Executing query on connection: {} | Query: {}",
        connection_id,
        query.chars().take(200).collect::<String>()
    );

    // 1. Sanitize Query (Ignore trailing semicolon + normalize smart quotes)
    let sanitized_query = query
        .trim()
        .trim_end_matches(';')
        .replace('\u{2018}', "'")  // Left single quotation mark
        .replace('\u{2019}', "'")  // Right single quotation mark
        .replace('\u{201C}', "\"") // Left double quotation mark
        .replace('\u{201D}', "\"") // Right double quotation mark
        .to_string();

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    // 2. Spawn Cancellable Task
    let task = tokio::spawn(async move {
        match saved_conn.params.driver.as_str() {
            "mysql" => {
                mysql::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await
            }
            "postgres" => {
                postgres::execute_query(
                    &params,
                    &sanitized_query,
                    limit,
                    page.unwrap_or(1),
                    schema.as_deref(),
                )
                .await
            }
            "sqlite" => {
                sqlite::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await
            }
            _ => Err("Unsupported driver".into()),
        }
    });

    // 3. Register Abort Handle
    let abort_handle = task.abort_handle();
    {
        let mut handles = state.handles.lock().unwrap();
        // If a query is already running for this connection, we overwrite the handle.
        // Ideally we should cancel the previous one, but the UI should prevent double run.
        handles.insert(connection_id.clone(), abort_handle);
    }

    // 4. Await & Handle Cancellation
    let result = task.await;

    // 5. Cleanup
    {
        let mut handles = state.handles.lock().unwrap();
        // Only remove if it matches (edge case: multiple queries, but connection_id is unique per tab usually)
        handles.remove(&connection_id);
    }

    match result {
        Ok(Ok(query_result)) => {
            log::info!(
                "Query executed successfully, returned {} rows",
                query_result.rows.len()
            );
            Ok(query_result)
        }
        Ok(Err(e)) => {
            log::error!("Query execution failed: {}", e);
            Err(e)
        }
        Err(_) => {
            log::warn!("Query was cancelled");
            Err("Query cancelled".into())
        }
    }
}

// --- Window Title Management ---

/// Sets the window title with Wayland workaround
///
/// WORKAROUND: This is a temporary fix for tauri-apps/tauri#13749
/// On Wayland (Linux), the standard `window.setTitle()` API doesn't properly update
/// the window title in the window manager's title bar due to an upstream dependency issue.
/// This command directly manipulates the GTK HeaderBar to ensure the title is visible.
///
/// See: https://github.com/tauri-apps/tauri/issues/13749
///
/// This workaround should be removed once the upstream issue is resolved.
#[tauri::command]
pub async fn set_window_title(app: AppHandle, title: String) -> Result<(), String> {
    // Get the main window
    let window = app
        .get_webview_window("main")
        .ok_or("Failed to get main window")?;

    // Set title using standard Tauri API (works on all platforms)
    window
        .set_title(&title)
        .map_err(|e| format!("Failed to set window title: {}", e))?;

    // Apply Wayland-specific workaround on Linux
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::{BinExt, Cast, GtkWindowExt, HeaderBarExt};
        use gtk::{EventBox, HeaderBar};

        // Get the GTK window
        let gtk_window = window
            .gtk_window()
            .map_err(|e| format!("Failed to get GTK window: {}", e))?;

        // Check if we have a custom titlebar (Wayland uses EventBox with HeaderBar)
        if let Some(titlebar) = gtk_window.titlebar() {
            // Try to downcast to EventBox (Wayland)
            if let Ok(event_box) = titlebar.downcast::<EventBox>() {
                // Get the HeaderBar child and set its title
                if let Some(child) = event_box.child() {
                    if let Ok(header_bar) = child.downcast::<HeaderBar>() {
                        header_bar.set_title(Some(&title));
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn open_er_diagram_window(
    app: AppHandle,
    connection_id: String,
    connection_name: String,
    database_name: String,
    focus_table: Option<String>,
    schema: Option<String>,
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use urlencoding::encode;

    let schema_suffix = schema.as_deref().map(|s| format!("/{}", s)).unwrap_or_default();
    let title = format!("tabularis - {} ({}{})", database_name, connection_name, schema_suffix);
    let mut url = format!(
        "/schema-diagram?connectionId={}&connectionName={}&databaseName={}",
        encode(&connection_id),
        encode(&connection_name),
        encode(&database_name)
    );

    if let Some(table) = focus_table {
        url.push_str(&format!("&focusTable={}", encode(&table)));
    }

    if let Some(s) = &schema {
        url.push_str(&format!("&schema={}", encode(s)));
    }

    let _webview = WebviewWindowBuilder::new(&app, "er-diagram", WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(1200.0, 800.0)
        .center()
        .build()
        .map_err(|e| format!("Failed to create ER Diagram window: {}", e))?;

    Ok(())
}

/// Builds a connection URL for a database driver.
/// This is a pure function that can be tested without a database connection.
#[inline]
pub fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let host = params.host.as_deref().unwrap_or("localhost");

    match params.driver.as_str() {
        "sqlite" => Ok(format!("sqlite://{}", params.database)),
        "postgres" => Ok(format!(
            "postgres://{}:{}@{}:{}/{}",
            user,
            pass,
            host,
            params.port.unwrap_or(DEFAULT_POSTGRES_PORT),
            params.database
        )),
        "mysql" => Ok(format!(
            "mysql://{}:{}@{}:{}/{}",
            user,
            pass,
            host,
            params.port.unwrap_or(DEFAULT_MYSQL_PORT),
            params.database
        )),
        _ => Err("Unsupported driver".into()),
    }
}

fn resolve_test_connection_password(
    params: &ConnectionParams,
    saved_conn: Option<&SavedConnection>,
    get_keychain_password: impl Fn(&str) -> Result<String, String>,
) -> Option<String> {
    if let Some(pwd) = &params.password {
        return Some(pwd.clone());
    }

    let saved = saved_conn?;

    if saved.params.save_in_keychain.unwrap_or(false) {
        if let Ok(pwd) = get_keychain_password(&saved.id) {
            if !pwd.trim().is_empty() {
                return Some(pwd);
            }
        }
    }

    match &saved.params.password {
        Some(pwd) if !pwd.trim().is_empty() => Some(pwd.clone()),
        _ => None,
    }
}

/// Resolves SSH credential (password or passphrase) for testing
/// 1. Credential from request params (if provided, even if empty)
/// 2. Credential from keychain (if save_in_keychain is enabled)
/// 3. Credential from saved connection (as fallback)
fn resolve_ssh_test_credential(
    request_credential: Option<&str>,
    connection_id: Option<&str>,
    get_ssh_connection: impl Fn(&str) -> Option<SshConnection>,
    get_keychain_credential: impl Fn(&str) -> Result<String, String>,
    extract_saved_credential: impl Fn(&SshConnection) -> Option<String>,
) -> Option<String> {
    // Priority 1: Credential from request
    // If credential field is present in request, use it even if empty
    // Empty string means "use empty credential", not "fallback to keychain"
    if let Some(cred) = request_credential {
        return Some(cred.to_string());
    }

    // If no connection_id, we can't look up saved credentials
    let conn_id = connection_id?;
    let saved = get_ssh_connection(conn_id)?;

    // Priority 2: Credential from keychain
    if saved.save_in_keychain.unwrap_or(false) {
        if let Ok(cred) = get_keychain_credential(conn_id) {
            if !cred.trim().is_empty() {
                return Some(cred);
            }
        }
    }

    // Priority 3: Credential from saved connection
    extract_saved_credential(&saved)
}

/// Helper for backward compatibility - resolves SSH password
fn resolve_ssh_test_password(
    request_password: Option<&str>,
    connection_id: Option<&str>,
    get_ssh_connection: impl Fn(&str) -> Option<SshConnection>,
    get_keychain_password: impl Fn(&str) -> Result<String, String>,
) -> Option<String> {
    resolve_ssh_test_credential(
        request_password,
        connection_id,
        get_ssh_connection,
        get_keychain_password,
        |conn| {
            conn.password
                .as_ref()
                .filter(|p| !p.trim().is_empty())
                .cloned()
        },
    )
}

// ==================== View Management Commands ====================

#[tauri::command]
pub async fn get_views<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<crate::models::ViewInfo>, String> {
    log::info!("Fetching views for connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    log::debug!(
        "Getting views from {} database: {}",
        saved_conn.params.driver,
        params.database
    );

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_views(&params).await,
        "postgres" => postgres::get_views(&params, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_views(&params).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(views) => log::info!("Retrieved {} views from {}", views.len(), params.database),
        Err(e) => log::error!("Failed to get views from {}: {}", params.database, e),
    }

    result
}

#[tauri::command]
pub async fn get_view_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching view definition for: {} on connection: {}",
        view_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_view_definition(&params, &view_name).await,
        "postgres" => postgres::get_view_definition(&params, &view_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_view_definition(&params, &view_name).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(_) => log::info!("Successfully retrieved view definition for {}", view_name),
        Err(e) => log::error!("Failed to get view definition for {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn create_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    definition: String,
    schema: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Creating view: {} on connection: {}",
        view_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::create_view(&params, &view_name, &definition).await,
        "postgres" => postgres::create_view(&params, &view_name, &definition, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::create_view(&params, &view_name, &definition).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(_) => log::info!("Successfully created view: {}", view_name),
        Err(e) => log::error!("Failed to create view {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn alter_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    definition: String,
    schema: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Altering view: {} on connection: {}",
        view_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::alter_view(&params, &view_name, &definition).await,
        "postgres" => postgres::alter_view(&params, &view_name, &definition, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::alter_view(&params, &view_name, &definition).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(_) => log::info!("Successfully altered view: {}", view_name),
        Err(e) => log::error!("Failed to alter view {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn drop_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Dropping view: {} on connection: {}",
        view_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::drop_view(&params, &view_name).await,
        "postgres" => postgres::drop_view(&params, &view_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::drop_view(&params, &view_name).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(_) => log::info!("Successfully dropped view: {}", view_name),
        Err(e) => log::error!("Failed to drop view {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn get_view_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
) -> Result<Vec<TableColumn>, String> {
    log::info!(
        "Fetching view columns for: {} on connection: {}",
        view_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_view_columns(&params, &view_name).await,
        "postgres" => postgres::get_view_columns(&params, &view_name, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_view_columns(&params, &view_name).await,
        _ => Err("Unsupported driver".into()),
    };

    match &result {
        Ok(columns) => log::info!("Retrieved {} columns for view {}", columns.len(), view_name),
        Err(e) => log::error!("Failed to get view columns for {}: {}", view_name, e),
    }

    result
}

/// Disconnect from a database connection by closing its connection pool
#[tauri::command]
pub async fn disconnect_connection<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<(), String> {
    log::info!("Disconnecting from connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;

    // Close the connection pool
    crate::pool_manager::close_pool_with_id(&params, Some(&connection_id)).await;

    log::info!("Successfully disconnected from connection: {}", connection_id);
    Ok(())
}
