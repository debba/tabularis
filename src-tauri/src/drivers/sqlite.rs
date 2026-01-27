use sqlx::sqlite::SqliteRow;
use sqlx::{Column, Connection, Row};
use crate::models::{ConnectionParams, TableInfo, TableColumn, QueryResult};

pub async fn get_tables(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| TableInfo { name: r.try_get("name").unwrap_or_default() }).collect())
}

pub async fn get_columns(params: &ConnectionParams, table_name: &str) -> Result<Vec<TableColumn>, String> {
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

pub async fn delete_record(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value) -> Result<u64, String> {
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

pub async fn update_record(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value) -> Result<u64, String> {
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

pub async fn insert_record(params: &ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
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

pub async fn execute_query(params: &ConnectionParams, query: &str, limit: Option<u32>) -> Result<QueryResult, String> {
    let url = format!("sqlite://{}", params.database);
    let mut conn = sqlx::sqlite::SqliteConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    // Streaming
    let mut rows_stream = sqlx::query(query).fetch(&mut conn);

    let mut columns: Vec<String> = Vec::new();
    let mut json_rows = Vec::new();
    let mut truncated = false;
    
    use futures::stream::StreamExt;

    while let Some(result) = rows_stream.next().await {
        match result {
            Ok(row) => {
                if columns.is_empty() {
                    columns = row.columns().iter().map(|c| c.name().to_string()).collect();
                }

                if let Some(l) = limit {
                    if json_rows.len() >= l as usize {
                        truncated = true;
                        break;
                    }
                }

                let mut json_row = Vec::new();
                for (i, _) in row.columns().iter().enumerate() {
                    // SQLite is flexible
                    let val = if let Ok(v) = row.try_get::<i64, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<i32, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<i16, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<i8, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<u64, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<u32, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<u16, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<u8, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<f64, _>(i) { serde_json::Number::from_f64(v).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null) }
                    else if let Ok(v) = row.try_get::<f32, _>(i) { serde_json::Number::from_f64(v as f64).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null) }
                    else if let Ok(v) = row.try_get::<String, _>(i) { serde_json::Value::from(v) }
                    else if let Ok(v) = row.try_get::<bool, _>(i) { serde_json::Value::from(v) }
                    else { serde_json::Value::Null };
                    json_row.push(val);
                }
                json_rows.push(json_row);
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    
    Ok(QueryResult { columns, rows: json_rows, affected_rows: 0, truncated })
}
