use sqlx::mysql::MySqlRow;
use sqlx::{Column, Connection, Row};
use urlencoding::encode;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use crate::models::{ConnectionParams, TableInfo, TableColumn, QueryResult};

pub async fn get_tables(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        user, pass,
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    let rows = sqlx::query("SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE()")
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| TableInfo { name: r.try_get("name").unwrap_or_default() }).collect())
}

pub async fn get_columns(params: &ConnectionParams, table_name: &str) -> Result<Vec<TableColumn>, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        user, pass,
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

pub async fn delete_record(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value) -> Result<u64, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        user, pass,
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

pub async fn update_record(params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value) -> Result<u64, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        user, pass,
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

pub async fn insert_record(params: &ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        user, pass,
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

pub async fn execute_query(params: &ConnectionParams, query: &str, limit: Option<u32>) -> Result<QueryResult, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        user, pass,
        params.host.as_deref().unwrap_or("localhost"), params.port.unwrap_or(3306), params.database);
    
    let mut conn = sqlx::mysql::MySqlConnection::connect(&url).await.map_err(|e| e.to_string())?;
    
    // Use fetch instead of fetch_all to support streaming/limit
    let mut rows_stream = sqlx::query(query).fetch(&mut conn);
    
    let mut columns: Vec<String> = Vec::new();
    let mut json_rows = Vec::new();
    let mut truncated = false;
    
    use futures::stream::StreamExt; // Correct import

    while let Some(result) = rows_stream.next().await {
        match result {
            Ok(row) => {
                // Initialize columns from the first row
                if columns.is_empty() {
                    columns = row.columns().iter().map(|c| c.name().to_string()).collect();
                }

                // Check limit
                if let Some(l) = limit {
                    if json_rows.len() >= l as usize {
                        truncated = true;
                        break;
                    }
                }

                // Map row
                let mut json_row = Vec::new();
                for (i, _) in row.columns().iter().enumerate() {
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
                    // Specific MySQL Types
                    else if let Ok(v) = row.try_get::<NaiveDateTime, _>(i) { serde_json::Value::String(v.to_string()) }
                    else if let Ok(v) = row.try_get::<NaiveDate, _>(i) { serde_json::Value::String(v.to_string()) }
                    else if let Ok(v) = row.try_get::<NaiveTime, _>(i) { serde_json::Value::String(v.to_string()) }
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
