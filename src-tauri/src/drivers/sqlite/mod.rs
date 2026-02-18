pub mod types;
pub mod extract;

use extract::extract_value;
use crate::models::{
    ConnectionParams, ForeignKey, Index, Pagination, QueryResult, RoutineInfo, RoutineParameter,
    TableColumn, TableInfo, ViewInfo,
};
use crate::pool_manager::get_sqlite_pool;
use sqlx::{Column, Row};

// Helper function to escape double quotes in identifiers for SQLite
fn escape_identifier(name: &str) -> String {
    name.replace('"', "\"\"")
}

pub async fn get_schemas(_params: &ConnectionParams) -> Result<Vec<String>, String> {
    Ok(vec![])
}

pub async fn get_databases(_params: &ConnectionParams) -> Result<Vec<String>, String> {
    // SQLite doesn't support multiple databases in the same connection
    Ok(vec![])
}

pub async fn get_tables(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    log::debug!("SQLite: Fetching tables for database: {}", params.database);
    let pool = get_sqlite_pool(params).await?;
    let rows = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let tables: Vec<TableInfo> = rows
        .iter()
        .map(|r| TableInfo {
            name: r.try_get("name").unwrap_or_default(),
        })
        .collect();
    log::debug!(
        "SQLite: Found {} tables in {}",
        tables.len(),
        params.database
    );
    Ok(tables)
}

pub async fn get_columns(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<Vec<TableColumn>, String> {
    let pool = get_sqlite_pool(params).await?;

    // PRAGMA table_info doesn't explicitly say "AUTO_INCREMENT"
    // But INTEGER PRIMARY KEY is implicitly so in sqlite.
    // Also if 'pk' > 0 and type is INTEGER.
    let query = format!("PRAGMA table_info('{}')", table_name);

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| {
            let pk: i32 = r.try_get("pk").unwrap_or(0);
            let notnull: i32 = r.try_get("notnull").unwrap_or(0);
            let dtype: String = r.try_get("type").unwrap_or_default();
            let dflt_value: Option<String> = r.try_get("dflt_value").ok();

            let _is_auto = pk > 0 && dtype.to_uppercase().contains("INT");

            TableColumn {
                name: r.try_get("name").unwrap_or_default(),
                data_type: r.try_get("type").unwrap_or_default(),
                is_pk: pk > 0,
                is_nullable: notnull == 0,
                is_auto_increment: false,
                default_value: dflt_value,
            }
        })
        .collect())
}

pub async fn get_routines(_params: &ConnectionParams) -> Result<Vec<RoutineInfo>, String> {
    // SQLite does not support stored procedures
    Ok(vec![])
}

pub async fn get_routine_parameters(
    _params: &ConnectionParams,
    _routine_name: &str,
) -> Result<Vec<RoutineParameter>, String> {
    Ok(vec![])
}

pub async fn get_routine_definition(
    _params: &ConnectionParams,
    _routine_name: &str,
    _routine_type: &str,
) -> Result<String, String> {
    Err("SQLite does not support stored procedures".to_string())
}

