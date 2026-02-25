---
title: "Plugin System"
order: 8
excerpt: "Extend Tabularis with new database drivers using any programming language."
---

# Plugin System & Custom Drivers

While Tabularis supports major relational databases natively via Rust, the ecosystem of data stores is vast. The Plugin System allows anyone to add support for external databases (like DuckDB, ClickHouse, or Redis) using **any programming language**.

## The Architecture: JSON-RPC over STDIO

Tabularis avoids dynamic linking (`.so` or `.dll` files) for plugins, which can lead to version conflicts and security issues. Instead, plugins are **standalone executable binaries** or scripts.

When a user connects using a plugin driver, Tabularis:
1. Spawns the plugin as a child process.
2. Communicates by sending JSON-RPC 2.0 requests to the plugin's `stdin`.
3. Reads JSON-RPC responses from the plugin's `stdout`.

### Manifest File (`manifest.json`)
Every plugin must define its capabilities. This tells the Tabularis UI what buttons and fields to render.
```json
{
  "id": "tabularis-driver-duckdb",
  "name": "DuckDB",
  "version": "1.0.0",
  "executable": "node",
  "args": ["index.js"],
  "capabilities": {
    "schemas": false,
    "file_based": true,
    "identifier_quote": "\""
  }
}
```

## Protocol Specification

Your plugin runs a continuous read loop on `stdin`. When a request arrives, you process it and print the response to `stdout`.

### 1. Connection Request (`connect`)
**Tabularis sends:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "connect",
  "params": {
    "connection_string": "/path/to/local/db.duckdb"
  }
}
```
**Plugin replies:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { "status": "ok" }
}
```

### 2. Execute Query (`execute_query`)
**Tabularis sends:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "execute_query",
  "params": { "query": "SELECT name, age FROM users LIMIT 2" }
}
```
**Plugin replies:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "columns": ["name", "age"],
    "rows": [
      ["Alice", 28],
      ["Bob", 32]
    ],
    "execution_time_ms": 12
  }
}
```

### Mandatory Methods to Implement
To be a fully functional driver, your plugin must respond to:
- `connect`: Establish connection/open file.
- `disconnect`: Clean up resources.
- `execute_query`: Run arbitrary SQL.
- `get_tables`: Return list of tables.
- `get_columns`: Return schema for a specific table.

## Development & Debugging

Because `stdout` is reserved strictly for JSON-RPC communication, **do not use `console.log()` or `print()` for debugging**, as this will break the protocol parser in Tabularis.

**How to log:**
Send all your debug and error output to `stderr` (e.g., `console.error()`). Tabularis captures the `stderr` stream from all plugins and displays it in the **Plugin Console** inside the app, making development incredibly straightforward.

## Installation

Users can install your plugin instantly via the UI:
1. Open **Settings → Plugins**.
2. Click **Install from Directory** (point it to a local folder with a `manifest.json`).
3. The new database engine instantly appears in the "New Connection" dropdown. No restart required!
