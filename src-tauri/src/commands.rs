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
    ConnectionParams, ForeignKey, Index, QueryResult, SavedConnection, SshConnection, SshConnectionInput, SshTestParams,
    TableColumn, TableInfo,
};
use crate::ssh_tunnel::{get_tunnels, SshTunnel};

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
        if let Some(ssh_id) = &params.ssh_connection_id {
            let ssh_connections = get_ssh_connections(app.clone()).await?;
            let ssh_conn = ssh_connections
                .iter()
                .find(|s| &s.id == ssh_id)
                .ok_or_else(|| format!("SSH connection with ID {} not found", ssh_id))?;

            // Populate legacy SSH fields from the SSH connection
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

pub fn resolve_connection_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
    if params.ssh_enabled.unwrap_or(false) {
        let ssh_host = params.ssh_host.as_deref().ok_or("Missing SSH Host")?;
        let ssh_port = params.ssh_port.unwrap_or(22);
        let ssh_user = params.ssh_user.as_deref().ok_or("Missing SSH User")?;
        let remote_host = params.host.as_deref().unwrap_or("localhost");
        let remote_port = params.port.unwrap_or(3306);

        let map_key = format!(
            "{}@{}:{}:{}->{}",
            ssh_user, ssh_host, ssh_port, remote_host, remote_port
        );

        {
            let tunnels = get_tunnels().lock().unwrap();
            if let Some(tunnel) = tunnels.get(&map_key) {
                let mut new_params = params.clone();
                new_params.host = Some("127.0.0.1".to_string());
                new_params.port = Some(tunnel.local_port);
                return Ok(new_params);
            }
        }

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

        {
            let mut tunnels = get_tunnels().lock().unwrap();
            tunnels.insert(map_key, tunnel);
        }

        let mut new_params = params.clone();
        new_params.host = Some("127.0.0.1".to_string());
        new_params.port = Some(local_port);
        Ok(new_params)
    } else {
        Ok(params.clone())
    }
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

    if conn.params.save_in_keychain.unwrap_or(false) {
        match keychain_utils::get_db_password(&conn.id) {
            Ok(pwd) => conn.params.password = Some(pwd),
            Err(e) => eprintln!(
                "[Warning] Failed to retrieve DB password for connection '{}' ({}): {}",
                conn.name, conn.id, e
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
pub async fn get_schema_snapshot<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<crate::models::TableSchema>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    let driver = saved_conn.params.driver.clone();

    // 1. Get Tables
    let tables = match driver.as_str() {
        "mysql" => mysql::get_tables(&params).await,
        "postgres" => postgres::get_tables(&params).await,
        "sqlite" => sqlite::get_tables(&params).await,
        _ => Err("Unsupported driver".into()),
    }?;

    // 2. Fetch ALL columns and foreign keys in batch (2 queries instead of N*2)
    let schema = match driver.as_str() {
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
            let mut columns_map = postgres::get_all_columns_batch(&params).await?;
            let mut fks_map = postgres::get_all_foreign_keys_batch(&params).await?;

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

    Ok(schema)
}

#[tauri::command]
pub async fn save_connection<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    params: ConnectionParams,
) -> Result<SavedConnection, String> {
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
        name,
        params: params_to_save,
    };
    connections.push(new_conn.clone());
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_conn = new_conn;
    returned_conn.params = params; // Return with password for frontend state
    Ok(returned_conn)
}

#[tauri::command]
pub async fn delete_connection<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let path = get_config_path(&app)?;
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

    connections.retain(|c| c.id != id);

    // Attempt to remove passwords from keychain (ignore if not found)
    keychain_utils::delete_db_password(&id).ok();
    keychain_utils::delete_ssh_password(&id).ok();
    keychain_utils::delete_ssh_key_passphrase(&id).ok();

    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
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
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();

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
    }

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
                        auth_type: Some(
                            if !key_file.is_empty() {
                                "ssh_key".to_string()
                            } else {
                                "password".to_string()
                            }
                        ),
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
    let conn_json = serde_json::to_string_pretty(&migrated_connections).map_err(|e| e.to_string())?;
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
                if ssh.key_file.is_some() && ssh.key_file.as_ref().map_or(false, |k| !k.trim().is_empty()) {
                    "ssh_key".to_string()
                } else {
                    "password".to_string()
                }
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
pub async fn test_ssh_connection(ssh: SshTestParams) -> Result<String, String> {
    use crate::ssh_tunnel;

    ssh_tunnel::test_ssh_connection(
        &ssh.host,
        ssh.port,
        &ssh.user,
        ssh.password.as_deref(),
        ssh.key_file.as_deref(),
        ssh.key_passphrase.as_deref(),
    )
}

#[tauri::command]
pub async fn test_connection<R: Runtime>(
    app: AppHandle<R>,
    params: ConnectionParams,
) -> Result<String, String> {
    let expanded_params = expand_ssh_connection_params(&app, &params).await?;
    let resolved_params = resolve_connection_params(&expanded_params)?;
    println!(
        "[Test Connection] Resolved Params: Host={:?}, Port={:?}",
        resolved_params.host, resolved_params.port
    );

    let user = encode(resolved_params.username.as_deref().unwrap_or_default());
    let pass = encode(resolved_params.password.as_deref().unwrap_or_default());
    let host = resolved_params.host.as_deref().unwrap_or("localhost");

    let url = match resolved_params.driver.as_str() {
        "sqlite" => format!("sqlite://{}", resolved_params.database),
        "postgres" => format!(
            "postgres://{}:{}@{}:{}/{}",
            user,
            pass,
            host,
            resolved_params.port.unwrap_or(5432),
            resolved_params.database
        ),
        "mysql" => format!(
            "mysql://{}:{}@{}:{}/{}",
            user,
            pass,
            host,
            resolved_params.port.unwrap_or(3306),
            resolved_params.database
        ),
        _ => return Err("Unsupported driver".into()),
    };

    println!("[Test Connection] URL: {}", url);

    let options = AnyConnectOptions::from_str(&url).map_err(|e| e.to_string())?;
    let mut conn = AnyConnection::connect_with(&options)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    conn.ping().await.map_err(|e: sqlx::Error| e.to_string())?;
    Ok("Connection successful!".to_string())
}

#[tauri::command]
pub async fn list_databases<R: Runtime>(
    app: AppHandle<R>,
    params: ConnectionParams,
) -> Result<Vec<String>, String> {
    let expanded_params = expand_ssh_connection_params(&app, &params).await?;
    let resolved_params = resolve_connection_params(&expanded_params)?;
    
    match resolved_params.driver.as_str() {
        "mysql" => mysql::get_databases(&resolved_params).await,
        "postgres" => postgres::get_databases(&resolved_params).await,
        "sqlite" => sqlite::get_databases(&resolved_params).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_tables<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<TableInfo>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_tables(&params).await,
        "postgres" => postgres::get_tables(&params).await,
        "sqlite" => sqlite::get_tables(&params).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
) -> Result<Vec<TableColumn>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_columns(&params, &table_name).await,
        "postgres" => postgres::get_columns(&params, &table_name).await,
        "sqlite" => sqlite::get_columns(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_foreign_keys<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
) -> Result<Vec<ForeignKey>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_foreign_keys(&params, &table_name).await,
        "postgres" => postgres::get_foreign_keys(&params, &table_name).await,
        "sqlite" => sqlite::get_foreign_keys(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }
}

#[tauri::command]
pub async fn get_indexes<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
) -> Result<Vec<Index>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_indexes(&params, &table_name).await,
        "postgres" => postgres::get_indexes(&params, &table_name).await,
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
) -> Result<u64, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::delete_record(&params, &table, &pk_col, pk_val).await,
        "postgres" => postgres::delete_record(&params, &table, &pk_col, pk_val).await,
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
) -> Result<u64, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val).await,
        "postgres" => {
            postgres::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val).await
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
) -> Result<u64, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::insert_record(&params, &table, data).await,
        "postgres" => postgres::insert_record(&params, &table, data).await,
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
) -> Result<QueryResult, String> {
    // 1. Sanitize Query (Ignore trailing semicolon)
    let sanitized_query = query.trim().trim_end_matches(';').to_string();

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let params = resolve_connection_params(&expanded_params)?;

    // 2. Spawn Cancellable Task
    let task = tokio::spawn(async move {
        match saved_conn.params.driver.as_str() {
            "mysql" => {
                mysql::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await
            }
            "postgres" => {
                postgres::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await
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
        Ok(res) => res,
        Err(_) => Err("Query cancelled".into()),
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
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use urlencoding::encode;

    let title = format!("tabularis - {} ({})", database_name, connection_name);
    let url = format!(
        "/schema-diagram?connectionId={}&connectionName={}&databaseName={}",
        encode(&connection_id),
        encode(&connection_name),
        encode(&database_name)
    );

    let _webview = WebviewWindowBuilder::new(&app, "er-diagram", WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(1200.0, 800.0)
        .center()
        .build()
        .map_err(|e| format!("Failed to create ER Diagram window: {}", e))?;

    Ok(())
}