pub async fn get_foreign_keys(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<Vec<ForeignKey>, String> {
    let pool = get_sqlite_pool(params).await?;

    let query = format!("PRAGMA foreign_key_list('{}')", table_name);
    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // id, seq, table, from, to, on_update, on_delete, match
    Ok(rows
        .iter()
        .map(|r| {
            let id: i32 = r.try_get("id").unwrap_or(0);
            ForeignKey {
                name: format!(
                    "fk_{}_{}",
                    id,
                    r.try_get::<String, _>("table").unwrap_or_default()
                ), // SQLite FKs don't always have named constraints exposed easily here, but we construct one
                column_name: r.try_get("from").unwrap_or_default(),
                ref_table: r.try_get("table").unwrap_or_default(),
                ref_column: r.try_get("to").unwrap_or_default(),
                on_update: r.try_get("on_update").ok(),
                on_delete: r.try_get("on_delete").ok(),
            }
        })
        .collect())
}

// Batch function: Get all columns for all tables (SQLite must iterate but reuses connection)
pub async fn get_all_columns_batch(
    params: &ConnectionParams,
    table_names: &[String],
) -> Result<std::collections::HashMap<String, Vec<TableColumn>>, String> {
    use std::collections::HashMap;
    let pool = get_sqlite_pool(params).await?;
    let mut result: HashMap<String, Vec<TableColumn>> = HashMap::new();

    for table_name in table_names {
        let query = format!("PRAGMA table_info('{}')", table_name);
        let rows = sqlx::query(&query)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

        let columns: Vec<TableColumn> = rows
            .iter()
            .map(|r| {
                let pk: i32 = r.try_get("pk").unwrap_or(0);
                let notnull: i32 = r.try_get("notnull").unwrap_or(0);
                let dflt_value: Option<String> = r.try_get("dflt_value").ok();
                TableColumn {
                    name: r.try_get("name").unwrap_or_default(),
                    data_type: r.try_get("type").unwrap_or_default(),
                    is_pk: pk > 0,
                    is_nullable: notnull == 0,
                    is_auto_increment: false, // SQLite doesn't expose this via table_info easily, typically AUTOINCREMENT on INTEGER PRIMARY KEY
                    default_value: dflt_value,
                }
            })
            .collect();

        result.insert(table_name.clone(), columns);
    }

    Ok(result)
}

// Batch function: Get all foreign keys for all tables (SQLite must iterate but reuses connection)
pub async fn get_all_foreign_keys_batch(
    params: &ConnectionParams,
    table_names: &[String],
) -> Result<std::collections::HashMap<String, Vec<ForeignKey>>, String> {
    use std::collections::HashMap;
    let pool = get_sqlite_pool(params).await?;
    let mut result: HashMap<String, Vec<ForeignKey>> = HashMap::new();

    for table_name in table_names {
        let query = format!("PRAGMA foreign_key_list('{}')", table_name);
        let rows = sqlx::query(&query)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

        let fks: Vec<ForeignKey> = rows
            .iter()
            .map(|r| {
                let id: i32 = r.try_get("id").unwrap_or(0);
                ForeignKey {
                    name: format!(
                        "fk_{}_{}",
                        id,
                        r.try_get::<String, _>("table").unwrap_or_default()
                    ),
                    column_name: r.try_get("from").unwrap_or_default(),
                    ref_table: r.try_get("table").unwrap_or_default(),
                    ref_column: r.try_get("to").unwrap_or_default(),
                    on_update: r.try_get("on_update").ok(),
                    on_delete: r.try_get("on_delete").ok(),
                }
            })
            .collect();

        result.insert(table_name.clone(), fks);
    }

    Ok(result)
}

pub async fn get_indexes(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<Vec<Index>, String> {
    let pool = get_sqlite_pool(params).await?;

    let list_query = format!("PRAGMA index_list('{}')", table_name);
    let indexes = sqlx::query(&list_query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for idx_row in indexes {
        let name: String = idx_row.try_get("name").unwrap_or_default();
        let unique: i32 = idx_row.try_get("unique").unwrap_or(0);
        let origin: String = idx_row.try_get("origin").unwrap_or_default(); // pk for primary key

        let info_query = format!("PRAGMA index_info('{}')", name);
        let info_rows = sqlx::query(&info_query)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

        for info in info_rows {
            result.push(Index {
                name: name.clone(),
                column_name: info.try_get("name").unwrap_or_default(),
                is_unique: unique > 0,
                is_primary: origin == "pk",
                seq_in_index: info.try_get::<i32, _>("seqno").unwrap_or(0),
            });
        }
    }

    Ok(result)
}

pub async fn save_blob_column_to_file(
    params: &ConnectionParams,
    table: &str,
    col_name: &str,
    pk_col: &str,
    pk_val: serde_json::Value,
    file_path: &str,
) -> Result<(), String> {
    let pool = get_sqlite_pool(params).await?;

    let query = format!("SELECT \"{}\" FROM \"{}\" WHERE \"{}\" = ?", col_name, table, pk_col);

    let row = match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() {
                sqlx::query(&query).bind(n.as_i64()).fetch_one(&pool).await
            } else {
                sqlx::query(&query).bind(n.as_f64()).fetch_one(&pool).await
            }
        }
        serde_json::Value::String(s) => sqlx::query(&query).bind(s).fetch_one(&pool).await,
        _ => return Err("Unsupported PK type".into()),
    }
    .map_err(|e| e.to_string())?;

    let bytes: Vec<u8> = row.try_get(0).map_err(|e| e.to_string())?;
    std::fs::write(file_path, bytes).map_err(|e| e.to_string())
}

pub async fn delete_record(
    params: &ConnectionParams,
    table: &str,
    pk_col: &str,
    pk_val: serde_json::Value,
) -> Result<u64, String> {
    let pool = get_sqlite_pool(params).await?;

    let query = format!("DELETE FROM \"{}\" WHERE \"{}\" = ?", table, pk_col);

    let result = match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() {
                sqlx::query(&query).bind(n.as_i64()).execute(&pool).await
            } else {
                sqlx::query(&query).bind(n.as_f64()).execute(&pool).await
            }
        }
        serde_json::Value::String(s) => sqlx::query(&query).bind(s).execute(&pool).await,
        _ => return Err("Unsupported PK type".into()),
    };

    result.map(|r| r.rows_affected()).map_err(|e| e.to_string())
}

