# Writing a Custom Database Driver Plugin for Tabularis

Tabularis supports extending its capabilities via a JSON-RPC based external plugin system. By building a standalone executable that implements the JSON-RPC interface, you can add support for virtually any SQL or NoSQL database (such as DuckDB, MongoDB, etc.) using the programming language of your choice.

This guide details how to implement and register a custom external plugin.

---

## 1. Plugin Architecture

An external plugin in Tabularis is a separate executable (binary or script) that runs alongside the main application. Tabularis communicates with the plugin using **JSON-RPC 2.0** over standard input/output (`stdin` / `stdout`).

- **Requests:** Tabularis writes JSON-RPC request objects to the plugin's `stdin`, separated by a newline (`\n`).
- **Responses:** The plugin processes the request and writes a JSON-RPC response object to its `stdout`, followed by a newline (`\n`).
- **Logging:** Any output to `stderr` from the plugin is inherited/logged by Tabularis without interfering with the JSON-RPC communication.

### Lifecycle

1. Tabularis discovers plugins in its data folder at startup:
   - **Linux:** `~/.local/share/tabularis/plugins/`
   - **macOS:** `~/Library/Application Support/com.debba.tabularis/plugins/`
   - **Windows:** `%APPDATA%\com.debba.tabularis\plugins\`
2. It reads the `manifest.json` for each plugin to discover its capabilities and data types.
3. The plugin is registered as a driver and appears in the "Database Type" list.
4. When the user opens a connection using the plugin's driver, Tabularis spawns the executable and begins sending JSON-RPC messages.
5. The same process instance is reused for all operations in that session.

---

## 2. Directory Structure & `manifest.json`

A Tabularis plugin is distributed as a `.zip` file. When extracted into the plugins folder, it must have the following structure:

```text
plugins/
└── duckdb/
    ├── manifest.json
    └── duckdb-plugin  (or duckdb-plugin.exe on Windows)
```

### The `manifest.json`

The manifest tells Tabularis everything about your plugin.

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

### Manifest Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique driver identifier (lowercase, no spaces). Must match the folder name. |
| `name` | string | Display name shown in the UI (e.g., `"DuckDB"`). |
| `version` | string | Plugin version (semver). |
| `description` | string | Short description shown in the plugins list. |
| `default_port` | number \| null | Default TCP port. Use `null` for file-based databases. |
| `executable` | string | Relative path to the executable inside the plugin folder. |
| `capabilities` | object | Feature flags (see below). |
| `data_types` | array | List of supported data types (see below). |

### Capabilities

| Flag | Type | Description |
|------|------|-------------|
| `schemas` | bool | `true` if the database supports named schemas (like PostgreSQL). Controls whether the schema selector is shown in the UI. |
| `views` | bool | `true` if the database supports views. Enables the views section in the explorer. |
| `routines` | bool | `true` if the database supports stored procedures/functions. |
| `file_based` | bool | `true` for local file databases (e.g., SQLite, DuckDB). Replaces host/port with a file path input in the connection form. |
| `identifier_quote` | string | Character used to quote SQL identifiers. Use `"\""` for ANSI standard or `` "`" `` for MySQL style. |
| `alter_primary_key` | bool | `true` if the database supports altering primary keys after table creation. |

### Data Types

Each entry in `data_types` describes a type the driver supports for column creation in the UI:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | SQL type name (e.g., `"VARCHAR"`, `"BIGINT"`). |
| `category` | string | UI grouping category (see below). |
| `has_length` | bool | `true` if this type accepts a length/precision argument (e.g., `VARCHAR(255)`). |

**Type Categories:**

| Category | Examples |
|----------|----------|
| `numeric` | INTEGER, BIGINT, DECIMAL, FLOAT, DOUBLE |
| `string` | VARCHAR, TEXT, CHAR |
| `date` | DATE, TIME, TIMESTAMP, DATETIME |
| `binary` | BLOB, BYTEA, VARBINARY |
| `json` | JSON, JSONB |
| `spatial` | GEOMETRY, POINT, POLYGON |
| `other` | BOOLEAN, UUID |

---

## 3. Implementing the JSON-RPC Interface

Your plugin must run an event loop that:
1. Reads one JSON line from `stdin`.
2. Parses the JSON-RPC request.
3. Executes the requested database operation.
4. Writes a JSON-RPC response to `stdout` followed by `\n`.

### Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "get_tables",
  "params": {
    "params": {
      "driver": "duckdb",
      "host": null,
      "port": null,
      "database": "/path/to/my_database.duckdb",
      "username": null,
      "password": null,
      "ssl_mode": null
    },
    "schema": null
  },
  "id": 1
}
```

The `params.params` object is a `ConnectionParams` — the same values the user entered in the connection form. The top-level `params` may contain additional method-specific fields (e.g., `schema`, `table`, `column_name`, etc.).

### Successful Response

```json
{
  "jsonrpc": "2.0",
  "result": [
    { "name": "users", "schema": "main", "comment": null }
  ],
  "id": 1
}
```

### Error Response

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

**Standard JSON-RPC error codes:**

| Code | Meaning |
|------|---------|
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |

---

## 4. Required Methods

Your plugin must respond to the following JSON-RPC methods. For unsupported features, return an empty array `[]` or a `-32601` (Method not found) error.

### Connection

#### `test_connection`

Test whether a connection can be established.

**Params:** `{ "params": ConnectionParams }`

**Result:** `{ "success": true }` or an error response.

---

### Schema Discovery

#### `get_databases`

List available databases.

**Params:** `{ "params": ConnectionParams }`

**Result:** `["db1", "db2"]`

---

#### `get_schemas`

List schemas within the current database.

**Params:** `{ "params": ConnectionParams }`

**Result:** `["public", "private"]`

> Return `[]` if `capabilities.schemas` is `false`.

---

#### `get_tables`

List tables in a schema/database.

**Params:** `{ "params": ConnectionParams, "schema": string | null }`

**Result:**
```json
[
  { "name": "users", "schema": "public", "comment": "User accounts" }
]
```

---

#### `get_columns`

Get column information for a table.

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

#### `get_foreign_keys`

Get foreign key relationships for a table.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string }`

**Result:**
```json
[
  {
    "constraint_name": "fk_user_id",
    "column_name": "user_id",
    "referenced_table": "users",
    "referenced_column": "id",
    "on_update": "CASCADE",
    "on_delete": "SET NULL"
  }
]
```

---

#### `get_indexes`

Get indexes for a table.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string }`

**Result:**
```json
[
  {
    "index_name": "idx_email",
    "columns": ["email"],
    "is_unique": true,
    "is_primary": false
  }
]
```

---

### Views

#### `get_views`

List views in a schema/database.

**Params:** `{ "params": ConnectionParams, "schema": string | null }`

**Result:** `[{ "name": "active_users", "schema": "public" }]`

---

#### `get_view_definition`

Get the SQL definition of a view.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "view": string }`

**Result:** `"SELECT * FROM users WHERE active = true"`

---

#### `get_view_columns`

Get column information for a view.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "view": string }`

**Result:** Same structure as `get_columns`.

---

#### `create_view`

Create a new view.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "name": string, "definition": string }`

**Result:** `null` on success, or an error.

---

#### `alter_view`

Replace or modify an existing view.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "name": string, "definition": string }`

**Result:** `null` on success, or an error.

---

#### `drop_view`

Drop a view.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "name": string }`

**Result:** `null` on success, or an error.

---

### Routines

#### `get_routines`

List stored procedures and functions.

**Params:** `{ "params": ConnectionParams, "schema": string | null }`

**Result:**
```json
[
  { "name": "calculate_total", "routine_type": "FUNCTION", "schema": "public" }
]
```

---

#### `get_routine_parameters`

Get parameters of a stored routine.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "routine": string }`

**Result:**
```json
[
  { "name": "p_user_id", "data_type": "INTEGER", "mode": "IN" }
]
```

---

#### `get_routine_definition`

Get the SQL body of a stored routine.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "routine": string }`

**Result:** `"BEGIN ... END"`

---

### Query Execution

#### `execute_query`

Execute a SQL query and return results.

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
  "columns": ["id", "name", "email"],
  "rows": [
    [1, "Alice", "alice@example.com"]
  ],
  "total_count": 1,
  "execution_time_ms": 12
}
```

---

### CRUD Operations

#### `insert_record`

Insert a new row into a table.

**Params:**
```json
{
  "params": ConnectionParams,
  "schema": null,
  "table": "users",
  "data": { "name": "Bob", "email": "bob@example.com" }
}
```

**Result:** `null` on success, or an error.

---

#### `update_record`

Update a single field in a row.

**Params:**
```json
{
  "params": ConnectionParams,
  "schema": null,
  "table": "users",
  "primary_key_column": "id",
  "primary_key_value": "42",
  "column": "name",
  "value": "Robert"
}
```

**Result:** `null` on success, or an error.

---

#### `delete_record`

Delete a row from a table.

**Params:**
```json
{
  "params": ConnectionParams,
  "schema": null,
  "table": "users",
  "primary_key_column": "id",
  "primary_key_value": "42"
}
```

**Result:** `null` on success, or an error.

---

### Batch / ER Diagram Methods

These methods are used to build ER diagrams efficiently by loading all metadata in one call.

#### `get_schema_snapshot`

Return the complete schema structure (tables + columns + foreign keys).

**Params:** `{ "params": ConnectionParams, "schema": string | null }`

**Result:**
```json
{
  "tables": [{ "name": "users", "schema": "public", "comment": null }],
  "columns": { "users": [ /* column list */ ] },
  "foreign_keys": { "users": [ /* FK list */ ] }
}
```

---

#### `get_all_columns_batch`

Return columns for all tables at once.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "tables": ["users", "orders"] }`

