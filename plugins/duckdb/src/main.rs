use duckdb::{types::Value, Connection, Result};
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
            .unwrap_or(":memory:")
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

        match method {
            "test_connection" => {
                send_success(&mut stdout, id, json!(true));
            }
            "get_databases" => {
                send_success(&mut stdout, id, json!(["main"]));
            }
            "get_schemas" => {
                send_success(&mut stdout, id, json!(["main"]));
            }
            "get_tables" => match get_tables(conn) {
                Ok(tables) => send_success(&mut stdout, id, tables),
                Err(e) => send_error(&mut stdout, id, -32001, &e),
            },
            "get_columns" => {
                let table_name = params.get("table").and_then(|t| t.as_str()).unwrap_or("");
                match get_columns(conn, table_name) {
                    Ok(cols) => send_success(&mut stdout, id, cols),
                    Err(e) => send_error(&mut stdout, id, -32002, &e),
                }
            }
            "execute_query" => {
                let query = params.get("query").and_then(|q| q.as_str()).unwrap_or("");
                match execute_query(conn, query) {
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
    let mut stmt = conn.prepare(
        "SELECT table_name, 'main' AS schema_name, '' AS comment \
         FROM information_schema.tables \
         WHERE table_schema = 'main' AND table_type = 'BASE TABLE' \
         ORDER BY table_name",
    )
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

fn get_primary_keys(conn: &Connection, table_name: &str) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    let Ok(mut stmt) = conn.prepare(
        "SELECT unnest(constraint_column_names) AS column_name \
         FROM duckdb_constraints() \
         WHERE table_name = ? AND constraint_type = 'PRIMARY KEY' AND schema_name = 'main'",
    ) else {
        return set;
    };
    let Ok(iter) = stmt.query_map([table_name], |row| row.get::<_, String>(0)) else {
        return set;
    };
    for col in iter.flatten() {
        set.insert(col);
    }
    set
}

fn get_columns(conn: &Connection, table_name: &str) -> Result<JsonValue, String> {
    let pk_cols = get_primary_keys(conn, table_name);

    let mut stmt = conn
        .prepare(
            "SELECT column_name, data_type, is_nullable, column_default \
             FROM information_schema.columns \
             WHERE table_name = ? AND table_schema = 'main' \
             ORDER BY ordinal_position",
        )
        .map_err(|e| e.to_string())?;

    let col_iter = stmt
        .query_map([table_name], |row| {
            let col_name: String = row.get(0)?;
            let is_nullable: String = row.get(2)?;
            Ok((
                col_name,
                row.get::<_, String>(1)?,
                is_nullable,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for c in col_iter {
        let (col_name, data_type, is_nullable, default_value) =
            c.map_err(|e| e.to_string())?;
        let is_primary = pk_cols.contains(&col_name);
        columns.push(json!({
            "name": col_name,
            "data_type": data_type,
            "is_nullable": is_nullable == "YES",
            "default_value": default_value,
            "is_primary": is_primary,
        }));
    }

    Ok(json!(columns))
}

fn execute_query(conn: &Connection, query: &str) -> Result<JsonValue, String> {
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    if stmt.column_count() > 0 {
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
        let affected = stmt.execute([]).map_err(|e| e.to_string())?;
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
