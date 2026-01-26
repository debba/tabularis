use sqlx::any::{AnyConnectOptions, AnyRow, AnyKind};
use sqlx::mysql::{MySqlConnectOptions, MySqlRow, MySqlQueryResult};
use sqlx::postgres::{PgConnectOptions, PgRow, PgQueryResult};
use sqlx::sqlite::{SqliteConnectOptions, SqliteRow, SqliteQueryResult};
use sqlx::{Column, Connection, Row, TypeInfo, AnyConnection, ConnectOptions};
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime, DateTime, Utc};

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct ConnectionParams {
    pub driver: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub database: String,
    // SSH Tunnel
    pub ssh_enabled: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_user: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_key_file: Option<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub params: ConnectionParams,
}

#[derive(Debug, serde::Serialize)]
pub struct TableInfo {
    pub name: String,
}

#[derive(Debug, serde::Serialize)]
pub struct TableColumn {
    pub name: String,
    pub data_type: String,
    pub is_pk: bool,
    pub is_nullable: bool,
    pub is_auto_increment: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: u64,
}

// --- Persistence Helpers ---

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
    let url = match params.driver.as_str() {
        "sqlite" => format!("sqlite://{}", params.database),
        "postgres" => format!("postgres://{}:{}@{}:{}/{}", 
            params.username.clone().unwrap_or_default(), params.password.clone().unwrap_or_default(),
            params.host.clone().unwrap_or("localhost".into()), params.port.unwrap_or(5432), params.database),
        "mysql" => format!("mysql://{}:{}@{}:{}/{}", 
            params.username.clone().unwrap_or_default(), params.password.clone().unwrap_or_default(),
            params.host.clone().unwrap_or("localhost".into()), params.port.unwrap_or(3306), params.database),
        _ => return Err("Unsupported driver".into()),
    };
    
    let options = AnyConnectOptions::from_str(&url).map_err(|e| e.to_string())?;
    let mut conn = AnyConnection::connect_with(&options).await.map_err(|e| e.to_string())?;
    conn.ping().await.map_err(|e| e.to_string())?;
    Ok("Connection successful!".to_string())
}

#[tauri::command]
pub async fn get_tables<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<TableInfo>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => get_tables_mysql(&saved_conn.params).await,
        "postgres" => get_tables_postgres(&saved_conn.params).await,
        "sqlite" => get_tables_sqlite(&saved_conn.params).await,
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
    match saved_conn.params.driver.as_str() {
        "mysql" => get_columns_mysql(&saved_conn.params, &table_name).await,
        "postgres" => get_columns_postgres(&saved_conn.params, &table_name).await,
        "sqlite" => get_columns_sqlite(&saved_conn.params, &table_name).await,
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
    match saved_conn.params.driver.as_str() {
        "mysql" => delete_record_mysql(&saved_conn.params, &table, &pk_col, pk_val).await,
        "postgres" => delete_record_postgres(&saved_conn.params, &table, &pk_col, pk_val).await,
        "sqlite" => delete_record_sqlite(&saved_conn.params, &table, &pk_col, pk_val).await,
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
    match saved_conn.params.driver.as_str() {
        "mysql" => update_record_mysql(&saved_conn.params, &table, &pk_col, pk_val, &col_name, new_val).await,
        "postgres" => update_record_postgres(&saved_conn.params, &table, &pk_col, pk_val, &col_name, new_val).await,
        "sqlite" => update_record_sqlite(&saved_conn.params, &table, &pk_col, pk_val, &col_name, new_val).await,
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
    match saved_conn.params.driver.as_str() {
        "mysql" => insert_record_mysql(&saved_conn.params, &table, data).await,
        "postgres" => insert_record_postgres(&saved_conn.params, &table, data).await,
        "sqlite" => insert_record_sqlite(&saved_conn.params, &table, data).await,
        _ => Err("Unsupported driver".into()),
    }
}

// --- Introspection Helpers ---

async fn get_tables_mysql(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query("SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE()")
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| TableInfo { name: r.try_get("name").unwrap_or_default() }).collect())
}

async fn get_tables_postgres(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    let url = format!("postgres://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(5432), params.database);
    let mut conn = sqlx::postgres::PgConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query("SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'")
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| TableInfo { name: r.try_get("name").unwrap_or_default() }).collect())
}

