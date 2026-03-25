---
title: "Plugin System"
order: 8
excerpt: "Extend Tabularis with new database drivers using any programming language."
category: "AI & Integration"
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
    { "name": "INTEGER",  "category": "numeric", "requires_length": false, "requires_precision": false },
    { "name": "VARCHAR",  "category": "string",  "requires_length": true,  "requires_precision": false },
    { "name": "BOOLEAN",  "category": "other",   "requires_length": false, "requires_precision": false },
    { "name": "TIMESTAMP","category": "date",    "requires_length": false, "requires_precision": false }
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
| `alter_column` | bool | `true` to enable ALTER TABLE MODIFY COLUMN operations in the schema editor. |
| `create_foreign_keys` | bool | `true` to enable FK constraint creation in the schema editor. |
| `folder_based` | bool | `true` for databases that target a folder rather than a file or host (e.g., CSV plugin). Replaces host/port with a folder picker. |
| `no_connection_required` | bool | `true` for API-based plugins that need no host, port, or credentials (e.g. a public REST API). Hides the entire connection form — the user only fills in the connection name. |
| `connection_string` | bool | Set `false` to hide the connection string import UI for this driver. Defaults to `true` for network drivers; automatically skipped for `file_based` and `folder_based` drivers. |
| `connection_string_example` | string | Optional placeholder example shown in the connection string import field (e.g. `"clickhouse://user:pass@localhost:9000/db"`). |
| `manage_tables` | bool | `true` to enable table and column management UI (Create Table, Add/Modify/Drop Column, Drop Table). Does not control index or FK operations. Defaults to `true`. |
| `readonly` | bool | When `true`, the driver is read-only: all data modification operations (INSERT, UPDATE, DELETE) are disabled in the UI. Table and column management is also hidden regardless of `manage_tables`. Defaults to `false`. |

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

## Plugin Settings

Plugins can declare custom configuration fields in their `manifest.json`. Tabularis renders these fields in **Settings → gear icon** next to the plugin. Users fill them in, the values are persisted in `config.json`, and Tabularis delivers them to the plugin at startup.

### Declaring settings in `manifest.json`

Add an optional `settings` array to your manifest:

```json
{
  "id": "my-plugin",
  "settings": [
    {
      "key": "api_key",
      "label": "API Key",
      "type": "string",
      "required": true,
      "description": "Your API key for authentication."
    },
    {
      "key": "region",
      "label": "Region",
      "type": "select",
      "options": ["us-east-1", "eu-west-1"],
      "default": "us-east-1"
    },
    {
      "key": "max_connections",
      "label": "Max Connections",
      "type": "number",
      "default": 10
    },
    {
      "key": "ssl",
      "label": "Enable SSL",
      "type": "boolean",
      "default": true
    }
  ]
}
```

Supported setting types: `"string"`, `"boolean"`, `"number"`, `"select"`.

### The `initialize` call

