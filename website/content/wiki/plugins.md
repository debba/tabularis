---
title: "Plugin System"
order: 8
excerpt: "Extend Tabularis with new database drivers using any programming language."
---

# Plugin System & Custom Drivers

While Tabularis supports major relational databases natively via Rust, the ecosystem of data stores is vast. The Plugin System allows anyone to add support for external databases (like DuckDB, ClickHouse, or Redis) using **any programming language**.

For the complete protocol reference, see [`plugins/PLUGIN_GUIDE.md`](https://github.com/debba/tabularis/blob/main/plugins/PLUGIN_GUIDE.md) in the repository.

## Architecture: JSON-RPC over STDIO

Tabularis avoids dynamic linking (`.so` or `.dll` files) for plugins, which can cause version conflicts and security issues. Instead, plugins are **standalone executables** — a binary or a script — that run as child processes.

When a user opens a connection using a plugin driver, Tabularis:

1. Spawns the plugin executable as a child process.
2. Sends **JSON-RPC 2.0** request objects to the plugin's `stdin`, one per line.
3. Reads **JSON-RPC 2.0** response objects from the plugin's `stdout`, one per line.
4. Reuses the same process instance for the entire session.

Any output written to `stderr` is captured by Tabularis and shown in the log viewer — safe to use for debugging without breaking the protocol.

## Directory Structure

A plugin is distributed as a `.zip` file. When extracted into the Tabularis plugins folder, it must follow this layout:

```text
plugins/
└── duckdb/
    ├── manifest.json
    └── duckdb-plugin        (or duckdb-plugin.exe on Windows)
```

**Plugin folder locations:**

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/tabularis/plugins/` |
| macOS | `~/Library/Application Support/com.debba.tabularis/plugins/` |
| Windows | `%APPDATA%\com.debba.tabularis\plugins\` |

## The `manifest.json`

Every plugin must include a `manifest.json` that tells Tabularis its capabilities and the data types it supports.

```json
{
  "id": "duckdb",
  "name": "DuckDB",
  "version": "1.0.0",
  "description": "DuckDB file-based analytical database",
  "default_port": null,
  "executable": "duckdb-plugin",
  "capabilities": {
    "schemas": false,
    "views": true,
    "routines": false,
    "file_based": true,
    "identifier_quote": "\"",
    "alter_primary_key": false
  },
  "data_types": [
    { "name": "INTEGER",  "category": "numeric", "has_length": false },
    { "name": "VARCHAR",  "category": "string",  "has_length": true  },
    { "name": "BOOLEAN",  "category": "other",   "has_length": false },
    { "name": "TIMESTAMP","category": "date",    "has_length": false }
  ]
}
```

### Capabilities

| Flag | Type | Description |
|------|------|-------------|
| `schemas` | bool | `true` if the database supports named schemas (e.g. PostgreSQL). Shows the schema selector in the UI. |
| `views` | bool | `true` to enable the Views section in the explorer. |
| `routines` | bool | `true` to enable stored procedures/functions in the explorer. |
| `file_based` | bool | `true` for local file databases (e.g. SQLite, DuckDB). Replaces host/port with a file path field. |
| `identifier_quote` | string | Character used to quote SQL identifiers: `"\""` (ANSI) or `` "`" `` (MySQL). |
| `alter_primary_key` | bool | `true` if the database supports altering primary keys after table creation. |

### Data Type Categories

| Category | Examples |
|----------|----------|
| `numeric` | INTEGER, BIGINT, DECIMAL, FLOAT |
| `string` | VARCHAR, TEXT, CHAR |
| `date` | DATE, TIME, TIMESTAMP |
| `binary` | BLOB, BYTEA |
| `json` | JSON, JSONB |
| `spatial` | GEOMETRY, POINT |
| `other` | BOOLEAN, UUID |

## Protocol Specification

Your plugin runs a continuous read loop on `stdin`. For each line received, parse the JSON-RPC request, execute the operation, and write a JSON-RPC response to `stdout` followed by `\n`.

### Request format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "get_tables",
  "params": {
    "params": {
      "driver": "duckdb",
      "host": null,
      "port": null,
      "database": "/path/to/my.duckdb",
      "username": null,
      "password": null,
      "ssl_mode": null
    },
    "schema": null
  }
}
```

The `params.params` object (a `ConnectionParams`) contains the values the user entered in the connection form. Additional fields at the top level of `params` are method-specific (e.g. `schema`, `table`, `query`).

### Successful response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    { "name": "users", "schema": "main", "comment": null }
  ]
}
```

