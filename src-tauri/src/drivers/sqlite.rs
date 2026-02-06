use crate::drivers::common::extract_sqlite_value;
use crate::models::{
    ConnectionParams, ForeignKey, Index, Pagination, QueryResult, TableColumn, TableInfo,
};
use sqlx::{Column, Row};
use crate::pool_manager::get_sqlite_pool;

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
    log::debug!("SQLite: Found {} tables in {}", tables.len(), params.database);
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

            let is_auto = pk > 0 && dtype.to_uppercase().contains("INT");

            TableColumn {
                name: r.try_get("name").unwrap_or_default(),
                data_type: dtype,
                is_pk: pk > 0,
                is_nullable: notnull == 0,
                is_auto_increment: is_auto,
            }
        })
        .collect())
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
                TableColumn {
                    name: r.try_get("name").unwrap_or_default(),
                    data_type: r.try_get("type").unwrap_or_default(),
                    is_pk: pk > 0,
                    is_nullable: notnull == 0,
                    is_auto_increment: false, // SQLite doesn't expose this via table_info easily, typically AUTOINCREMENT on INTEGER PRIMARY KEY
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
                sqlx::query(&query)
                    .bind(n.as_i64())
                    .execute(&pool)
                    .await
            } else {
                sqlx::query(&query)
                    .bind(n.as_f64())
                    .execute(&pool)
                    .await
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
            qb.push_bind(s);
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
) -> Result<u64, String> {
    let pool = get_sqlite_pool(params).await?;

    let mut cols = Vec::new();
    let mut vals = Vec::new();

    for (k, v) in data {
        cols.push(format!("\"{}\"", k));
        vals.push(v);
    }

    if cols.is_empty() {
        return Err("No data to insert".into());
    }

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
                separated.push_bind(s);
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

pub async fn get_table_ddl(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<String, String> {
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
                    let val = extract_sqlite_value(&row, i);
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
