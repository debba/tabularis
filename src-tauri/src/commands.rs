use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use tauri::{AppHandle, Manager, Runtime, State};
use uuid::Uuid;
use sqlx::any::AnyConnectOptions;
use sqlx::{Connection, ConnectOptions, AnyConnection};
use urlencoding::encode;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::task::AbortHandle;

use crate::ssh_tunnel::{SshTunnel, get_tunnels};
use crate::models::{ConnectionParams, SavedConnection, TableInfo, TableColumn, QueryResult};
use crate::drivers::{mysql, postgres, sqlite};

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

        let map_key = format!("{}@{}:{}:{}->{}", ssh_user, ssh_host, ssh_port, remote_host, remote_port);
        
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
            ssh_host, ssh_port, ssh_user, 
            params.ssh_password.as_deref(), 
            params.ssh_key_file.as_deref(),
            remote_host, remote_port
        )?;
        
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
    connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Connection not found".to_string())
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
    let new_conn = SavedConnection {
        id: Uuid::new_v4().to_string(),
        name,
        params,
    };
    connections.push(new_conn.clone());
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(new_conn)
}

#[tauri::command]
pub async fn delete_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let path = get_config_path(&app)?;
    if !path.exists() { return Ok(()); }
    
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();
    
    connections.retain(|c| c.id != id);
    
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
    
    let conn_idx = connections.iter().position(|c| c.id == id).ok_or("Connection not found")?;
    
    let updated = SavedConnection {
        id: id.clone(),
        name,
        params,
    };
    
    connections[conn_idx] = updated.clone();
    
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(updated)
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
    let connections: Vec<SavedConnection> = serde_json::from_str(&content).unwrap_or_default();
    Ok(connections)
}

#[tauri::command]
pub async fn test_connection(params: ConnectionParams) -> Result<String, String> {
    let resolved_params = resolve_connection_params(&params)?;
    println!("[Test Connection] Resolved Params: Host={:?}, Port={:?}", resolved_params.host, resolved_params.port);
    
    let user = encode(resolved_params.username.as_deref().unwrap_or_default());
    let pass = encode(resolved_params.password.as_deref().unwrap_or_default());
    let host = resolved_params.host.as_deref().unwrap_or("localhost");

    let url = match resolved_params.driver.as_str() {
        "sqlite" => format!("sqlite://{}", resolved_params.database),
        "postgres" => format!("postgres://{}:{}@{}:{}/{}", 
            user, pass, host, resolved_params.port.unwrap_or(5432), resolved_params.database),
        "mysql" => format!("mysql://{}:{}@{}:{}/{}", 
            user, pass, host, resolved_params.port.unwrap_or(3306), resolved_params.database),
        _ => return Err("Unsupported driver".into()),
    };
    
    println!("[Test Connection] URL: {}", url);

    let options = AnyConnectOptions::from_str(&url).map_err(|e| e.to_string())?;
    let mut conn = AnyConnection::connect_with(&options).await.map_err(|e: sqlx::Error| e.to_string())?;
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
        "postgres" => postgres::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val).await,
        "sqlite" => sqlite::update_record(&params, &table, &pk_col, pk_val, &col_name, new_val).await,
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
            "mysql" => mysql::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await,
            "postgres" => postgres::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await,
            "sqlite" => sqlite::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await,
            _ => Err("Unsupported driver".into())
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