pub async fn update_record(
    params: &ConnectionParams,
    table: &str,
    pk_col: &str,
    pk_val: serde_json::Value,
    col_name: &str,
    new_val: serde_json::Value,
    max_blob_size: u64,
) -> Result<u64, String> {
    let pool = get_sqlite_pool(params).await?;

    let mut qb = sqlx::QueryBuilder::new(format!("UPDATE \"{}\" SET \"{}\" = ", table, col_name));

    match new_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() {
                qb.push_bind(n.as_i64());
            } else {
                qb.push_bind(n.as_f64());
            }
        }
        serde_json::Value::String(s) => {
            // Check for special sentinel value to use DEFAULT
            if s == "__USE_DEFAULT__" {
                qb.push("DEFAULT");
            } else if let Some(bytes) = crate::drivers::common::decode_blob_wire_format(&s, max_blob_size) {
                // Blob wire format: decode to raw bytes so the DB stores binary data,
                // not the internal wire format string.
                qb.push_bind(bytes);
            } else {
                qb.push_bind(s);
            }
        }
        serde_json::Value::Bool(b) => {
            qb.push_bind(b);
        }
        serde_json::Value::Null => {
            qb.push("NULL");
        }
        _ => return Err("Unsupported Value type".into()),
    }

    qb.push(format!(" WHERE \"{}\" = ", pk_col));

    match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() {
                qb.push_bind(n.as_i64());
            } else {
                qb.push_bind(n.as_f64());
            }
        }
        serde_json::Value::String(s) => {
            qb.push_bind(s);
        }
        _ => return Err("Unsupported PK type".into()),
    }

    let query = qb.build();
    let result = query.execute(&pool).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

pub async fn insert_record(
    params: &ConnectionParams,
    table: &str,
    data: std::collections::HashMap<String, serde_json::Value>,
    max_blob_size: u64,
) -> Result<u64, String> {
    let pool = get_sqlite_pool(params).await?;

    let mut cols = Vec::new();
    let mut vals = Vec::new();

    for (k, v) in data {
        cols.push(format!("\"{}\"", k));
        vals.push(v);
    }

    // Allow empty inserts for auto-generated values (e.g., auto-increment PKs)
    let mut qb = if cols.is_empty() {
        sqlx::QueryBuilder::new(format!("INSERT INTO \"{}\" DEFAULT VALUES", table))
    } else {
        let mut qb = sqlx::QueryBuilder::new(format!(
            "INSERT INTO \"{}\" ({}) VALUES (",
            table,
            cols.join(", ")
        ));

        let mut separated = qb.separated(", ");
        for val in vals {
            match val {
                serde_json::Value::Number(n) => {
                    if n.is_i64() {
                        separated.push_bind(n.as_i64());
                    } else {
                        separated.push_bind(n.as_f64());
                    }
                }
                serde_json::Value::String(s) => {
                    if let Some(bytes) = crate::drivers::common::decode_blob_wire_format(&s, max_blob_size) {
                        // Blob wire format: decode to raw bytes so the DB stores binary data.
                        separated.push_bind(bytes);
                    } else {
                        separated.push_bind(s);
                    }
                }
                serde_json::Value::Bool(b) => {
                    separated.push_bind(b);
                }
                serde_json::Value::Null => {
                    separated.push("NULL");
                }
                _ => return Err("Unsupported value type".into()),
            }
        }
        separated.push_unseparated(")");
        qb
    };

    let query = qb.build();
    let result = query.execute(&pool).await.map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

/// Extracts ORDER BY clause from a SQL query (case-insensitive)
fn extract_order_by(query: &str) -> String {
    let query_upper = query.to_uppercase();
    if let Some(pos) = query_upper.rfind("ORDER BY") {
        // Return the ORDER BY clause from the original query (preserving case)
        query[pos..].trim().to_string()
    } else {
        String::new()
    }
}

/// Removes ORDER BY clause from a SQL query
fn remove_order_by(query: &str) -> String {
    let query_upper = query.to_uppercase();
    if let Some(pos) = query_upper.rfind("ORDER BY") {
        query[..pos].trim().to_string()
    } else {
        query.to_string()
    }
}

pub async fn get_table_ddl(params: &ConnectionParams, table_name: &str) -> Result<String, String> {
    let pool = get_sqlite_pool(params).await?;
    let query = "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?";
    let row: (String,) = sqlx::query_as(query)
        .bind(table_name)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("{};", row.0))
}