### Error response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Database file not found."
  }
}
```

**Standard error codes:**

| Code | Meaning |
|------|---------|
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |

## Required Methods

Your plugin must implement at minimum the following methods. For unimplemented optional methods, return an empty array `[]` or a `-32601` error.

### `test_connection`

Verify that a connection can be established.

**Params:** `{ "params": ConnectionParams }`

**Result:** `{ "success": true }` or an error response.

---

### `get_databases`

List available databases.

**Params:** `{ "params": ConnectionParams }`

**Result:** `["db1", "db2"]`

---

### `get_tables`

List tables in a schema/database.

**Params:** `{ "params": ConnectionParams, "schema": string | null }`

**Result:**
```json
[{ "name": "users", "schema": "main", "comment": null }]
```

---

### `get_columns`

Get column metadata for a table.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string }`

**Result:**
```json
[
  {
    "name": "id",
    "data_type": "INTEGER",
    "is_nullable": false,
    "column_default": null,
    "is_primary_key": true,
    "is_auto_increment": true,
    "comment": null
  }
]
```

---

### `execute_query`

Execute a SQL query and return paginated results.

**Params:**
```json
{
  "params": ConnectionParams,
  "query": "SELECT * FROM users",
  "page": 1,
  "page_size": 100
}
```

**Result:**
```json
{
  "columns": ["id", "name"],
  "rows": [[1, "Alice"]],
  "total_count": 1,
  "execution_time_ms": 5
}
```

For the full list of methods (CRUD, DDL, views, routines, batch/ER diagram methods), see the [complete plugin guide](https://github.com/debba/tabularis/blob/main/plugins/PLUGIN_GUIDE.md).

## Minimal Skeleton (Rust)

```rust
use std::io::{self, BufRead, Write};
use serde_json::{json, Value};

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = line.unwrap();
        if line.trim().is_empty() { continue; }

        let req: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let id = req["id"].clone();
        let method = req["method"].as_str().unwrap_or("");
        let params = &req["params"];
        let response = dispatch(method, params, id);

        let mut res_str = serde_json::to_string(&response).unwrap();
        res_str.push('\n');
        stdout.write_all(res_str.as_bytes()).unwrap();
        stdout.flush().unwrap();
    }
}

fn dispatch(method: &str, _params: &Value, id: Value) -> Value {
    match method {
        "test_connection" => json!({
            "jsonrpc": "2.0", "result": { "success": true }, "id": id
        }),
        "get_databases" => json!({
            "jsonrpc": "2.0", "result": ["my_database"], "id": id
        }),
        "get_tables" => json!({
            "jsonrpc": "2.0",
            "result": [{ "name": "example", "schema": null, "comment": null }],
            "id": id
        }),
        "execute_query" => json!({
            "jsonrpc": "2.0",
            "result": {
                "columns": ["id"], "rows": [[1]],
                "total_count": 1, "execution_time_ms": 1
            },
            "id": id
        }),
        _ => json!({
            "jsonrpc": "2.0",
            "error": { "code": -32601, "message": format!("Method '{}' not implemented", method) },
            "id": id
        }),
    }
}
```

## Testing Your Plugin

You can test your plugin directly from the shell before installing it in Tabularis:

```bash
echo '{"jsonrpc":"2.0","method":"test_connection","params":{"params":{"driver":"duckdb","database":"/tmp/test.duckdb","host":null,"port":null,"username":null,"password":null,"ssl_mode":null}},"id":1}' \
  | ./duckdb-plugin
```

You should see a valid JSON-RPC response on `stdout`.

## Installing Locally

1. Create the plugin directory inside the Tabularis plugins folder:
   ```
   ~/.local/share/tabularis/plugins/myplugin/   (Linux)
   ```
2. Place your `manifest.json` and the compiled executable there.
3. On Linux/macOS, make it executable: `chmod +x myplugin`
4. Open Tabularis **Settings → Available Plugins** and install it — no restart required.

## Publishing to the Registry

To make your plugin available in the official in-app plugin browser:

1. Build release binaries for all target platforms.
2. Package each binary with `manifest.json` into a `.zip` file.
3. Publish a GitHub Release with the ZIP assets.
4. Open a pull request adding your entry to [`plugins/registry.json`](https://github.com/debba/tabularis/blob/main/plugins/registry.json).