After spawning the plugin process, Tabularis immediately sends an `initialize` JSON-RPC call with the user's saved settings:

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": { "settings": { "api_key": "abc", "region": "eu-west-1" } },
  "id": 1
}
```

Returning an error from `initialize` is safe — Tabularis ignores it silently. Plugins that do not implement `initialize` are completely unaffected.

For the full developer reference (field schema, code examples in Rust and Python), see the [Plugin Guide](https://github.com/debba/tabularis/blob/main/plugins/PLUGIN_GUIDE.md).

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

## Using a Custom Plugin Registry

By default, Tabularis fetches the plugin list from the official registry. You can point the app to a different registry (e.g., a self-hosted or company-internal one) by setting `customRegistryUrl` in your `config.json`:

```json
{
  "customRegistryUrl": "https://example.com/my-registry.json"
}
```

The custom registry must expose a JSON file that follows the same schema as the [official registry](https://github.com/debba/tabularis/blob/main/plugins/registry.json). When this key is set, both the plugin browser and the install command will use your URL instead of the default one.

## UI Extensions (Phase 2)

Starting with v0.9.15, plugins can inject custom React components into the Tabularis UI through a **slot-based extension system**. This allows plugins to add buttons, fields, previews, and menu items directly into the interface without modifying host code.

### How It Works

The system has three layers:

1. **SlotAnchor** — Host components placed at predefined insertion points that determine WHERE extensions render.
2. **PluginSlotRegistry** — A React context that stores registered contributions and determines WHAT gets rendered.
3. **Plugin Modules** — JavaScript/TypeScript code that registers components during plugin activation.

### Available Slots

Eight insertion points are available:

| Slot Name | Location | Renders Per |
|-----------|----------|-------------|
| `row-edit-modal.field.after` | After each field in New Row modal | Each column |
| `row-edit-modal.footer.before` | Before Save/Cancel buttons | Once per modal |
| `row-editor-sidebar.field.after` | After each field in Row Editor sidebar | Each column |
| `row-editor-sidebar.header.actions` | Sidebar header action area | Once per sidebar |
| `data-grid.toolbar.actions` | Table toolbar (after LIMIT) | Once per table view |
| `data-grid.context-menu.items` | Right-click context menu on grid rows | Each menu open |
| `sidebar.footer.actions` | Main sidebar footer area | Once (global) |
| `settings.plugin.actions` | Per-plugin actions in Settings | Each installed plugin |

### Declaring UI Extensions in the Manifest

Add an optional `ui_extensions` array to your `manifest.json`:

```json
{
  "id": "postgis-toolkit",
  "name": "PostGIS Toolkit",
  "version": "1.0.0",
  "ui_extensions": [
    {
      "slot": "row-editor-sidebar.field.after",
      "module": "./ui/GeometryPreview.tsx",
      "order": 50
    },
    {
      "slot": "data-grid.toolbar.actions",
      "module": "./ui/MapViewButton.tsx",
      "order": 80
    }
  ]
}
```

### Plugin API

Slot components can import hooks from `@tabularis/plugin-api`:

| Hook | Purpose |
|------|---------|
| `usePluginQuery()` | Execute read-only queries on the active connection |
| `usePluginConnection()` | Access active connection metadata (ID, driver, schema) |
| `usePluginToast()` | Show info/error/warning notification dialogs |
| `usePluginSetting(pluginId)` | Read and write plugin-specific settings |
| `usePluginTheme()` | Access theme information (dark/light, colors) |

### Error Isolation

Each slot contribution is wrapped in a `SlotErrorBoundary`. A crashing plugin component displays a compact error message without affecting the host application or other plugins.

### Backward Compatibility

The `ui_extensions` field is optional. Plugins without it continue to work identically. The slot anchors render nothing when no contributions are registered — zero overhead.

### Built-in Example: JSON Viewer

Tabularis ships with a built-in **JSON Viewer** plugin that demonstrates the slot system. It renders a formatted, collapsible JSON tree with syntax highlighting for JSON/JSONB columns in the row editor.

**Slots used:** `row-editor-sidebar.field.after`, `row-edit-modal.field.after`

Features:
- Auto-detects JSON columns by name (contains "json") or by parsing the value
- Syntax-highlighted tokens: strings (green), numbers (blue), booleans (yellow), null (red), keys (purple)
- Collapsible objects and arrays with auto-expand for the first 2 depth levels
- Copy-to-clipboard button for the formatted JSON

Source code: [`src/plugins/examples/json-viewer/`](https://github.com/debba/tabularis/tree/main/src/plugins/examples/json-viewer)

For the full specification, see the [Plugin UI Extensions Spec](/docs/plugin-ui-extensions-spec.md).

## Publishing to the Registry

To make your plugin available in the official in-app plugin browser:

1. Build release binaries for all target platforms.
2. Package each binary with `manifest.json` into a `.zip` file.
3. Publish a GitHub Release with the ZIP assets.
4. Open a pull request adding your entry to [`plugins/registry.json`](https://github.com/debba/tabularis/blob/main/plugins/registry.json).