pub async fn execute_query(
    params: &ConnectionParams,
    query: &str,
    limit: Option<u32>,
    page: u32,
) -> Result<QueryResult, String> {
    let pool = get_sqlite_pool(params).await?;
    let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;

    let is_select = query.trim_start().to_uppercase().starts_with("SELECT");
    let mut pagination: Option<Pagination> = None;
    let final_query: String;
    let mut manual_limit = limit;

    if is_select && limit.is_some() {
        let l = limit.unwrap();
        let offset = (page - 1) * l;

        let count_q = format!("SELECT COUNT(*) FROM ({})", query);
        let count_res = sqlx::query(&count_q).fetch_one(&mut *conn).await;

        let total_rows: u64 = if let Ok(row) = count_res {
            row.try_get::<i64, _>(0).unwrap_or(0) as u64
        } else {
            0
        };

        pagination = Some(Pagination {
            page,
            page_size: l,
            total_rows,
        });

        // Extract ORDER BY clause from the original query to preserve sorting
        let order_by_clause = extract_order_by(query);

        if !order_by_clause.is_empty() {
            // Remove ORDER BY from inner query and add it to outer query
            let query_without_order = remove_order_by(query);
            final_query = format!(
                "SELECT * FROM ({}) {} LIMIT {} OFFSET {}",
                query_without_order, order_by_clause, l, offset
            );
        } else {
            final_query = format!("SELECT * FROM ({}) LIMIT {} OFFSET {}", query, l, offset);
        }

        manual_limit = None;
    } else {
        final_query = query.to_string();
    }

    // Streaming
    let mut rows_stream = sqlx::query(&final_query).fetch(&mut *conn);

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

                if let Some(l) = manual_limit {
                    if json_rows.len() >= l as usize {
                        truncated = true;
                        break;
                    }
                }

                let mut json_row = Vec::new();
                for (i, _) in row.columns().iter().enumerate() {
                    let val = extract_value(&row, i);
                    json_row.push(val);
                }
                json_rows.push(json_row);
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(QueryResult {
        columns,
        rows: json_rows,
        affected_rows: 0,
        truncated,
        pagination,
    })
}

pub async fn get_views(params: &ConnectionParams) -> Result<Vec<ViewInfo>, String> {
    log::debug!("SQLite: Fetching views for database: {}", params.database);
    let pool = get_sqlite_pool(params).await?;
    let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name ASC")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let views: Vec<ViewInfo> = rows
        .iter()
        .map(|r| ViewInfo {
            name: r.try_get("name").unwrap_or_default(),
            definition: None,
        })
        .collect();
    log::debug!("SQLite: Found {} views in {}", views.len(), params.database);
    Ok(views)
}

pub async fn get_view_definition(
    params: &ConnectionParams,
    view_name: &str,
) -> Result<String, String> {
    let pool = get_sqlite_pool(params).await?;
    let query = "SELECT sql FROM sqlite_master WHERE type='view' AND name = ?";
    let row = sqlx::query(query)
        .bind(view_name)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Failed to get view definition: {}", e))?;

    let definition: String = row.try_get("sql").unwrap_or_default();
    Ok(definition)
}

