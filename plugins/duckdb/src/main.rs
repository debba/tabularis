use base64::Engine;
use duckdb::{types::Value, Connection};
use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::io::{self, BufRead, Write};

fn get_or_create_connection<'a>(
    connections: &'a mut HashMap<String, Connection>,
    db_path: &str,
) -> Result<&'a mut Connection, String> {
    if !connections.contains_key(db_path) {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        connections.insert(db_path.to_string(), conn);
    }
    Ok(connections.get_mut(db_path).unwrap())
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut connections: HashMap<String, Connection> = HashMap::new();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Error reading from stdin: {}", e);
                break;
            }
        };

        if line.trim().is_empty() {
            continue;
        }

        let req: JsonValue = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Failed to parse request: {}", e);
                continue;
            }
        };

        let id = req["id"].clone();
        let method = match req["method"].as_str() {
            Some(m) => m.to_string(),
            None => {
                send_error(&mut stdout, id, -32600, "Method not specified");
                continue;
            }
        };

        let params = &req["params"];

        let db_path = params
            .get("params")
            .and_then(|p| p.get("database"))
            .and_then(|d| d.as_str())
            .unwrap_or(":memory:")
            .to_string();

        let schema = params
            .get("schema")
            .and_then(|s| s.as_str())
            .unwrap_or("main")
            .to_string();

        let conn = match get_or_create_connection(&mut connections, &db_path) {
            Ok(c) => c,
            Err(e) => {
                send_error(
                    &mut stdout,
                    id,
                    -32000,
                    &format!("Failed to connect to DuckDB: {}", e),
                );
                continue;
            }
        };

        match method.as_str() {
            "test_connection" => {
                send_success(&mut stdout, id, json!(true));
            }
            "get_databases" => {
                send_success(&mut stdout, id, json!(["main"]));
            }
            "get_schemas" => {
                send_success(&mut stdout, id, json!(["main"]));
            }
            "get_tables" => match get_tables(conn, &schema) {
                Ok(v) => send_success(&mut stdout, id, v),
                Err(e) => send_error(&mut stdout, id, -32001, &e),
            },
            "get_columns" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                match get_columns(conn, table, &schema) {
                    Ok(v) => send_success(&mut stdout, id, v),
                    Err(e) => send_error(&mut stdout, id, -32002, &e),
                }
            }
            "get_foreign_keys" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                match get_foreign_keys(conn, table, &schema) {
                    Ok(v) => send_success(&mut stdout, id, v),
                    Err(e) => send_error(&mut stdout, id, -32003, &e),
                }
            }
            "get_indexes" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                match get_indexes(conn, table, &schema) {
                    Ok(v) => send_success(&mut stdout, id, v),
                    Err(e) => send_error(&mut stdout, id, -32004, &e),
                }
            }
            "get_views" => match get_views(conn, &schema) {
                Ok(v) => send_success(&mut stdout, id, v),
                Err(e) => send_error(&mut stdout, id, -32005, &e),
            },
            "get_view_definition" => {
                let view_name = params
                    .get("view_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                match get_view_definition(conn, view_name, &schema) {
                    Ok(v) => send_success(&mut stdout, id, json!(v)),
                    Err(e) => send_error(&mut stdout, id, -32006, &e),
                }
            }
            "get_view_columns" => {
                let view_name = params
                    .get("view_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                match get_columns(conn, view_name, &schema) {
                    Ok(v) => send_success(&mut stdout, id, v),
                    Err(e) => send_error(&mut stdout, id, -32007, &e),
                }
            }
            "create_view" => {
                let view_name = params
                    .get("view_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let definition = params
                    .get("definition")
                    .and_then(|d| d.as_str())
                    .unwrap_or("");
                match create_view(conn, view_name, definition) {
                    Ok(()) => send_success(&mut stdout, id, json!(null)),
                    Err(e) => send_error(&mut stdout, id, -32008, &e),
                }
            }
            "alter_view" => {
                let view_name = params
                    .get("view_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let definition = params
                    .get("definition")
                    .and_then(|d| d.as_str())
                    .unwrap_or("");
                match alter_view(conn, view_name, definition) {
                    Ok(()) => send_success(&mut stdout, id, json!(null)),
                    Err(e) => send_error(&mut stdout, id, -32009, &e),
                }
            }
            "drop_view" => {
                let view_name = params
                    .get("view_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                match drop_view(conn, view_name) {
                    Ok(()) => send_success(&mut stdout, id, json!(null)),
                    Err(e) => send_error(&mut stdout, id, -32010, &e),
                }
            }
            "get_routines" | "get_routine_parameters" => {
                send_success(&mut stdout, id, json!([]));
            }
            "get_routine_definition" => {
                send_error(
                    &mut stdout,
                    id,
                    -32011,
                    "DuckDB does not support stored procedures",
                );
            }
            "execute_query" => {
                let raw_query = params
                    .get("query")
                    .and_then(|q| q.as_str())
                    .unwrap_or("");
                let query = inject_rowid_for_pk_less_tables(conn, raw_query, &schema);
                let limit = params
                    .get("limit")
                    .and_then(|l| l.as_u64())
                    .map(|l| l as u32);
                let page = params
                    .get("page")
                    .and_then(|p| p.as_u64())
                    .map(|p| p as u32)
                    .unwrap_or(1);
                match execute_query(conn, &query, limit, page) {
                    Ok(v) => send_success(&mut stdout, id, v),
                    Err(e) => send_error(&mut stdout, id, -32012, &e),
                }
            }
            "insert_record" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let data = params
                    .get("data")
                    .and_then(|d| d.as_object())
                    .cloned()
                    .unwrap_or_default();
                let max_blob_size = params
                    .get("max_blob_size")
                    .and_then(|m| m.as_u64())
                    .unwrap_or(100 * 1024 * 1024);
                match insert_record(conn, table, data, max_blob_size) {
                    Ok(n) => send_success(&mut stdout, id, json!(n)),
                    Err(e) => send_error(&mut stdout, id, -32013, &e),
                }
            }
            "update_record" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let pk_col = params
                    .get("pk_col")
                    .and_then(|p| p.as_str())
                    .unwrap_or("");
                let pk_val = params
                    .get("pk_val")
                    .cloned()
                    .unwrap_or(JsonValue::Null);
                let col_name = params
                    .get("col_name")
                    .and_then(|c| c.as_str())
                    .unwrap_or("");
                let new_val = params
                    .get("new_val")
                    .cloned()
                    .unwrap_or(JsonValue::Null);
                let max_blob_size = params
                    .get("max_blob_size")
                    .and_then(|m| m.as_u64())
                    .unwrap_or(100 * 1024 * 1024);
                match update_record(conn, table, pk_col, &pk_val, col_name, &new_val, max_blob_size)
                {
                    Ok(n) => send_success(&mut stdout, id, json!(n)),
                    Err(e) => send_error(&mut stdout, id, -32014, &e),
                }
            }
            "delete_record" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let pk_col = params
                    .get("pk_col")
                    .and_then(|p| p.as_str())
                    .unwrap_or("");
                let pk_val = params
                    .get("pk_val")
                    .cloned()
                    .unwrap_or(JsonValue::Null);
                match delete_record(conn, table, pk_col, &pk_val) {
                    Ok(n) => send_success(&mut stdout, id, json!(n)),
                    Err(e) => send_error(&mut stdout, id, -32015, &e),
                }
            }
            "get_schema_snapshot" => match get_schema_snapshot(conn, &schema) {
                Ok(v) => send_success(&mut stdout, id, v),
                Err(e) => send_error(&mut stdout, id, -32016, &e),
            },
            "get_all_columns_batch" => match get_all_columns_batch(conn, &schema) {
                Ok(v) => send_success(&mut stdout, id, v),
                Err(e) => send_error(&mut stdout, id, -32017, &e),
            },
            "get_all_foreign_keys_batch" => match get_all_foreign_keys_batch(conn, &schema) {
                Ok(v) => send_success(&mut stdout, id, v),
                Err(e) => send_error(&mut stdout, id, -32018, &e),
            },
            "get_create_table_sql" => {
                let table_name = params.get("table_name").and_then(|t| t.as_str()).unwrap_or("");
                let columns: Vec<JsonValue> = params.get("columns").and_then(|c| c.as_array()).cloned().unwrap_or_default();
                match ddl_get_create_table_sql(table_name, &columns) {
                    Ok(v) => send_success(&mut stdout, id, json!(v)),
                    Err(e) => send_error(&mut stdout, id, -32019, &e),
                }
            }
            "get_add_column_sql" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let column = params.get("column").cloned().unwrap_or(json!({}));
                match ddl_get_add_column_sql(table, &column) {
                    Ok(v) => send_success(&mut stdout, id, json!(v)),
                    Err(e) => send_error(&mut stdout, id, -32020, &e),
                }
            }
            "get_alter_column_sql" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let old_column = params.get("old_column").cloned().unwrap_or(json!({}));
                let new_column = params.get("new_column").cloned().unwrap_or(json!({}));
                match ddl_get_alter_column_sql(table, &old_column, &new_column) {
                    Ok(v) => send_success(&mut stdout, id, json!(v)),
                    Err(e) => send_error(&mut stdout, id, -32021, &e),
                }
            }
            "get_create_index_sql" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let index_name = params.get("index_name").and_then(|n| n.as_str()).unwrap_or("");
                let columns: Vec<String> = params.get("columns").and_then(|c| c.as_array()).map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
                let is_unique = params.get("is_unique").and_then(|u| u.as_bool()).unwrap_or(false);
                match ddl_get_create_index_sql(table, index_name, &columns, is_unique) {
                    Ok(v) => send_success(&mut stdout, id, json!(v)),
                    Err(e) => send_error(&mut stdout, id, -32022, &e),
                }
            }
            "get_create_foreign_key_sql" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let fk_name = params.get("fk_name").and_then(|n| n.as_str()).unwrap_or("");
                let column = params.get("column").and_then(|c| c.as_str()).unwrap_or("");
                let ref_table = params.get("ref_table").and_then(|t| t.as_str()).unwrap_or("");
                let ref_column = params.get("ref_column").and_then(|c| c.as_str()).unwrap_or("");
                let on_delete = params.get("on_delete").and_then(|d| d.as_str());
                let on_update = params.get("on_update").and_then(|u| u.as_str());
                match ddl_get_create_foreign_key_sql(table, fk_name, column, ref_table, ref_column, on_delete, on_update) {
                    Ok(v) => send_success(&mut stdout, id, json!(v)),
                    Err(e) => send_error(&mut stdout, id, -32023, &e),
                }
            }
            "drop_index" => {
                let index_name = params.get("index_name").and_then(|n| n.as_str()).unwrap_or("");
                let sql = format!("DROP INDEX {}", escape_identifier(index_name));
                match conn.execute_batch(&sql) {
                    Ok(_) => send_success(&mut stdout, id, json!(null)),
                    Err(e) => send_error(&mut stdout, id, -32024, &e.to_string()),
                }
            }
            "drop_foreign_key" => {
                let table = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                let fk_name = params.get("fk_name").and_then(|n| n.as_str()).unwrap_or("");
                let sql = format!("ALTER TABLE {} DROP CONSTRAINT {}", escape_identifier(table), escape_identifier(fk_name));
                match conn.execute_batch(&sql) {
                    Ok(_) => send_success(&mut stdout, id, json!(null)),
                    Err(e) => send_error(&mut stdout, id, -32025, &e.to_string()),
                }
            }
            _ => {
                send_error(
                    &mut stdout,
                    id,
                    -32601,
                    &format!("Method '{}' not implemented", method),
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

fn send_success(stdout: &mut io::Stdout, id: JsonValue, result: JsonValue) {
    let response = json!({
        "jsonrpc": "2.0",
        "result": result,
        "id": id
    });
    let mut res_str = serde_json::to_string(&response).unwrap();
    res_str.push('\n');
    stdout.write_all(res_str.as_bytes()).unwrap();
    stdout.flush().unwrap();
}

fn send_error(stdout: &mut io::Stdout, id: JsonValue, code: i32, message: &str) {
    let response = json!({
        "jsonrpc": "2.0",
        "error": {
            "code": code,
            "message": message
        },
        "id": id
    });
    let mut res_str = serde_json::to_string(&response).unwrap();
    res_str.push('\n');
    stdout.write_all(res_str.as_bytes()).unwrap();
    stdout.flush().unwrap();
}

// ---------------------------------------------------------------------------
// SQL utilities
// ---------------------------------------------------------------------------

fn escape_identifier(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

// ---------------------------------------------------------------------------
// DDL generation helpers
// ---------------------------------------------------------------------------

fn col_name(col: &JsonValue) -> &str {
    col.get("name").and_then(|v| v.as_str()).unwrap_or("")
}
fn col_type(col: &JsonValue) -> &str {
    col.get("data_type").and_then(|v| v.as_str()).unwrap_or("TEXT")
}
fn col_nullable(col: &JsonValue) -> bool {
    col.get("is_nullable").and_then(|v| v.as_bool()).unwrap_or(true)
}
fn col_pk(col: &JsonValue) -> bool {
    col.get("is_pk").and_then(|v| v.as_bool()).unwrap_or(false)
}
fn col_default(col: &JsonValue) -> Option<&str> {
    col.get("default_value").and_then(|v| v.as_str())
}

fn ddl_get_create_table_sql(table_name: &str, columns: &[JsonValue]) -> Result<Vec<String>, String> {
    let mut col_defs = Vec::new();
    let mut pk_cols = Vec::new();
    for col in columns {
        let mut def = format!("{} {}", escape_identifier(col_name(col)), col_type(col));
        if !col_nullable(col) {
            def.push_str(" NOT NULL");
        }
        if let Some(default) = col_default(col) {
            def.push_str(&format!(" DEFAULT {}", default));
        }
        col_defs.push(def);
        if col_pk(col) {
            pk_cols.push(escape_identifier(col_name(col)));
        }
    }
    if !pk_cols.is_empty() {
        col_defs.push(format!("PRIMARY KEY ({})", pk_cols.join(", ")));
    }
    Ok(vec![format!(
        "CREATE TABLE {} (\n  {}\n)",
        escape_identifier(table_name),
        col_defs.join(",\n  ")
    )])
}

fn ddl_get_add_column_sql(table: &str, column: &JsonValue) -> Result<Vec<String>, String> {
    let mut def = format!(
        "ALTER TABLE {} ADD COLUMN {} {}",
        escape_identifier(table),
        escape_identifier(col_name(column)),
        col_type(column)
    );
    if !col_nullable(column) {
        def.push_str(" NOT NULL");
    }
    if let Some(default) = col_default(column) {
        def.push_str(&format!(" DEFAULT {}", default));
    }
    Ok(vec![def])
}

fn ddl_get_alter_column_sql(table: &str, old_col: &JsonValue, new_col: &JsonValue) -> Result<Vec<String>, String> {
    let tbl = escape_identifier(table);
    let old_name = col_name(old_col);
    let new_name = col_name(new_col);
    let mut stmts = Vec::new();

    if old_name != new_name {
        stmts.push(format!(
            "ALTER TABLE {} RENAME COLUMN {} TO {}",
            tbl, escape_identifier(old_name), escape_identifier(new_name)
        ));
    }

    let col_ref = escape_identifier(new_name);

    if col_type(old_col) != col_type(new_col) {
        stmts.push(format!(
            "ALTER TABLE {} ALTER COLUMN {} TYPE {}",
            tbl, col_ref, col_type(new_col)
        ));
    }

    if col_nullable(old_col) != col_nullable(new_col) {
        if col_nullable(new_col) {
            stmts.push(format!("ALTER TABLE {} ALTER COLUMN {} DROP NOT NULL", tbl, col_ref));
        } else {
            stmts.push(format!("ALTER TABLE {} ALTER COLUMN {} SET NOT NULL", tbl, col_ref));
        }
    }

    if col_default(old_col) != col_default(new_col) {
        if let Some(default) = col_default(new_col) {
            stmts.push(format!("ALTER TABLE {} ALTER COLUMN {} SET DEFAULT {}", tbl, col_ref, default));
        } else {
            stmts.push(format!("ALTER TABLE {} ALTER COLUMN {} DROP DEFAULT", tbl, col_ref));
        }
    }

    if stmts.is_empty() {
        return Err("No changes detected".into());
    }
    Ok(stmts)
}

fn ddl_get_create_index_sql(table: &str, index_name: &str, columns: &[String], is_unique: bool) -> Result<Vec<String>, String> {
    let unique = if is_unique { "UNIQUE " } else { "" };
    let cols: Vec<String> = columns.iter().map(|c| escape_identifier(c)).collect();
    Ok(vec![format!(
        "CREATE {}INDEX {} ON {} ({})",
        unique,
        escape_identifier(index_name),
        escape_identifier(table),
        cols.join(", ")
    )])
}

fn ddl_get_create_foreign_key_sql(
    table: &str, fk_name: &str, column: &str,
    ref_table: &str, ref_column: &str,
    on_delete: Option<&str>, on_update: Option<&str>,
) -> Result<Vec<String>, String> {
    let mut sql = format!(
        "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({})",
        escape_identifier(table),
        escape_identifier(fk_name),
        escape_identifier(column),
        escape_identifier(ref_table),
        escape_identifier(ref_column)
    );
    if let Some(action) = on_delete {
        sql.push_str(&format!(" ON DELETE {}", action));
    }
    if let Some(action) = on_update {
        sql.push_str(&format!(" ON UPDATE {}", action));
    }
    Ok(vec![sql])
}

/// Formats a JSON value as a SQL literal suitable for inline use in DuckDB queries.
/// Uses `__USE_DEFAULT__` sentinel to emit `DEFAULT`, decodes blob wire format to hex.
fn sql_format_value(v: &JsonValue, max_blob_size: u64) -> Result<String, String> {
    match v {
        JsonValue::Null => Ok("NULL".to_string()),
        JsonValue::Bool(b) => Ok(if *b { "TRUE" } else { "FALSE" }.to_string()),
        JsonValue::Number(n) => Ok(n.to_string()),
        JsonValue::String(s) => {
            if s == "__USE_DEFAULT__" {
                return Ok("DEFAULT".to_string());
            }
            if let Some(bytes) = decode_blob_wire_format(s, max_blob_size) {
                let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
                return Ok(format!("decode('{}', 'hex')", hex));
            }
            let escaped = s.replace('\'', "''");
            Ok(format!("'{}'", escaped))
        }
        _ => Err(format!("Unsupported value type for SQL parameter: {:?}", v)),
    }
}

/// Decodes the Tabularis blob wire format ("BLOB:…" or "BLOB_FILE_REF:…") to raw bytes.
fn decode_blob_wire_format(value: &str, max_size: u64) -> Option<Vec<u8>> {
    if value.starts_with("BLOB_FILE_REF:") {
        let rest = value.strip_prefix("BLOB_FILE_REF:")?;
        let parts: Vec<&str> = rest.splitn(3, ':').collect();
        if parts.len() != 3 {
            return None;
        }
        let file_size: u64 = parts[0].parse().ok()?;
        if file_size > max_size {
            return None;
        }
        return std::fs::read(parts[2]).ok();
    }

    // Format: "BLOB:<total_size>:<mime_type>:<base64_data>"
    let rest = value.strip_prefix("BLOB:")?;
    let after_size = rest.splitn(2, ':').nth(1)?;
    let base64_data = after_size.splitn(2, ':').nth(1)?;
    base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .ok()
}

fn extract_order_by(query: &str) -> String {
    let upper = query.to_uppercase();
    if let Some(pos) = upper.rfind("ORDER BY") {
        query[pos..].trim().to_string()
    } else {
        String::new()
    }
}

fn remove_order_by(query: &str) -> String {
    let upper = query.to_uppercase();
    if let Some(pos) = upper.rfind("ORDER BY") {
        query[..pos].trim().to_string()
    } else {
        query.to_string()
    }
}

/// Extracts a (possibly quoted) table name from the text immediately
/// following `FROM `.  Returns `None` when the next token is `(` (subquery).
fn extract_table_name_after_from(s: &str) -> Option<String> {
    let s = s.trim_start();
    if s.starts_with('(') {
        return None; // subquery, not a bare table
    }
    if s.starts_with('"') {
        // Quoted identifier — find closing quote
        let end = s[1..].find('"')?;
        Some(s[1..1 + end].to_string())
    } else {
        // Unquoted — take until whitespace, semicolon or closing paren
        let end = s
            .find(|c: char| c.is_whitespace() || c == ';' || c == ')')
            .unwrap_or(s.len());
        if end == 0 {
            return None;
        }
        Some(s[..end].to_string())
    }
}

/// Rewrites `SELECT * FROM <table>` patterns so that `rowid` is included in
/// the result set for tables that lack an explicit primary key.
///
/// Only bare-table references are rewritten; `SELECT * FROM (subquery)` is
/// left untouched because the outer projection inherits columns from the
/// inner query where `rowid` was already injected.
fn inject_rowid_for_pk_less_tables(conn: &Connection, query: &str, schema: &str) -> String {
    let upper = query.to_uppercase();
    let pattern = "SELECT * FROM ";

    // Collect all match positions first.
    let mut positions: Vec<usize> = Vec::new();
    let mut search_start = 0;
    while let Some(rel_pos) = upper[search_start..].find(pattern) {
        positions.push(search_start + rel_pos);
        search_start += rel_pos + pattern.len();
    }

    if positions.is_empty() {
        return query.to_string();
    }

    // Process in reverse so earlier byte offsets stay valid after insertion.
    let mut result = query.to_string();
    let select_keyword_len = "SELECT ".len(); // 7

    for &pos in positions.iter().rev() {
        let after_from = &query[pos + pattern.len()..];
        let Some(table_name) = extract_table_name_after_from(after_from) else {
            continue;
        };
        let pks = get_primary_keys(conn, &table_name, schema);
        if pks.is_empty() {
            // Inject "rowid, " right after "SELECT " to form "SELECT rowid, * …"
            let inject_pos = pos + select_keyword_len;
            result.insert_str(inject_pos, "rowid, ");
        }
    }

    result
}

// ---------------------------------------------------------------------------
// Schema inspection
// ---------------------------------------------------------------------------

fn get_tables(conn: &Connection, schema: &str) -> Result<JsonValue, String> {
    let mut stmt = conn
        .prepare(
            "SELECT table_name \
             FROM information_schema.tables \
             WHERE table_schema = ? AND table_type = 'BASE TABLE' \
             ORDER BY table_name",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([schema], |row| {
            Ok(json!({ "name": row.get::<_, String>(0)? }))
        })
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for t in iter {
        tables.push(t.map_err(|e| e.to_string())?);
    }
    Ok(json!(tables))
}

/// Returns the set of primary-key column names for a table.
///
/// Uses `PRAGMA table_info` which is more reliable than `duckdb_constraints()`
/// + `unnest()` — the latter can fail silently on certain DuckDB versions.
fn get_primary_keys(
    conn: &Connection,
    table_name: &str,
    _schema: &str,
) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    let query = format!(
        "PRAGMA table_info('{}')",
        table_name.replace('\'', "''")
    );
    let Ok(mut stmt) = conn.prepare(&query) else {
        return set;
    };
    // PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
    let Ok(iter) = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(1)?, row.get::<_, i32>(5)?))
    }) else {
        return set;
    };
    for row in iter.flatten() {
        if row.1 > 0 {
            set.insert(row.0);
        }
    }
    set
}