async fn get_tables_sqlite(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| TableInfo { name: r.try_get("name").unwrap_or_default() }).collect())
}

async fn get_columns_mysql(params: &ConnectionParams, table_name: &str) -> Result<Vec<TableColumn>, String> {
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let query = r#"
        SELECT column_name, data_type, column_key, is_nullable, extra 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position
    "#;
    
    let rows = sqlx::query(query)
        .bind(table_name)
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
        
    Ok(rows.iter().map(|r| {
        let key: String = r.try_get("column_key").unwrap_or_default();
        let null_str: String = r.try_get("is_nullable").unwrap_or_default();
        let extra: String = r.try_get("extra").unwrap_or_default();
        TableColumn {
            name: r.try_get("column_name").unwrap_or_default(),
            data_type: r.try_get("data_type").unwrap_or_default(),
            is_pk: key == "PRI",
            is_nullable: null_str == "YES",
            is_auto_increment: extra.contains("auto_increment"),
        }
    }).collect())
}

async fn get_columns_postgres(params: &ConnectionParams, table_name: &str) -> Result<Vec<TableColumn>, String> {
    let url = format!("postgres://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(5432), params.database);
    let mut conn = sqlx::postgres::PgConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    // Postgres auto increment is usually sequences (nextval) or GENERATED BY DEFAULT/ALWAYS AS IDENTITY
    let query = r#"
        SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable,
            c.column_default,
            c.is_identity,
            (SELECT COUNT(*) FROM information_schema.table_constraints tc 
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             WHERE tc.constraint_type = 'PRIMARY KEY' 
             AND kcu.table_name = c.table_name 
             AND kcu.column_name = c.column_name) > 0 as is_pk
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = $1
        ORDER BY c.ordinal_position
    "#;

    let rows = sqlx::query(query)
        .bind(table_name)
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;

    Ok(rows.iter().map(|r| {
        let null_str: String = r.try_get("is_nullable").unwrap_or_default();
        let is_pk: i64 = r.try_get("is_pk").unwrap_or(0);
        let default_val: String = r.try_get("column_default").unwrap_or_default();
        let is_identity: String = r.try_get("is_identity").unwrap_or_default(); // YES/NO
        
        let is_auto = is_identity == "YES" || default_val.contains("nextval");

        TableColumn {
            name: r.try_get("column_name").unwrap_or_default(),
            data_type: r.try_get("data_type").unwrap_or_default(),
            is_pk: is_pk > 0,
            is_nullable: null_str == "YES",
            is_auto_increment: is_auto,
        }
    }).collect())
}

async fn get_columns_sqlite(params: &ConnectionParams, table_name: &str) -> Result<Vec<TableColumn>, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    // PRAGMA table_info doesn't explicitly say "AUTO_INCREMENT"
    // But INTEGER PRIMARY KEY is implicitly so in sqlite.
    // Also if 'pk' > 0 and type is INTEGER.
    let query = format!("PRAGMA table_info('{}')", table_name);
    
    let rows = sqlx::query(&query)
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
        
    Ok(rows.iter().map(|r| {
        let pk: i32 = r.try_get("pk").unwrap_or(0);
        let notnull: i32 = r.try_get("notnull").unwrap_or(0);
        let dtype: String = r.try_get("type").unwrap_or_default();
        
        let is_auto = pk > 0 && dtype.to_uppercase().contains("INT");

        TableColumn {
            name: r.try_get("name").unwrap_or_default(),
            data_type: dtype,
            is_pk: pk > 0,
            is_nullable: notnull == 0,
            is_auto_increment: is_auto,
        }
    }).collect())
}

// --- Modification Helpers ---

async fn delete_record_mysql(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value) -> Result<u64, String> {
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let query = format!("DELETE FROM `{}` WHERE `{}` = ?", table, pk_col);
    
    let result = match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() { sqlx::query(&query).bind(n.as_i64()).execute(&mut conn).await }
            else if n.is_f64() { sqlx::query(&query).bind(n.as_f64()).execute(&mut conn).await }
            else { sqlx::query(&query).bind(n.to_string()).execute(&mut conn).await }
        },
        serde_json::Value::String(s) => sqlx::query(&query).bind(s).execute(&mut conn).await,
        _ => return Err("Unsupported PK type".into()),
    };
    
    result.map(|r| r.rows_affected()).map_err(|e| e.to_string())
}

