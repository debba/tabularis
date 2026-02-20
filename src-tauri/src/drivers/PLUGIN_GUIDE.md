# Writing a Custom Database Driver Plugin for Tabularis

Tabularis supports extending its capabilities via a JSON-RPC based external plugin system. By building a standalone executable that implements the JSON-RPC interface, you can add support for virtually any SQL or NoSQL database (such as DuckDB, MongoDB, etc.) using the programming language of your choice.

This guide details how to implement and register a custom external plugin.

## 1. Plugin Architecture

An external plugin in Tabularis is a separate executable (binary or script) that runs alongside the main application. Tabularis communicates with the plugin using **JSON-RPC 2.0** over standard input/output (`stdin` / `stdout`).

- **Requests:** Tabularis writes JSON-RPC request objects to the plugin's `stdin`, separated by a newline (`\n`).
- **Responses:** The plugin processes the request and writes a JSON-RPC response object to its `stdout`, followed by a newline (`\n`).
- **Logging:** Any output to `stderr` from the plugin is inherited or logged by Tabularis without interfering with the JSON-RPC communication.

### Lifecycle
1. Tabularis discovers plugins in its configuration folder (`~/.config/tabularis/plugins/` on Linux, `%APPDATA%\tabularis\plugins\` on Windows, `~/Library/Application Support/com.debba.tabularis/plugins/` on macOS).
2. It reads the `manifest.json` for each plugin to discover its capabilities.
3. When the user interacts with the database, Tabularis spawns the plugin executable and sends RPC messages.

---

## 2. Directory Structure & `manifest.json`

A Tabularis plugin is distributed as a `.zip` file containing a specific directory structure. When extracted into the `plugins` folder, it must look like this:

```text
plugins/
└── duckdb-plugin/
    ├── manifest.json
    └── duckdb-plugin-executable (or .exe / script)
```

### The `manifest.json`

The manifest tells Tabularis about your plugin, including which executable to launch.

```json
{
  "id": "duckdb",
  "name": "DuckDB",
  "version": "1.0.0",
  "description": "DuckDB file-based analytical database",
  "default_port": null,
  "executable": "duckdb-plugin-executable",
  "capabilities": {
    "schemas": false,
    "views": true,
    "routines": false,
    "file_based": true
  },
  "data_types": [
    {
      "name": "INTEGER",
      "category": "numeric",
      "has_length": false
    },
    {
      "name": "VARCHAR",
      "category": "string",
      "has_length": true
    }
  ]
}
```

- `id`: Unique identifier for the driver (e.g., `duckdb`).
- `executable`: The relative path to the executable file inside the plugin folder.
- `capabilities`: 
  - `schemas`: Set to `true` if the database uses schemas (like PostgreSQL).
  - `file_based`: Set to `true` if it's a local file database (like SQLite or DuckDB) requiring no host/port.

---

## 3. Implementing the JSON-RPC Interface

Your plugin must continuously read from `stdin`, parse the JSON-RPC request, execute the requested database operation, and write the response to `stdout`.

### JSON-RPC Communication Example

**Request from Tabularis:**

```json
{
  "jsonrpc": "2.0",
  "method": "get_tables",
  "params": {
    "params": {
      "driver": "duckdb",
      "database": "/path/to/my_database.duckdb"
    },
    "schema": null
  },
  "id": 1
}
```

**Successful Response from Plugin:**

```json
{
  "jsonrpc": "2.0",
  "result": [
    {
      "name": "users",
      "schema": "main",
      "comment": null
    }
  ],
  "id": 1
}
```

**Error Response from Plugin:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Database file not found or inaccessible."
  },
  "id": 1
}
```

---

## 4. Required Methods

Your plugin must respond to the following JSON-RPC methods (matching the `DatabaseDriver` trait in Tabularis):

- `get_databases`
- `get_schemas`
- `get_tables`
- `get_columns`
- `get_foreign_keys`
- `get_indexes`
- `get_views`
- `get_view_definition`
- `get_view_columns`
- `create_view`
- `alter_view`
- `drop_view`
- `get_routines`
- `get_routine_parameters`
- `get_routine_definition`
- `execute_query`
- `insert_record`
- `update_record`
- `delete_record`
- `get_schema_snapshot`
- `get_all_columns_batch`
- `get_all_foreign_keys_batch`

> **Note:** If your database doesn't support a feature (e.g., routines or views), you can return an empty array `[]` or a standard JSON-RPC error.

---

## 5. Example: Building a Minimal Plugin in Rust

Here is a minimal example of how a plugin executable might look in Rust.

```rust
use std::io::{self, BufRead, Write};
use serde_json::{json, Value};

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }

        // Parse Request
        let req: Value = serde_json::from_str(&line).unwrap();
        let id = req["id"].clone();
        let method = req["method"].as_str().unwrap();

        // Process Method
        let response = match method {
            "get_tables" => {
                json!({
                    "jsonrpc": "2.0",
                    "result": [
                        { "name": "mock_table", "schema": "public", "comment": null }
                    ],
                    "id": id
                })
            },
            _ => {
                json!({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32601,
                        "message": format!("Method '{}' not implemented", method)
                    },
                    "id": id
                })
            }
        };

        // Send Response
        let mut res_str = serde_json::to_string(&response).unwrap();
        res_str.push('\n');
        stdout.write_all(res_str.as_bytes()).unwrap();
        stdout.flush().unwrap();
    }
}
```

---

## 6. Testing Your Plugin

To test your plugin during development:
1. Manually create the directory structure in Tabularis's config plugins folder.
   - Linux: `~/.local/share/tabularis/plugins/mydriver/` (or `~/.config/tabularis/plugins/`)
   - macOS: `~/Library/Application Support/com.debba.tabularis/plugins/mydriver/`
   - Windows: `C:\Users\<User>\AppData\Roaming\com.debba.tabularis\plugins\mydriver\`
2. Place your `manifest.json` and the executable there.
3. Restart Tabularis.
4. Go to **Settings > Plugins** (if implemented in UI) or try creating a new Connection; your driver should appear in the "Database Type" list.
