use crate::drivers::common::extract_mysql_value;
use crate::models::{
    ConnectionParams, ForeignKey, Index, Pagination, QueryResult, RoutineInfo, RoutineParameter,
    TableColumn, TableInfo, ViewInfo,
};
use crate::pool_manager::get_mysql_pool;
use sqlx::{Column, Row};

// Helper function to escape backticks in identifiers for MySQL
fn escape_identifier(name: &str) -> String {
    name.replace('`', "``")
}

pub async fn get_databases(params: &ConnectionParams) -> Result<Vec<String>, String> {
    let pool = get_mysql_pool(params).await?;
    let rows = sqlx::query("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    // Already using column index - good for Windows/MySQL 8 compatibility
    Ok(rows
        .iter()
        .map(|r| r.try_get(0).unwrap_or_default())
        .collect())
}

pub async fn get_tables(params: &ConnectionParams) -> Result<Vec<TableInfo>, String> {
    log::debug!("MySQL: Fetching tables for database: {}", params.database);
    let pool = get_mysql_pool(params).await?;
    let rows = sqlx::query(
        "SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let tables: Vec<TableInfo> = rows
        .iter()
        .map(|r| TableInfo {
            name: r.try_get(0).unwrap_or_default(),
        })
        .collect();
    log::debug!(
        "MySQL: Found {} tables in {}",
        tables.len(),
        params.database
    );
    Ok(tables)
}

pub async fn get_columns(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<Vec<TableColumn>, String> {
    let pool = get_mysql_pool(params).await?;

    let query = r#"
        SELECT column_name, data_type, column_key, is_nullable, extra, column_default
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position
    "#;

    let rows = sqlx::query(query)
        .bind(table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| {
            // Use column indices instead of names for Windows/MySQL 8 compatibility
            let column_name: String = r.try_get(0).unwrap_or_default(); // column_name
            let data_type: String = r.try_get(1).unwrap_or_default(); // data_type
            let key: String = r.try_get(2).unwrap_or_default(); // column_key
            let null_str: String = r.try_get(3).unwrap_or_default(); // is_nullable
            let extra: String = r.try_get(4).unwrap_or_default(); // extra
            let default_val: Option<String> = r.try_get(5).ok(); // column_default

            let is_auto_increment = extra.contains("auto_increment");

            // Only set default_value if not auto-increment, value exists, and not NULL
            // Filter out NULL defaults (MySQL may return "NULL" string for nullable without default)
            let default_value = if !is_auto_increment {
                match default_val {
                    Some(val) if !val.is_empty() && !val.eq_ignore_ascii_case("null") => Some(val),
                    _ => None,
                }
            } else {
                None
            };

            TableColumn {
                name: column_name,
                data_type,
                is_pk: key == "PRI",
                is_nullable: null_str == "YES",
                is_auto_increment,
                default_value,
            }
        })
        .collect())
}

pub async fn get_foreign_keys(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<Vec<ForeignKey>, String> {
    let pool = get_mysql_pool(params).await?;

    let query = r#"
        SELECT
            kcu.CONSTRAINT_NAME,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME,
            rc.UPDATE_RULE,
            rc.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    "#;

    let rows = sqlx::query(query)
        .bind(table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| ForeignKey {
            // Use column indices instead of names for Windows/MySQL 8 compatibility
            name: r.try_get(0).unwrap_or_default(), // CONSTRAINT_NAME
            column_name: r.try_get(1).unwrap_or_default(), // COLUMN_NAME
            ref_table: r.try_get(2).unwrap_or_default(), // REFERENCED_TABLE_NAME
            ref_column: r.try_get(3).unwrap_or_default(), // REFERENCED_COLUMN_NAME
            on_update: r.try_get(4).ok(), // UPDATE_RULE
            on_delete: r.try_get(5).ok(), // DELETE_RULE
        })
        .collect())
}

// Batch function: Get all columns for all tables in one query
pub async fn get_all_columns_batch(
    params: &ConnectionParams,
) -> Result<std::collections::HashMap<String, Vec<TableColumn>>, String> {
    use std::collections::HashMap;
    let pool = get_mysql_pool(params).await?;

    let query = r#"
        SELECT table_name, column_name, data_type, column_key, is_nullable, extra, column_default
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        ORDER BY table_name, ordinal_position
    "#;

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut result: HashMap<String, Vec<TableColumn>> = HashMap::new();

    for row in rows {
        // Use column indices instead of names for Windows/MySQL 8 compatibility
        let table_name: String = row.try_get(0).unwrap_or_default(); // table_name
        let column_name: String = row.try_get(1).unwrap_or_default(); // column_name
        let data_type: String = row.try_get(2).unwrap_or_default(); // data_type
        let key: String = row.try_get(3).unwrap_or_default(); // column_key
        let null_str: String = row.try_get(4).unwrap_or_default(); // is_nullable
        let extra: String = row.try_get(5).unwrap_or_default(); // extra
        let default_val: Option<String> = row.try_get(6).ok(); // column_default

        let is_auto_increment = extra.contains("auto_increment");

        // Only set default_value if not auto-increment, value exists, and not NULL
        // Filter out NULL defaults (MySQL may return "NULL" string for nullable without default)
        let default_value = if !is_auto_increment {
            match default_val {
                Some(val) if !val.is_empty() && !val.eq_ignore_ascii_case("null") => Some(val),
                _ => None,
            }
        } else {
            None
        };

        let column = TableColumn {
            name: column_name,
            data_type,
            is_pk: key == "PRI",
            is_nullable: null_str == "YES",
            is_auto_increment,
            default_value,
        };

        result
            .entry(table_name)
            .or_insert_with(Vec::new)
            .push(column);
    }

    Ok(result)
}

// Batch function: Get all foreign keys for all tables in one query
pub async fn get_all_foreign_keys_batch(
    params: &ConnectionParams,
) -> Result<std::collections::HashMap<String, Vec<ForeignKey>>, String> {
    use std::collections::HashMap;
    let pool = get_mysql_pool(params).await?;

    let query = r#"
        SELECT
            kcu.TABLE_NAME,
            kcu.CONSTRAINT_NAME,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME,
            rc.UPDATE_RULE,
            rc.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    "#;

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut result: HashMap<String, Vec<ForeignKey>> = HashMap::new();

    for row in rows {
        // Use column indices instead of names for Windows/MySQL 8 compatibility
        let table_name: String = row.try_get(0).unwrap_or_default(); // TABLE_NAME

        let fk = ForeignKey {
            name: row.try_get(1).unwrap_or_default(), // CONSTRAINT_NAME
            column_name: row.try_get(2).unwrap_or_default(), // COLUMN_NAME
            ref_table: row.try_get(3).unwrap_or_default(), // REFERENCED_TABLE_NAME
            ref_column: row.try_get(4).unwrap_or_default(), // REFERENCED_COLUMN_NAME
            on_update: row.try_get(5).ok(), // UPDATE_RULE
            on_delete: row.try_get(6).ok(), // DELETE_RULE
        };

        result.entry(table_name).or_insert_with(Vec::new).push(fk);
    }

    Ok(result)
}

pub async fn get_indexes(
    params: &ConnectionParams,
    table_name: &str,
) -> Result<Vec<Index>, String> {
    let pool = get_mysql_pool(params).await?;

    let query = r#"
        SELECT
            INDEX_NAME,
            COLUMN_NAME,
            NON_UNIQUE,
            SEQ_IN_INDEX
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
    "#;

    let rows = sqlx::query(query)
        .bind(table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| {
            // Use column indices instead of names for Windows/MySQL 8 compatibility
            let index_name: String = r.try_get(0).unwrap_or_default(); // INDEX_NAME
            let non_unique: i64 = r.try_get(2).unwrap_or(1); // NON_UNIQUE
            Index {
                name: index_name.clone(),
                column_name: r.try_get(1).unwrap_or_default(), // COLUMN_NAME
                is_unique: non_unique == 0,
                is_primary: index_name == "PRIMARY",
                seq_in_index: r.try_get::<i64, _>(3).unwrap_or(0) as i32, // SEQ_IN_INDEX
            }
        })
        .collect())
}

pub async fn delete_record(
    params: &ConnectionParams,
    table: &str,
    pk_col: &str,
    pk_val: serde_json::Value,
) -> Result<u64, String> {
    let pool = get_mysql_pool(params).await?;

    let query = format!("DELETE FROM `{}` WHERE `{}` = ?", table, pk_col);

    let result = match pk_val {
        serde_json::Value::Number(n) => {
            if n.is_i64() {
                sqlx::query(&query).bind(n.as_i64()).execute(&pool).await
            } else if n.is_f64() {
                sqlx::query(&query).bind(n.as_f64()).execute(&pool).await
            } else {
                sqlx::query(&query).bind(n.to_string()).execute(&pool).await
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
    let pool = get_mysql_pool(params).await?;

    let mut qb = sqlx::QueryBuilder::new(format!("UPDATE `{}` SET `{}` = ", table, col_name));

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

    qb.push(format!(" WHERE `{}` = ", pk_col));

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
    let pool = get_mysql_pool(params).await?;

    let mut cols = Vec::new();
    let mut vals = Vec::new();

    for (k, v) in data {
        cols.push(format!("`{}`", k));
        vals.push(v);
    }

    // Allow empty inserts for auto-generated values (e.g., auto-increment PKs)
    let mut qb = if cols.is_empty() {
        sqlx::QueryBuilder::new(format!("INSERT INTO `{}` () VALUES ()", table))
    } else {
        let mut qb = sqlx::QueryBuilder::new(format!(
            "INSERT INTO `{}` ({}) VALUES (",
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
    let pool = get_mysql_pool(params).await?;
    let query = format!("SHOW CREATE TABLE `{}`", table_name);
    let row = sqlx::query(&query)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let create_sql: String = row.try_get(1).unwrap_or_default();
    Ok(format!("{};", create_sql))
}

pub async fn get_views(params: &ConnectionParams) -> Result<Vec<ViewInfo>, String> {
    log::debug!("MySQL: Fetching views for database: {}", params.database);
    let pool = get_mysql_pool(params).await?;
    let rows = sqlx::query(
            "SELECT table_name as name FROM information_schema.views WHERE table_schema = DATABASE() ORDER BY table_name ASC",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let views: Vec<ViewInfo> = rows
        .iter()
        .map(|r| ViewInfo {
            // Use column index instead of name for Windows/MySQL 8 compatibility
            name: r.try_get(0).unwrap_or_default(),
            definition: None,
        })
        .collect();
    log::debug!("MySQL: Found {} views in {}", views.len(), params.database);
    Ok(views)
}

pub async fn get_view_definition(
    params: &ConnectionParams,
    view_name: &str,
) -> Result<String, String> {
    let pool = get_mysql_pool(params).await?;
    let escaped_name = escape_identifier(view_name);
    let query = format!("SHOW CREATE VIEW `{}`", escaped_name);
    let row = sqlx::query(&query)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Failed to get view definition: {}", e))?;
    let definition: String = row.try_get(1).unwrap_or_default();

    Ok(definition)
}

pub async fn create_view(
    params: &ConnectionParams,
    view_name: &str,
    definition: &str,
) -> Result<(), String> {
    let pool = get_mysql_pool(params).await?;
    let escaped_name = escape_identifier(view_name);
    let query = format!("CREATE VIEW `{}` AS {}", escaped_name, definition);
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
    let pool = get_mysql_pool(params).await?;
    let escaped_name = escape_identifier(view_name);
    let query = format!("ALTER VIEW `{}` AS {}", escaped_name, definition);
    sqlx::query(&query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to alter view: {}", e))?;
    Ok(())
}

pub async fn drop_view(params: &ConnectionParams, view_name: &str) -> Result<(), String> {
    let pool = get_mysql_pool(params).await?;
    let escaped_name = escape_identifier(view_name);
    let query = format!("DROP VIEW IF EXISTS `{}`", escaped_name);
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
    // Views in MySQL can be queried like tables for column info
    let pool = get_mysql_pool(params).await?;

    let query = r#"
            SELECT column_name, data_type, column_key, is_nullable, extra, column_default
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = ?
            ORDER BY ordinal_position
        "#;

    let rows = sqlx::query(query)
        .bind(view_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| {
            // Use column indices instead of names for Windows/MySQL 8 compatibility
            let column_name: String = r.try_get(0).unwrap_or_default(); // column_name
            let data_type: String = r.try_get(1).unwrap_or_default(); // data_type
            let key: String = r.try_get(2).unwrap_or_default(); // column_key
            let null_str: String = r.try_get(3).unwrap_or_default(); // is_nullable
            let extra: String = r.try_get(4).unwrap_or_default(); // extra
            let default_val: Option<String> = r.try_get(5).ok(); // column_default

            let is_auto_increment = extra.contains("auto_increment");

            // Only set default_value if not auto-increment, value exists, and not NULL
            // Filter out NULL defaults (MySQL may return "NULL" string for nullable without default)
            let default_value = if !is_auto_increment {
                match default_val {
                    Some(val) if !val.is_empty() && !val.eq_ignore_ascii_case("null") => Some(val),
                    _ => None,
                }
            } else {
                None
            };

            TableColumn {
                name: column_name,
                data_type,
                is_pk: key == "PRI",
                is_nullable: null_str == "YES",
                is_auto_increment,
                default_value,
            }
        })
        .collect())
}

pub async fn get_routines(params: &ConnectionParams) -> Result<Vec<RoutineInfo>, String> {
    let pool = get_mysql_pool(params).await?;
    let query = r#"
            SELECT routine_name, routine_type, routine_definition
            FROM information_schema.routines
            WHERE routine_schema = DATABASE()
            ORDER BY routine_name
        "#;

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| RoutineInfo {
            // Use column indices instead of names for Windows/MySQL 8 compatibility
            name: r.try_get(0).unwrap_or_default(), // routine_name
            routine_type: r.try_get(1).unwrap_or_default(), // routine_type
            definition: r.try_get(2).ok(), // routine_definition
        })
        .collect())
}

pub async fn get_routine_parameters(
    params: &ConnectionParams,
    routine_name: &str,
) -> Result<Vec<RoutineParameter>, String> {
    let pool = get_mysql_pool(params).await?;

    // 1. Get return type for functions from routines table
    let return_type_query = r#"
            SELECT DATA_TYPE, ROUTINE_TYPE
            FROM information_schema.routines
            WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = ?
        "#;

    let routine_info = sqlx::query(return_type_query)
        .bind(routine_name)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut parameters = Vec::new();

    if let Some(info) = routine_info {
        // Use column indices instead of names for Windows/MySQL 8 compatibility
        let data_type: String = info.try_get(0).unwrap_or_default(); // DATA_TYPE
        let routine_type: String = info.try_get(1).unwrap_or_default(); // ROUTINE_TYPE
        if routine_type == "FUNCTION" {
            if !data_type.is_empty() {
                parameters.push(RoutineParameter {
                    name: "".to_string(), // Empty name for return value
                    data_type,
                    mode: "OUT".to_string(),
                    ordinal_position: 0,
                });
            }
        }
    }

    // 2. Get parameters
    let query = r#"
            SELECT parameter_name, data_type, parameter_mode, ordinal_position
            FROM information_schema.parameters
            WHERE specific_schema = DATABASE() AND specific_name = ?
            ORDER BY ordinal_position
        "#;

    let rows = sqlx::query(query)
        .bind(routine_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    parameters.extend(rows.iter().map(|r| RoutineParameter {
        // Use column indices instead of names for Windows/MySQL 8 compatibility
        name: r.try_get(0).unwrap_or_default(), // parameter_name
        data_type: r.try_get(1).unwrap_or_default(), // data_type
        mode: r.try_get(2).unwrap_or_default(), // parameter_mode
        ordinal_position: r.try_get(3).unwrap_or(0), // ordinal_position
    }));

    Ok(parameters)
}

pub async fn get_routine_definition(
    params: &ConnectionParams,
    routine_name: &str,
    routine_type: &str,
) -> Result<String, String> {
    let pool = get_mysql_pool(params).await?;
    let query = format!(
        "SHOW CREATE {} `{}`",
        routine_type,
        escape_identifier(routine_name)
    );

    let row = sqlx::query(&query)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // The column name is "Create Procedure" or "Create Function" or retrieved by index 2
    let definition: String = row.try_get(2).unwrap_or_else(|_| {
        row.try_get(format!("Create {}", routine_type).as_str())
            .unwrap_or_default()
    });

    Ok(definition)
}

pub async fn execute_query(
    params: &ConnectionParams,
    query: &str,
    limit: Option<u32>,
    page: u32,
) -> Result<QueryResult, String> {
    let pool = get_mysql_pool(params).await?;
    let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;

    let is_select = query.trim_start().to_uppercase().starts_with("SELECT");
    let mut pagination: Option<Pagination> = None;
    let final_query: String;
    let mut manual_limit = limit;
    let mut truncated = false;

    if is_select && limit.is_some() {
        let l = limit.unwrap();
        let offset = (page - 1) * l;

        // Count total rows
        let count_q = format!("SELECT COUNT(*) FROM ({}) as count_wrapper", query);
        // We use fetch_one directly
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

        // Set truncated if there are more results than shown
        truncated = total_rows > l as u64;

        // Extract ORDER BY clause from the original query to preserve sorting
        let order_by_clause = extract_order_by(query);

        if !order_by_clause.is_empty() {
            // Remove ORDER BY from inner query and add it to outer query
            let query_without_order = remove_order_by(query);
            final_query = format!(
                "SELECT * FROM ({}) as data_wrapper {} LIMIT {} OFFSET {}",
                query_without_order, order_by_clause, l, offset
            );
        } else {
            // Wrap query for pagination
            final_query = format!(
                "SELECT * FROM ({}) as data_wrapper LIMIT {} OFFSET {}",
                query, l, offset
            );
        }

        manual_limit = None; // Disable manual limit since SQL handles it
    } else {
        final_query = query.to_string();
    }

    // Use fetch instead of fetch_all to support streaming/limit
    let mut rows_stream = sqlx::query(&final_query).fetch(&mut *conn);

    let mut columns: Vec<String> = Vec::new();
    let mut json_rows = Vec::new();

    use futures::stream::StreamExt; // Correct import

    while let Some(result) = rows_stream.next().await {
        match result {
            Ok(row) => {
                // Initialize columns from the first row
                if columns.is_empty() {
                    columns = row.columns().iter().map(|c| c.name().to_string()).collect();
                }

                // Check limit (only if manual_limit is set)
                if let Some(l) = manual_limit {
                    if json_rows.len() >= l as usize {
                        truncated = true;
                        break;
                    }
                }

                // Map row using type extraction function
                let mut json_row = Vec::new();
                for (i, _) in row.columns().iter().enumerate() {
                    let val = extract_mysql_value(&row, i);
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

#[cfg(test)]
mod tests {
    use super::*;

    mod sql_parsing {
        use super::*;

        #[test]
        fn test_extract_order_by_simple() {
            let query = "SELECT * FROM users ORDER BY id DESC";
            assert_eq!(extract_order_by(query), "ORDER BY id DESC");
        }

        #[test]
        fn test_extract_order_by_multiple_columns() {
            let query = "SELECT * FROM users ORDER BY name ASC, id DESC";
            assert_eq!(extract_order_by(query), "ORDER BY name ASC, id DESC");
        }

        #[test]
        fn test_extract_order_by_case_insensitive() {
            let query = "select * from users order by id";
            assert_eq!(extract_order_by(query), "order by id");
        }

        #[test]
        fn test_extract_order_by_no_order_by() {
            let query = "SELECT * FROM users WHERE id = 1";
            assert_eq!(extract_order_by(query), "");
        }

        #[test]
        fn test_extract_order_by_with_where() {
            let query = "SELECT * FROM users WHERE active = true ORDER BY created_at DESC";
            assert_eq!(extract_order_by(query), "ORDER BY created_at DESC");
        }

        #[test]
        fn test_extract_order_by_subquery() {
            // Should find the last ORDER BY (in the main query, not subquery)
            let query = "SELECT * FROM (SELECT * FROM users ORDER BY id) AS u ORDER BY name";
            assert_eq!(extract_order_by(query), "ORDER BY name");
        }

        #[test]
        fn test_remove_order_by_simple() {
            let query = "SELECT * FROM users ORDER BY id DESC";
            assert_eq!(remove_order_by(query), "SELECT * FROM users");
        }

        #[test]
        fn test_remove_order_by_with_where() {
            let query = "SELECT * FROM users WHERE active = true ORDER BY created_at DESC";
            assert_eq!(
                remove_order_by(query),
                "SELECT * FROM users WHERE active = true"
            );
        }

        #[test]
        fn test_remove_order_by_no_order_by() {
            let query = "SELECT * FROM users WHERE id = 1";
            assert_eq!(remove_order_by(query), query);
        }

        #[test]
        fn test_remove_order_by_preserves_whitespace() {
            let query = "SELECT * FROM users ORDER BY id";
            let result = remove_order_by(query);
            assert!(!result.contains("ORDER BY"));
            assert_eq!(result, "SELECT * FROM users");
        }

        #[test]
        fn test_remove_order_by_complex_query() {
            let query = "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id WHERE p.published = true ORDER BY p.created_at DESC, u.name ASC";
            let expected = "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id WHERE p.published = true";
            assert_eq!(remove_order_by(query), expected);
        }
    }
}