async fn delete_record_postgres(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value) -> Result<u64, String> {
    let url = format!("postgres://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(5432), params.database);
    let mut conn = sqlx::postgres::PgConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let query = format!("DELETE FROM \"{}\" WHERE \"{}\" = $1", table, pk_col);
    
    let result = match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() { sqlx::query(&query).bind(n.as_i64()).execute(&mut conn).await }
            else { sqlx::query(&query).bind(n.as_f64()).execute(&mut conn).await }
        },
        serde_json::Value::String(s) => sqlx::query(&query).bind(s).execute(&mut conn).await,
        _ => return Err("Unsupported PK type".into()),
    };
    
    result.map(|r| r.rows_affected()).map_err(|e| e.to_string())
}

async fn delete_record_sqlite(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value) -> Result<u64, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let query = format!("DELETE FROM \"{}\" WHERE \"{}\" = ?", table, pk_col);
    
    let result = match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() { sqlx::query(&query).bind(n.as_i64()).execute(&mut conn).await }
            else { sqlx::query(&query).bind(n.as_f64()).execute(&mut conn).await }
        },
        serde_json::Value::String(s) => sqlx::query(&query).bind(s).execute(&mut conn).await,
        _ => return Err("Unsupported PK type".into()),
    };
    
    result.map(|r| r.rows_affected()).map_err(|e| e.to_string())
}