**Result:** `{ "users": [ /* columns */ ], "orders": [ /* columns */ ] }`

---

#### `get_all_foreign_keys_batch`

Return foreign keys for all tables at once.

**Params:** `{ "params": ConnectionParams, "schema": string | null, "tables": ["users", "orders"] }`

**Result:** `{ "users": [ /* FKs */ ], "orders": [ /* FKs */ ] }`

---

### DDL Generation

These methods generate SQL statements. Tabularis may display the SQL to the user before executing it.

#### `get_create_table_sql`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string }`

**Result:** `"CREATE TABLE users (...)"`

---

#### `get_add_column_sql`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string, "column": ColumnDefinition }`

**Result:** `"ALTER TABLE users ADD COLUMN ..."`

---

#### `get_alter_column_sql`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string, "column": ColumnDefinition }`

**Result:** `"ALTER TABLE users MODIFY COLUMN ..."`

---

#### `get_create_index_sql`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string, "index": IndexDefinition }`

**Result:** `"CREATE INDEX idx_email ON users(email)"`

---

#### `get_create_foreign_key_sql`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string, "fk": ForeignKeyDefinition }`

**Result:** `"ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)"`

---

#### `drop_index`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string, "index_name": string }`

**Result:** `null` on success, or an error.

---

#### `drop_foreign_key`

**Params:** `{ "params": ConnectionParams, "schema": string | null, "table": string, "constraint_name": string }`

**Result:** `null` on success, or an error.

---

## 5. Example: Building a Minimal Plugin in Rust

Here is a minimal but functional skeleton for a plugin executable in Rust.

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

        let req: Value = serde_json::from_str(&line).unwrap_or_else(|_| {
            // Ignore unparseable lines
            return Value::Null;
        });

        if req.is_null() {
            continue;
        }

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

fn dispatch(method: &str, params: &Value, id: Value) -> Value {
    match method {
        "test_connection" => json!({
            "jsonrpc": "2.0",
            "result": { "success": true },
            "id": id
        }),

        "get_databases" => json!({
            "jsonrpc": "2.0",
            "result": ["my_database"],
            "id": id
        }),

        "get_schemas" => json!({
            "jsonrpc": "2.0",
            "result": [],
            "id": id
        }),

        "get_tables" => {
            // Connect to the database using params["params"]["database"], etc.
            json!({
                "jsonrpc": "2.0",
                "result": [
                    { "name": "example_table", "schema": null, "comment": null }
                ],
                "id": id
            })
        },

        "execute_query" => {
            let query = params["query"].as_str().unwrap_or("");
            // Execute query and return results
            json!({
                "jsonrpc": "2.0",
                "result": {
                    "columns": ["id", "name"],
                    "rows": [[1, "Alice"]],
                    "total_count": 1,
                    "execution_time_ms": 5
                },
                "id": id
            })
        },

        _ => json!({
            "jsonrpc": "2.0",
            "error": {
                "code": -32601,
                "message": format!("Method '{}' not implemented", method)
            },
            "id": id
        }),
    }
}
```

Add `serde_json` to your `Cargo.toml`:

```toml
[dependencies]
serde_json = "1"
```

---

## 6. Testing Your Plugin

### Manual Testing via Shell

You can test your plugin directly by piping JSON-RPC messages:

```bash
echo '{"jsonrpc":"2.0","method":"get_tables","params":{"params":{"driver":"duckdb","database":"/tmp/test.duckdb"},"schema":null},"id":1}' \
  | ./duckdb-plugin
```

You should see a valid JSON-RPC response on stdout.

### Installing Locally

1. Create the plugin directory in Tabularis's data folder:
   - **Linux:** `~/.local/share/tabularis/plugins/myplugin/`
   - **macOS:** `~/Library/Application Support/com.debba.tabularis/plugins/myplugin/`
   - **Windows:** `%APPDATA%\com.debba.tabularis\plugins\myplugin\`
2. Place your `manifest.json` and the compiled executable in that directory.
3. On Linux/macOS, make the executable runnable: `chmod +x myplugin`
4. Restart Tabularis (or install via Settings to hot-reload without restart).
5. Open **Settings → Installed Drivers** — your driver should appear.
6. Try creating a new connection using your driver from the connection form.

---

## 7. Publishing Your Plugin

To make your plugin available in the official registry:

1. Build release binaries for all supported platforms.
2. Package each platform binary with `manifest.json` into a `.zip` file.
3. Create a GitHub Release (or host on another URL) with the ZIP files.
4. Open a pull request to this repository adding your plugin entry to `plugins/registry.json`.

See [README.md](./README.md) for the full `registry.json` format.
