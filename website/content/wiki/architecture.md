---
title: "Technical Architecture"
order: 10
excerpt: "A deep dive into the Tabularis core: Tauri, Rust drivers, and the React frontend bridge."
---

# Technical Architecture

Tabularis represents a modern approach to desktop application development, moving away from resource-heavy Electron in favor of the **Tauri** framework. It bridges the performance and memory safety of **Rust** with the component-driven UI capabilities of **React**.

## The Tauri IPC Bridge

In Tabularis, the UI runs in a secure, isolated WebView, while all database connections, file I/O, and secure storage happen in the Rust backend. Communication between the two layers happens via Tauri's Asynchronous Inter-Process Communication (IPC) system, specifically through `invoke` commands.

```typescript
// Frontend (React)
const result = await invoke<QueryResponse>("execute_query", { 
    connectionId: "conn-123",
    query: "SELECT * FROM users"
});
```
```rust
// Backend (Rust)
#[tauri::command]
async fn execute_query(
    connection_id: String,
    query: String,
    state: tauri::State<'_, AppState>
) -> Result<QueryResponse, String> {
    // Rust handles the thread-safe connection pool and execution
}
```

## Core Rust Components

### 1. Unified Driver Trait
To support diverse database engines, Tabularis implements a strict trait (`DatabaseDriver`) in Rust. This ensures that the frontend React code does not need to know the specifics of PostgreSQL vs MySQL dialects when requesting schemas.
- **Native Drivers**: Built upon the `sqlx` crate, providing asynchronous, connection-pooled access to PostgreSQL, MySQL, and SQLite.
- **JSON-RPC Drivers**: For plugins, the Rust backend spawns child processes and implements the `DatabaseDriver` trait by proxying method calls to the plugin via stdin/stdout.

### 2. Connection State & Concurrency
The application state is managed using `tokio` and thread-safe data structures.
```rust
struct AppState {
    pools: Arc<DashMap<String, PoolType>>,
    tunnels: Arc<DashMap<String, SshTunnel>>,
}
```
Using `DashMap` prevents blocking the entire application when one connection is establishing a slow SSH tunnel, ensuring the UI remains perfectly fluid.

### 3. Asynchronous Streaming
When a query returns 100,000 rows, Tabularis doesn't attempt to send a massive 50MB JSON payload across the IPC bridge. Instead, the Rust backend serializes the results into chunks and streams them via Tauri events, populating the frontend Data Grid incrementally.

## Frontend Architecture

- **React 18 & Vite**: Fast HMR during development and optimized, minified builds for production.
- **Zustand**: Used for global state management (active tabs, theme, UI state). It provides a much lighter footprint than Redux.
- **Tailwind CSS & Vanilla CSS Variables**: The theming engine is built entirely on native CSS variables, allowing dynamic theme swapping without React re-renders.
- **Monaco & Web Workers**: The SQL Editor parsing logic is offloaded to Web Workers, preventing typing latency on the main UI thread.

## Security Model & Process Isolation
- **No `eval()`**: The UI operates under a strict Content Security Policy (CSP).
- **Plugin Sandbox**: External plugins run as separate OS processes. A memory leak or panic in a community plugin will crash the plugin process, but Tabularis will catch the EOF on stdout, display an error notification, and keep the main application running flawlessly.
