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
    ConnectionParams, ForeignKey, Index, QueryResult, SavedConnection, TableColumn, TableInfo,
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

fn resolve_connection_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
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

fn get_config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("connections.json"))
}

fn find_connection_by_id<R: Runtime>(
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
        match keychain_utils::get_ssh_password(&conn.id) {
            Ok(ssh_pwd) => conn.params.ssh_password = Some(ssh_pwd),
            Err(e) => eprintln!(
                "[Warning] Failed to retrieve SSH password for connection '{}' ({}): {}",
                conn.name, conn.id, e
            ),
        }
    }

    Ok(conn)
}

// --- Commands ---

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
        if let Some(ssh_pwd) = &params.ssh_password {
            keychain_utils::set_ssh_password(&id, ssh_pwd)?;
        }
        params_to_save.password = None;
        params_to_save.ssh_password = None;
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
        if let Some(ssh_pwd) = &params.ssh_password {
            keychain_utils::set_ssh_password(&id, ssh_pwd)?;
        }
        params_to_save.password = None;
        params_to_save.ssh_password = None;
    } else {
        keychain_utils::delete_db_password(&id).ok();
        keychain_utils::delete_ssh_password(&id).ok();
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
        if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&original.id) {
            original.params.ssh_password = Some(ssh_pwd);
        }
    }

    let new_id = Uuid::new_v4().to_string();
    let mut new_params = original.params.clone();

    // Save passwords to new keychain entries if enabled
    if new_params.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &new_params.password {
            keychain_utils::set_db_password(&new_id, pwd)?;
        }
        if let Some(ssh_pwd) = &new_params.ssh_password {
            keychain_utils::set_ssh_password(&new_id, ssh_pwd)?;
        }
        new_params.password = None;
        new_params.ssh_password = None;
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
    }

    Ok(returned_conn)
}

#[tauri::command]
pub async fn get_connections<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<SavedConnection>, String> {
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
            if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&conn.id) {
                conn.params.ssh_password = Some(ssh_pwd);
            }
        }
    }

    Ok(connections)
}

#[tauri::command]
pub async fn test_connection(params: ConnectionParams) -> Result<String, String> {
    let resolved_params = resolve_connection_params(&params)?;
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
pub async fn get_tables<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<TableInfo>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;
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
    let params = resolve_connection_params(&saved_conn.params)?;

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