pub async fn create_view(
    params: &ConnectionParams,
    view_name: &str,
    definition: &str,
) -> Result<(), String> {
    let pool = get_sqlite_pool(params).await?;
    let escaped_name = escape_identifier(view_name);
    let query = format!("CREATE VIEW \"{}\" AS {}", escaped_name, definition);
    sqlx::query(&query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to create view: {}", e))?;
    Ok(())
}

pub async fn alter_view(
    params: &ConnectionParams,
    view_name: &str,
    definition: &str,
) -> Result<(), String> {
    let pool = get_sqlite_pool(params).await?;
    // SQLite does not support ALTER VIEW, so we must drop and recreate
    let escaped_name = escape_identifier(view_name);
    let drop_query = format!("DROP VIEW IF EXISTS \"{}\"", escaped_name);
    sqlx::query(&drop_query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to drop view: {}", e))?;

    let create_query = format!("CREATE VIEW \"{}\" AS {}", escaped_name, definition);
    sqlx::query(&create_query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to create view: {}", e))?;

    Ok(())
}

pub async fn drop_view(params: &ConnectionParams, view_name: &str) -> Result<(), String> {
    let pool = get_sqlite_pool(params).await?;
    let escaped_name = escape_identifier(view_name);
    let query = format!("DROP VIEW IF EXISTS \"{}\"", escaped_name);
    sqlx::query(&query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to drop view: {}", e))?;
    Ok(())
}

pub async fn get_view_columns(
    params: &ConnectionParams,
    view_name: &str,
) -> Result<Vec<TableColumn>, String> {
    let pool = get_sqlite_pool(params).await?;

    let query = format!("PRAGMA table_info('{}')", view_name);

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| {
            let pk: i32 = r.try_get("pk").unwrap_or(0);
            let notnull: i32 = r.try_get("notnull").unwrap_or(0);
            let dflt_value: Option<String> = r.try_get("dflt_value").ok();
            TableColumn {
                name: r.try_get("name").unwrap_or_default(),
                data_type: r.try_get("type").unwrap_or_default(),
                is_pk: pk > 0,
                is_nullable: notnull == 0,
                is_auto_increment: false,
                default_value: dflt_value,
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ConnectionParams;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;
    use tempfile::NamedTempFile;

    async fn setup_test_db() -> (ConnectionParams, NamedTempFile) {
        let file = NamedTempFile::new().expect("Failed to create temp file");
        let path = file.path().to_str().unwrap().to_string();

        let params = ConnectionParams {
            driver: "sqlite".to_string(),
            database: path.clone(),
            host: None,
            port: None,
            username: None,
            password: None,
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
        };

        // Initialize DB with a table
        // We use create_if_missing=true to ensure it works even if tempfile behavior varies
        let url = format!("sqlite://{}", path);
        let options = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .connect_with(options)
            .await
            .expect("Failed to connect to test DB");

        sqlx::query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
            .execute(&pool)
            .await
            .expect("Failed to create table");

        sqlx::query("INSERT INTO users (name) VALUES ('Alice'), ('Bob')")
            .execute(&pool)
            .await
            .expect("Failed to insert data");

        // Close this pool so the file isn't locked (though SQLite handles concurrent reads usually)
        pool.close().await;

        // We return the file handle too so it doesn't get deleted until the test ends
        (params, file)
    }

    #[tokio::test]
    async fn test_view_lifecycle() {
        let (params, _file) = setup_test_db().await;

        // 1. Create View
        let view_name = "view_users";
        // Note: SQLite view definitions are stored as written
        let definition = "SELECT name FROM users";
        create_view(&params, view_name, definition)
            .await
            .expect("Failed to create view");

        // 2. Get Views
        let views = get_views(&params).await.expect("Failed to get views");
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].name, view_name);

        // 3. Get View Definition
        let def = get_view_definition(&params, view_name)
            .await
            .expect("Failed to get definition");
        // SQLite stores the full "CREATE VIEW ..." statement in 'sql' column usually,
        // OR just the definition depending on normalization.
        // The get_view_definition implementation returns 'sql' column from sqlite_master.
        // It usually is "CREATE VIEW view_users AS SELECT name FROM users"
        assert!(def.to_uppercase().contains("CREATE VIEW"));
        assert!(def.to_uppercase().contains("SELECT NAME FROM USERS"));

        // 4. Get View Columns
        let cols = get_view_columns(&params, view_name)
            .await
            .expect("Failed to get columns");
        assert_eq!(cols.len(), 1);
        assert_eq!(cols[0].name, "name");

        // 5. Alter View (Drop & Recreate)
        let new_def = "SELECT id, name FROM users";
        alter_view(&params, view_name, new_def)
            .await
            .expect("Failed to alter view");

        let cols_after = get_view_columns(&params, view_name)
            .await
            .expect("Failed to get columns after alter");
        assert_eq!(cols_after.len(), 2);

        // 6. Drop View
        drop_view(&params, view_name)
            .await
            .expect("Failed to drop view");
        let views_final = get_views(&params).await.expect("Failed to get views final");
        assert_eq!(views_final.len(), 0);

        // Cleanup: Close the pool created by the functions (via pool_manager)
        crate::pool_manager::close_pool(&params).await;
    }
}