async fn update_record_mysql(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value) -> Result<u64, String> {
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let mut qb = sqlx::QueryBuilder::new(format!("UPDATE `{}` SET `{}` = ", table, col_name));
    
    match new_val {
        serde_json::Value::Number(n) => { if n.is_i64() { qb.push_bind(n.as_i64()); } else { qb.push_bind(n.as_f64()); } },
        serde_json::Value::String(s) => { qb.push_bind(s); },
        serde_json::Value::Bool(b) => { qb.push_bind(b); },
        serde_json::Value::Null => { qb.push("NULL"); },
        _ => return Err("Unsupported Value type".into()),
    }
    
    qb.push(format!(" WHERE `{}` = ", pk_col));
    
    match pk_val {
        serde_json::Value::Number(n) => { if n.is_i64() { qb.push_bind(n.as_i64()); } else { qb.push_bind(n.as_f64()); } },
        serde_json::Value::String(s) => { qb.push_bind(s); },
        _ => return Err("Unsupported PK type".into()),
    }
    
    let query = qb.build();
    let result = query.execute(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

async fn update_record_postgres(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value) -> Result<u64, String> {
    let url = format!("postgres://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(5432), params.database);
    let mut conn = sqlx::postgres::PgConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let mut qb = sqlx::QueryBuilder::new(format!("UPDATE \"{}\" SET \"{}\" = ", table, col_name));
    
    match new_val {
        serde_json::Value::Number(n) => { if n.is_i64() { qb.push_bind(n.as_i64()); } else { qb.push_bind(n.as_f64()); } },
        serde_json::Value::String(s) => { qb.push_bind(s); },
        serde_json::Value::Bool(b) => { qb.push_bind(b); },
        serde_json::Value::Null => { qb.push("NULL"); },
        _ => return Err("Unsupported Value type".into()),
    }
    
    qb.push(format!(" WHERE \"{}\" = ", pk_col));
    
    match pk_val {
        serde_json::Value::Number(n) => { if n.is_i64() { qb.push_bind(n.as_i64()); } else { qb.push_bind(n.as_f64()); } },
        serde_json::Value::String(s) => { qb.push_bind(s); },
        _ => return Err("Unsupported PK type".into()),
    }
    
    let query = qb.build();
    let result = query.execute(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

async fn update_record_sqlite(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value) -> Result<u64, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let mut qb = sqlx::QueryBuilder::new(format!("UPDATE \"{}\" SET \"{}\" = ", table, col_name));
    
    match new_val {
        serde_json::Value::Number(n) => { if n.is_i64() { qb.push_bind(n.as_i64()); } else { qb.push_bind(n.as_f64()); } },
        serde_json::Value::String(s) => { qb.push_bind(s); },
        serde_json::Value::Bool(b) => { qb.push_bind(b); },
        serde_json::Value::Null => { qb.push("NULL"); },
        _ => return Err("Unsupported Value type".into()),
    }
    
    qb.push(format!(" WHERE \"{}\" = ", pk_col));
    
    match pk_val {
        serde_json::Value::Number(n) => { if n.is_i64() { qb.push_bind(n.as_i64()); } else { qb.push_bind(n.as_f64()); } },
        serde_json::Value::String(s) => { qb.push_bind(s); },
        _ => return Err("Unsupported PK type".into()),
    }
    
    let query = qb.build();
    let result = query.execute(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

// --- Insert Record Helpers ---

async fn insert_record_mysql(params: &ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let mut cols = Vec::new();
    let mut vals = Vec::new();
    
    for (k, v) in data {
        cols.push(format!("`{}`", k));
        vals.push(v);
    }
    
    if cols.is_empty() { return Err("No data to insert".into()); }
    
    let mut qb = sqlx::QueryBuilder::new(format!("INSERT INTO `{}` ({}) VALUES (", table, cols.join(", ")));
    
    let mut separated = qb.separated(", ");
    for val in vals {
        match val {
            serde_json::Value::Number(n) => { if n.is_i64() { separated.push_bind(n.as_i64()); } else { separated.push_bind(n.as_f64()); } },
            serde_json::Value::String(s) => { separated.push_bind(s); },
            serde_json::Value::Bool(b) => { separated.push_bind(b); },
            serde_json::Value::Null => { separated.push("NULL"); },
            _ => return Err("Unsupported value type".into()),
        }
    }
    separated.push_unseparated(")");
    
    let query = qb.build();
    let result = query.execute(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

async fn insert_record_postgres(params: &ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
    let url = format!("postgres://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(5432), params.database);
    let mut conn = sqlx::postgres::PgConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let mut cols = Vec::new();
    let mut vals = Vec::new();
    
    for (k, v) in data {
        cols.push(format!("\"{}\"", k));
        vals.push(v);
    }
    
    if cols.is_empty() { return Err("No data to insert".into()); }
    
    let mut qb = sqlx::QueryBuilder::new(format!("INSERT INTO \"{}\" ({}) VALUES (", table, cols.join(", ")));
    
    let mut separated = qb.separated(", ");
    for val in vals {
        match val {
            serde_json::Value::Number(n) => { if n.is_i64() { separated.push_bind(n.as_i64()); } else { separated.push_bind(n.as_f64()); } },
            serde_json::Value::String(s) => { separated.push_bind(s); },
            serde_json::Value::Bool(b) => { separated.push_bind(b); },
            serde_json::Value::Null => { separated.push("NULL"); },
            _ => return Err("Unsupported value type".into()),
        }
    }
    separated.push_unseparated(")");
    
    let query = qb.build();
    let result = query.execute(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

async fn insert_record_sqlite(params: &ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    let mut cols = Vec::new();
    let mut vals = Vec::new();
    
    for (k, v) in data {
        cols.push(format!("\"{}\"", k));
        vals.push(v);
    }
    
    if cols.is_empty() { return Err("No data to insert".into()); }
    
    let mut qb = sqlx::QueryBuilder::new(format!("INSERT INTO \"{}\" ({}) VALUES (", table, cols.join(", ")));
    
    let mut separated = qb.separated(", ");
    for val in vals {
        match val {
            serde_json::Value::Number(n) => { if n.is_i64() { separated.push_bind(n.as_i64()); } else { separated.push_bind(n.as_f64()); } },
            serde_json::Value::String(s) => { separated.push_bind(s); },
            serde_json::Value::Bool(b) => { separated.push_bind(b); },
            serde_json::Value::Null => { separated.push("NULL"); },
            _ => return Err("Unsupported value type".into()),
        }
    }
    separated.push_unseparated(")");
    
    let query = qb.build();
    let result = query.execute(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

// --- Specific Executors ---

async fn execute_mysql(params: &ConnectionParams, query: &str) -> Result<QueryResult, String> {
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query(query).fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    
    map_rows_mysql(rows)
}

async fn execute_postgres(params: &ConnectionParams, query: &str) -> Result<QueryResult, String> {
    let url = format!("postgres://{}:{}@{}:{}/{}", 
        params.username.as_deref().unwrap_or_default(), params.password.as_deref().unwrap_or_default(),
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(5432), params.database);
    
    let mut conn = sqlx::postgres::PgConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query(query).fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    
    map_rows_postgres(rows)
}

async fn execute_sqlite(params: &ConnectionParams, query: &str) -> Result<QueryResult, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query(query).fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    
    map_rows_sqlite(rows)
}

// --- Specific Mappers ---

fn map_rows_mysql(rows: Vec<MySqlRow>) -> Result<QueryResult, String> {
    if rows.is_empty() { return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: 0 }); }
    
    let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut json_rows = Vec::new();

    for row in rows {
        let mut json_row = Vec::new();
        for (i, _) in row.columns().iter().enumerate() {
            let val = if let Ok(v) = row.try_get::<i64, _>(i) { serde_json::Value::Number(v.into()) }
            else if let Ok(v) = row.try_get::<i32, _>(i) { serde_json::Value::Number(v.into()) }
            else if let Ok(v) = row.try_get::<String, _>(i) { serde_json::Value::String(v) }
            else if let Ok(v) = row.try_get::<bool, _>(i) { serde_json::Value::Bool(v) }
            // Specific MySQL Types
            else if let Ok(v) = row.try_get::<NaiveDateTime, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<NaiveDate, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<NaiveTime, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<f64, _>(i) { serde_json::Number::from_f64(v).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null) }
            else { serde_json::Value::Null };
            json_row.push(val);
        }
        json_rows.push(json_row);
    }
    Ok(QueryResult { columns, rows: json_rows, affected_rows: 0 })
}

fn map_rows_postgres(rows: Vec<PgRow>) -> Result<QueryResult, String> {
    if rows.is_empty() { return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: 0 }); }
    let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut json_rows = Vec::new();

    for row in rows {
        let mut json_row = Vec::new();
        for (i, _) in row.columns().iter().enumerate() {
            let val = if let Ok(v) = row.try_get::<i64, _>(i) { serde_json::Value::Number(v.into()) }
            else if let Ok(v) = row.try_get::<i32, _>(i) { serde_json::Value::Number(v.into()) }
            else if let Ok(v) = row.try_get::<String, _>(i) { serde_json::Value::String(v) }
            else if let Ok(v) = row.try_get::<bool, _>(i) { serde_json::Value::Bool(v) }
            // Specific Postgres Types
            else if let Ok(v) = row.try_get::<DateTime<Utc>, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<NaiveDateTime, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<NaiveDate, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<NaiveTime, _>(i) { serde_json::Value::String(v.to_string()) }
            else if let Ok(v) = row.try_get::<f64, _>(i) { serde_json::Number::from_f64(v).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null) }
            else { serde_json::Value::Null };
            json_row.push(val);
        }
        json_rows.push(json_row);
    }
    Ok(QueryResult { columns, rows: json_rows, affected_rows: 0 })
}

fn map_rows_sqlite(rows: Vec<SqliteRow>) -> Result<QueryResult, String> {
    if rows.is_empty() { return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: 0 }); }
    let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut json_rows = Vec::new();

    for row in rows {
        let mut json_row = Vec::new();
        for (i, _) in row.columns().iter().enumerate() {
            // SQLite is flexible
            let val = if let Ok(v) = row.try_get::<i64, _>(i) { serde_json::Value::Number(v.into()) }
            else if let Ok(v) = row.try_get::<f64, _>(i) { serde_json::Number::from_f64(v).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null) }
            else if let Ok(v) = row.try_get::<String, _>(i) { serde_json::Value::String(v) }
            else if let Ok(v) = row.try_get::<bool, _>(i) { serde_json::Value::Bool(v) }
            else { serde_json::Value::Null };
            json_row.push(val);
        }
        json_rows.push(json_row);
    }
    Ok(QueryResult { columns, rows: json_rows, affected_rows: 0 })
}

#[tauri::command]
pub async fn execute_query<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    query: String,
) -> Result<QueryResult, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    match saved_conn.params.driver.as_str() {
        "mysql" => execute_mysql(&saved_conn.params, &query).await,
        "postgres" => execute_postgres(&saved_conn.params, &query).await,
        "sqlite" => execute_sqlite(&saved_conn.params, &query).await,
        _ => Err("Unsupported driver".into())
    }
}