/// Returns a map of table_name → set of PK column names for all tables in the schema.
///
/// Iterates over all tables and uses `PRAGMA table_info` for each one,
/// matching the approach used by `get_primary_keys`.
fn get_all_primary_keys(
    conn: &Connection,
    schema: &str,
) -> HashMap<String, std::collections::HashSet<String>> {
    let mut result: HashMap<String, std::collections::HashSet<String>> = HashMap::new();

    // First, get all table names in the schema
    let Ok(mut table_stmt) = conn.prepare(
        "SELECT table_name FROM information_schema.tables \
         WHERE table_schema = ? AND table_type = 'BASE TABLE'",
    ) else {
        return result;
    };
    let Ok(table_iter) = table_stmt.query_map([schema], |row| row.get::<_, String>(0)) else {
        return result;
    };

    let table_names: Vec<String> = table_iter.flatten().collect();
    for table_name in table_names {
        let pks = get_primary_keys(conn, &table_name, schema);
        if !pks.is_empty() {
            result.insert(table_name, pks);
        }
    }
    result
}

fn get_columns(
    conn: &Connection,
    table_name: &str,
    schema: &str,
) -> Result<JsonValue, String> {
    let pk_cols = get_primary_keys(conn, table_name, schema);

    let mut stmt = conn
        .prepare(
            "SELECT column_name, data_type, is_nullable, column_default \
             FROM information_schema.columns \
             WHERE table_name = ? AND table_schema = ? \
             ORDER BY ordinal_position",
        )
        .map_err(|e| e.to_string())?;

    let col_iter = stmt
        .query_map([table_name, schema], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    let mut has_explicit_pk = false;

    for c in col_iter {
        let (col_name, data_type, is_nullable, default_value) =
            c.map_err(|e| e.to_string())?;
        let is_pk = pk_cols.contains(&col_name);
        if is_pk {
            has_explicit_pk = true;
        }
        let is_auto_increment = data_type.to_uppercase().contains("SERIAL")
            || default_value
                .as_deref()
                .map(|d| d.to_lowercase().contains("nextval"))
                .unwrap_or(false);

        columns.push(json!({
            "name": col_name,
            "data_type": data_type,
            "is_pk": is_pk,
            "is_nullable": is_nullable == "YES",
            "is_auto_increment": is_auto_increment,
            "default_value": default_value,
        }));
    }

    // DuckDB tables without an explicit PK still expose a virtual `rowid`
    // column.  Prepend it so the frontend can use it as a row identifier
    // for cell editing.
    if !has_explicit_pk {
        columns.insert(0, json!({
            "name": "rowid",
            "data_type": "BIGINT",
            "is_pk": true,
            "is_nullable": false,
            "is_auto_increment": false,
            "default_value": null,
        }));
    }

    Ok(json!(columns))
}

fn get_foreign_keys(
    conn: &Connection,
    table_name: &str,
    schema: &str,
) -> Result<JsonValue, String> {
    let mut stmt = conn
        .prepare(
            "SELECT \
                unnest(constraint_column_names) as column_name, \
                referenced_table as ref_table, \
                unnest(referenced_column_names) as ref_column, \
                constraint_name as name \
             FROM duckdb_constraints() \
             WHERE table_name = ? AND constraint_type = 'FOREIGN KEY' AND schema_name = ?",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([table_name, schema], |row| {
            Ok(json!({
                "name": row.get::<_, String>(3)?,
                "column_name": row.get::<_, String>(0)?,
                "ref_table": row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                "ref_column": row.get::<_, String>(2)?,
                "on_delete": null,
                "on_update": null,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut fks = Vec::new();
    for fk in iter {
        match fk {
            Ok(v) => fks.push(v),
            Err(_) => continue,
        }
    }
    Ok(json!(fks))
}

fn get_indexes(
    conn: &Connection,
    table_name: &str,
    schema: &str,
) -> Result<JsonValue, String> {
    let mut stmt = match conn.prepare(
        "SELECT index_name, unnest(expressions) as col_expr, is_unique, is_primary \
         FROM duckdb_indexes() \
         WHERE table_name = ? AND schema_name = ?",
    ) {
        Ok(s) => s,
        Err(_) => return Ok(json!([])),
    };

    let iter = match stmt.query_map([table_name, schema], |row| {
        Ok(json!({
            "name": row.get::<_, String>(0)?,
            "column_name": row.get::<_, String>(1)?,
            "is_unique": row.get::<_, bool>(2).unwrap_or(false),
            "is_primary": row.get::<_, bool>(3).unwrap_or(false),
            "seq_in_index": 0,
        }))
    }) {
        Ok(i) => i,
        Err(_) => return Ok(json!([])),
    };

    let mut indexes = Vec::new();
    for idx in iter {
        match idx {
            Ok(v) => indexes.push(v),
            Err(_) => continue,
        }
    }
    Ok(json!(indexes))
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

fn get_views(conn: &Connection, schema: &str) -> Result<JsonValue, String> {
    let mut stmt = conn
        .prepare(
            "SELECT table_name \
             FROM information_schema.views \
             WHERE table_schema = ? \
             ORDER BY table_name",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([schema], |row| {
            Ok(json!({
                "name": row.get::<_, String>(0)?,
                "definition": null,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut views = Vec::new();
    for v in iter {
        views.push(v.map_err(|e| e.to_string())?);
    }
    Ok(json!(views))
}

fn get_view_definition(
    conn: &Connection,
    view_name: &str,
    schema: &str,
) -> Result<String, String> {
    let mut stmt = conn
        .prepare(
            "SELECT view_definition \
             FROM information_schema.views \
             WHERE table_name = ? AND table_schema = ?",
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row([view_name, schema], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to get view definition: {}", e))
}

fn create_view(conn: &Connection, view_name: &str, definition: &str) -> Result<(), String> {
    let sql = format!(
        "CREATE VIEW {} AS {}",
        escape_identifier(view_name),
        definition
    );
    conn.execute_batch(&sql)
        .map_err(|e| format!("Failed to create view: {}", e))
}

fn alter_view(conn: &Connection, view_name: &str, definition: &str) -> Result<(), String> {
    let drop_sql = format!("DROP VIEW IF EXISTS {}", escape_identifier(view_name));
    conn.execute_batch(&drop_sql)
        .map_err(|e| format!("Failed to drop view: {}", e))?;

    let create_sql = format!(
        "CREATE VIEW {} AS {}",
        escape_identifier(view_name),
        definition
    );
    conn.execute_batch(&create_sql)
        .map_err(|e| format!("Failed to recreate view: {}", e))
}

fn drop_view(conn: &Connection, view_name: &str) -> Result<(), String> {
    let sql = format!("DROP VIEW IF EXISTS {}", escape_identifier(view_name));
    conn.execute_batch(&sql)
        .map_err(|e| format!("Failed to drop view: {}", e))
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

fn execute_query(
    conn: &Connection,
    query: &str,
    limit: Option<u32>,
    page: u32,
) -> Result<JsonValue, String> {
    let upper = query.trim_start().to_uppercase();
    let is_select = upper.starts_with("SELECT")
        || upper.starts_with("WITH")
        || upper.starts_with("SHOW")
        || upper.starts_with("DESCRIBE")
        || upper.starts_with("EXPLAIN")
        || upper.starts_with("FROM");

    if !is_select {
        let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
        let affected = stmt.execute([]).map_err(|e| e.to_string())?;
        return Ok(json!({
            "columns": [],
            "rows": [],
            "affected_rows": affected,
            "truncated": false,
            "pagination": null,
        }));
    }

    // SELECT with pagination
    if let Some(l) = limit {
        let page = if page == 0 { 1 } else { page };
        let offset = (page - 1) * l;

        let count_query = format!(
            "SELECT COUNT(*) FROM ({}) AS __count_subq__",
            query
        );
        let total_rows: u64 = conn
            .prepare(&count_query)
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .map(|n| n as u64)
            .unwrap_or(0);

        let order_by = extract_order_by(query);
        let paginated_query = if !order_by.is_empty() {
            let inner = remove_order_by(query);
            format!(
                "SELECT * FROM ({}) AS __page_subq__ {} LIMIT {} OFFSET {}",
                inner, order_by, l, offset
            )
        } else {
            format!(
                "SELECT * FROM ({}) AS __page_subq__ LIMIT {} OFFSET {}",
                query, l, offset
            )
        };

        let (columns, rows_data) = run_select(conn, &paginated_query)?;

        return Ok(json!({
            "columns": columns,
            "rows": rows_data,
            "affected_rows": 0,
            "truncated": false,
            "pagination": {
                "page": page,
                "page_size": l,
                "total_rows": total_rows,
            },
        }));
    }

    // SELECT without pagination
    let (columns, rows_data) = run_select(conn, query)?;
    Ok(json!({
        "columns": columns,
        "rows": rows_data,
        "affected_rows": 0,
        "truncated": false,
        "pagination": null,
    }))
}

/// Runs a SELECT query and returns (column_names, rows).
fn run_select(
    conn: &Connection,
    query: &str,
) -> Result<(Vec<String>, Vec<JsonValue>), String> {
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

    let col_count = rows.as_ref().map(|s| s.column_count()).unwrap_or(0);
    let column_names: Vec<String> = rows
        .as_ref()
        .map(|s| s.column_names().into_iter().map(String::from).collect())
        .unwrap_or_default();

    let mut rows_data: Vec<JsonValue> = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut row_vec = Vec::new();
        for i in 0..col_count {
            let val_ref = row.get_ref(i).map_err(|e| e.to_string())?;
            let val = Value::from(val_ref);
            row_vec.push(duckdb_value_to_json(val));
        }
        rows_data.push(JsonValue::Array(row_vec));
    }

    Ok((column_names, rows_data))
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

fn insert_record(
    conn: &Connection,
    table: &str,
    data: serde_json::Map<String, JsonValue>,
    max_blob_size: u64,
) -> Result<u64, String> {
    if data.is_empty() {
        let sql = format!("INSERT INTO {} DEFAULT VALUES", escape_identifier(table));
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let affected = stmt.execute([]).map_err(|e| e.to_string())?;
        return Ok(affected as u64);
    }

    let cols: Vec<String> = data.keys().map(|k| escape_identifier(k)).collect();
    let mut vals = Vec::new();
    for v in data.values() {
        vals.push(sql_format_value(v, max_blob_size)?);
    }

    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        escape_identifier(table),
        cols.join(", "),
        vals.join(", ")
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let affected = stmt.execute([]).map_err(|e| e.to_string())?;
    Ok(affected as u64)
}

fn update_record(
    conn: &Connection,
    table: &str,
    pk_col: &str,
    pk_val: &JsonValue,
    col_name: &str,
    new_val: &JsonValue,
    max_blob_size: u64,
) -> Result<u64, String> {
    let val_sql = sql_format_value(new_val, max_blob_size)?;
    let pk_sql = sql_format_value(pk_val, 0)?;

    let sql = format!(
        "UPDATE {} SET {} = {} WHERE {} = {}",
        escape_identifier(table),
        escape_identifier(col_name),
        val_sql,
        escape_identifier(pk_col),
        pk_sql
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let affected = stmt.execute([]).map_err(|e| e.to_string())?;
    Ok(affected as u64)
}

fn delete_record(
    conn: &Connection,
    table: &str,
    pk_col: &str,
    pk_val: &JsonValue,
) -> Result<u64, String> {
    let pk_sql = sql_format_value(pk_val, 0)?;

    let sql = format!(
        "DELETE FROM {} WHERE {} = {}",
        escape_identifier(table),
        escape_identifier(pk_col),
        pk_sql
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let affected = stmt.execute([]).map_err(|e| e.to_string())?;
    Ok(affected as u64)
}

// ---------------------------------------------------------------------------
// Batch / snapshot
// ---------------------------------------------------------------------------

fn get_all_columns_batch(conn: &Connection, schema: &str) -> Result<JsonValue, String> {
    let pks_by_table = get_all_primary_keys(conn, schema);

    let mut stmt = conn
        .prepare(
            "SELECT table_name, column_name, data_type, is_nullable, column_default \
             FROM information_schema.columns \
             WHERE table_schema = ? \
             ORDER BY table_name, ordinal_position",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([schema], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut result: HashMap<String, Vec<JsonValue>> = HashMap::new();
    for row in iter {
        let (table_name, col_name, data_type, is_nullable, default_value) =
            row.map_err(|e| e.to_string())?;
        let pk_cols = pks_by_table
            .get(&table_name)
            .cloned()
            .unwrap_or_default();
        let is_pk = pk_cols.contains(&col_name);
        let is_auto_increment = data_type.to_uppercase().contains("SERIAL")
            || default_value
                .as_deref()
                .map(|d| d.to_lowercase().contains("nextval"))
                .unwrap_or(false);

        result.entry(table_name).or_default().push(json!({
            "name": col_name,
            "data_type": data_type,
            "is_pk": is_pk,
            "is_nullable": is_nullable == "YES",
            "is_auto_increment": is_auto_increment,
            "default_value": default_value,
        }));
    }
    Ok(json!(result))
}

fn get_all_foreign_keys_batch(conn: &Connection, schema: &str) -> Result<JsonValue, String> {
    let mut stmt = conn
        .prepare(
            "SELECT \
                table_name, \
                unnest(constraint_column_names) as column_name, \
                referenced_table as ref_table, \
                unnest(referenced_column_names) as ref_column, \
                constraint_name as name \
             FROM duckdb_constraints() \
             WHERE constraint_type = 'FOREIGN KEY' AND schema_name = ?",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([schema], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut result: HashMap<String, Vec<JsonValue>> = HashMap::new();
    for row in iter {
        match row {
            Ok((table_name, column_name, ref_table, ref_column, name)) => {
                result.entry(table_name).or_default().push(json!({
                    "name": name,
                    "column_name": column_name,
                    "ref_table": ref_table,
                    "ref_column": ref_column,
                    "on_delete": null,
                    "on_update": null,
                }));
            }
            Err(_) => continue,
        }
    }
    Ok(json!(result))
}

fn get_schema_snapshot(conn: &Connection, schema: &str) -> Result<JsonValue, String> {
    let tables_json = get_tables(conn, schema)?;
    let table_names: Vec<String> = tables_json
        .as_array()
        .unwrap_or(&Vec::new())
        .iter()
        .filter_map(|t| t["name"].as_str().map(String::from))
        .collect();

    let mut snapshots = Vec::new();
    for name in &table_names {
        let columns = get_columns(conn, name, schema)?;
        let fks = get_foreign_keys(conn, name, schema)?;
        snapshots.push(json!({
            "name": name,
            "columns": columns,
            "foreign_keys": fks,
        }));
    }
    Ok(json!(snapshots))
}

// ---------------------------------------------------------------------------
// Value conversion
// ---------------------------------------------------------------------------

fn duckdb_value_to_json(val: Value) -> JsonValue {
    match val {
        Value::Null => JsonValue::Null,
        Value::Boolean(b) => json!(b),
        Value::TinyInt(v) => json!(v),
        Value::SmallInt(v) => json!(v),
        Value::Int(v) => json!(v),
        Value::BigInt(v) => json!(v),
        Value::HugeInt(v) => json!(v.to_string()),
        Value::UTinyInt(v) => json!(v),
        Value::USmallInt(v) => json!(v),
        Value::UInt(v) => json!(v),
        Value::UBigInt(v) => json!(v),
        Value::Float(v) => json!(v),
        Value::Double(v) => json!(v),
        Value::Decimal(v) => json!(v.to_string()),
        Value::Timestamp(_, t) => json!(t),
        Value::Text(v) => json!(v),
        Value::Blob(v) => json!(format!("Blob({} bytes)", v.len())),
        Value::Date32(v) => json!(v),
        Value::Time64(_, t) => json!(t),
        Value::Interval {
            months,
            days,
            nanos,
        } => json!(format!("Interval({}m, {}d, {}ns)", months, days, nanos)),
        Value::List(vals) => {
            JsonValue::Array(vals.into_iter().map(duckdb_value_to_json).collect())
        }
        Value::Enum(v) => json!(v),
        Value::Struct(map) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in map.iter() {
                obj.insert(k.clone(), duckdb_value_to_json(v.clone()));
            }
            JsonValue::Object(obj)
        }
        Value::Array(vals) => {
            JsonValue::Array(vals.into_iter().map(duckdb_value_to_json).collect())
        }
        Value::Map(map) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in map.iter() {
                let key_str = match duckdb_value_to_json(k.clone()) {
                    JsonValue::String(s) => s,
                    other => other.to_string(),
                };
                obj.insert(key_str, duckdb_value_to_json(v.clone()));
            }
            JsonValue::Object(obj)
        }
        Value::Union(v) => duckdb_value_to_json(*v),
    }
}
