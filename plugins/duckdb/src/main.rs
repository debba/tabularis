use duckdb::{types::Value, Connection, Result};
use serde_json::{json, Value as JsonValue};
use std::io::{self, BufRead, Write};

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

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
            Some(m) => m,
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
            .unwrap_or(":memory:");

        let conn_result = Connection::open(db_path);
        if let Err(e) = conn_result {
            send_error(
                &mut stdout,
                id,
                -32000,
                &format!("Failed to connect to DuckDB: {}", e),
            );
            continue;
        }
        let conn = conn_result.unwrap();

        match method {
            "test_connection" => {
                // Connection was already opened above — if we reach here it succeeded
                send_success(&mut stdout, id, json!(true));
            }
            "get_databases" => {
                send_success(&mut stdout, id, json!(["main"]));
            }
            "get_schemas" => {
                send_success(&mut stdout, id, json!(["main"]));
            }
            "get_tables" => match get_tables(&conn) {
                Ok(tables) => send_success(&mut stdout, id, tables),
                Err(e) => send_error(&mut stdout, id, -32001, &e),
            },
            "get_columns" => {
                let table_name = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                match get_columns(&conn, table_name) {
                    Ok(cols) => send_success(&mut stdout, id, cols),
                    Err(e) => send_error(&mut stdout, id, -32002, &e),
                }
            }
            "execute_query" => {
                let query = params.get("query").and_then(|q| q.as_str()).unwrap_or("");
                match execute_query(&conn, query) {
                    Ok(res) => send_success(&mut stdout, id, res),
                    Err(e) => send_error(&mut stdout, id, -32003, &e),
                }
            }
            "get_views" | "get_routines" | "get_indexes" | "get_foreign_keys" => {
                send_success(&mut stdout, id, json!([]));
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

fn get_tables(conn: &Connection) -> Result<JsonValue, String> {
    let mut stmt = conn.prepare("SELECT table_name, 'main' as schema_name, '' as comment FROM information_schema.tables WHERE table_schema='main' AND table_type='BASE TABLE'")
        .map_err(|e| e.to_string())?;

    let table_iter = stmt
        .query_map([], |row| {
            Ok(json!({
                "name": row.get::<_, String>(0)?,
                "schema": row.get::<_, String>(1)?,
                "comment": row.get::<_, Option<String>>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for t in table_iter {
        tables.push(t.map_err(|e| e.to_string())?);
    }

    Ok(json!(tables))
}

fn get_columns(conn: &Connection, table_name: &str) -> Result<JsonValue, String> {
    let mut stmt = conn.prepare("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = ?")
        .map_err(|e| e.to_string())?;

    let col_iter = stmt
        .query_map([table_name], |row| {
            let is_nullable: String = row.get(2)?;
            Ok(json!({
                "name": row.get::<_, String>(0)?,
                "data_type": row.get::<_, String>(1)?,
                "is_nullable": is_nullable == "YES",
                "default_value": row.get::<_, Option<String>>(3)?,
                "is_primary": false,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for c in col_iter {
        columns.push(c.map_err(|e| e.to_string())?);
    }

    Ok(json!(columns))
}

fn execute_query(conn: &Connection, query: &str) -> Result<JsonValue, String> {
    // Detect if query is a SELECT-like statement by trying to prepare and inspect
    // We use conn.execute() for DML (returns affected rows) and stmt.query() for SELECT
    let trimmed = query.trim_start().to_ascii_uppercase();
    let is_select = trimmed.starts_with("SELECT")
        || trimmed.starts_with("WITH")
        || trimmed.starts_with("SHOW")
        || trimmed.starts_with("DESCRIBE")
        || trimmed.starts_with("EXPLAIN")
        || trimmed.starts_with("PRAGMA");

    if is_select {
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

        Ok(json!({
            "columns": column_names,
            "rows": rows_data,
            "affected_rows": 0,
            "truncated": false,
            "pagination": null
        }))
    } else {
        let affected = conn.execute(query, []).map_err(|e| e.to_string())?;
        Ok(json!({
            "columns": [],
            "rows": [],
            "affected_rows": affected,
            "truncated": false,
            "pagination": null
        }))
    }
}

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
        Value::Timestamp(_, t) => json!(t), // Could format nicely
        Value::Text(v) => json!(v),
        Value::Blob(v) => json!(format!("Blob({} bytes)", v.len())),
        Value::Date32(v) => json!(v),
        Value::Time64(_, t) => json!(t),
        Value::Interval {
            months,
            days,
            nanos,
        } => json!(format!("Interval({}m, {}d, {}ns)", months, days, nanos)),
        Value::List(vals) => JsonValue::Array(vals.into_iter().map(duckdb_value_to_json).collect()),
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
                // JSON keys must be strings
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
