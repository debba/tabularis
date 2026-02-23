# Plugin Ecosystem Plan — Database Drivers

## Current State

Driver dispatch is hard-coded in `commands.rs` with repeated `match` blocks:

```rust
match driver {
    "mysql"    => mysql::get_tables(&params).await,
    "postgres" => postgres::get_tables(&params, schema).await,
    "sqlite"   => sqlite::get_tables(&params).await,
    _          => Err("Unsupported driver"),
}
```

This pattern repeats ~20 times. Adding a new driver requires touching `commands.rs`, `lib.rs`, and `pool_manager.rs`.

---

## Chosen Approach: Trait-based Registry (static, compile-time safe)

**Why not dynamic libraries (`.so`/`.dylib`):**
- Rust has no stable ABI — a plugin compiled with a different compiler version will crash
- Requires `unsafe` code and manual memory management
- Incompatible with the Tauri desktop model

**Chosen alternative:** each driver is a `struct` implementing a `DatabaseDriver` trait. A global registry tracks registered drivers. To add a custom driver, write a Rust crate implementing the trait and register it at startup.

---

## Files to Create (Rust Backend)

### 1. `src-tauri/src/drivers/driver_trait.rs`

Defines the core types and trait:

```rust
pub struct PluginManifest {
    pub id: String,                  // "mysql", "my-clickhouse-driver"
    pub name: String,                // "MySQL", "ClickHouse"
    pub version: String,             // semver string
    pub description: String,
    pub default_port: Option<u16>,
    pub capabilities: DriverCapabilities,
}

pub struct DriverCapabilities {
    pub schemas: bool,     // supports multiple schemas (e.g. PostgreSQL)
    pub views: bool,
    pub routines: bool,
    pub file_based: bool,  // e.g. SQLite
}

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    // --- Metadata ---
    fn manifest(&self) -> &PluginManifest;
    fn get_data_types(&self) -> Vec<DataTypeInfo>;
    fn build_connection_url(&self, params: &ConnectionParams) -> Result<String, String>;

    // --- Database discovery ---
    async fn get_databases(&self, params: &ConnectionParams) -> Result<Vec<String>, String>;
    async fn get_schemas(&self, params: &ConnectionParams) -> Result<Vec<String>, String>;

    // --- Schema inspection ---
    async fn get_tables(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<TableInfo>, String>;
    async fn get_columns(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<TableColumn>, String>;
    async fn get_foreign_keys(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<ForeignKey>, String>;
    async fn get_indexes(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<Index>, String>;

    // --- Views ---
    async fn get_views(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<ViewInfo>, String>;
    async fn get_view_definition(&self, params: &ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<String, String>;
    async fn get_view_columns(&self, params: &ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<Vec<TableColumn>, String>;
    async fn create_view(&self, params: &ConnectionParams, view_name: &str, definition: &str, schema: Option<&str>) -> Result<(), String>;
    async fn alter_view(&self, params: &ConnectionParams, view_name: &str, definition: &str, schema: Option<&str>) -> Result<(), String>;
    async fn drop_view(&self, params: &ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<(), String>;

    // --- Routines ---
    async fn get_routines(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<RoutineInfo>, String>;
    async fn get_routine_parameters(&self, params: &ConnectionParams, routine_name: &str, schema: Option<&str>) -> Result<Vec<RoutineParameter>, String>;
    async fn get_routine_definition(&self, params: &ConnectionParams, routine_name: &str, routine_type: &str, schema: Option<&str>) -> Result<String, String>;

    // --- Query execution ---
    async fn execute_query(&self, params: &ConnectionParams, query: &str, limit: u32, page: u32) -> Result<QueryResult, String>;

    // --- CRUD ---
    async fn insert_record(&self, params: &ConnectionParams, table: &str, data: serde_json::Value, schema: Option<&str>) -> Result<u64, String>;
    async fn update_record(&self, params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, schema: Option<&str>) -> Result<u64, String>;
    async fn delete_record(&self, params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, schema: Option<&str>) -> Result<u64, String>;

    // --- ER Diagram (batch for performance) ---
    async fn get_schema_snapshot(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<TableSchema>, String>;
}
```

> The `schema: Option<&str>` parameter is uniform across all methods. Each driver uses its own appropriate default when `None` is passed (e.g. PostgreSQL defaults to `"public"`, MySQL and SQLite ignore it).

---

### 2. `src-tauri/src/drivers/registry.rs`

```rust
static DRIVER_REGISTRY: Lazy<RwLock<HashMap<String, Arc<dyn DatabaseDriver>>>>

pub fn register_driver(driver: impl DatabaseDriver + 'static)
pub fn get_driver(id: &str) -> Option<Arc<dyn DatabaseDriver>>
pub fn list_drivers() -> Vec<PluginManifest>
```

Thread-safe via `tokio::sync::RwLock`. Built-in drivers are registered at app startup in `lib.rs`.

---

### 3. Built-in driver wrappers

Three new structs, one per driver module:

| File | Struct |
|------|--------|
| `src-tauri/src/drivers/mysql/mod.rs` | `pub struct MysqlDriver { manifest: PluginManifest }` |
| `src-tauri/src/drivers/postgres/mod.rs` | `pub struct PostgresDriver { manifest: PluginManifest }` |
| `src-tauri/src/drivers/sqlite/mod.rs` | `pub struct SqliteDriver { manifest: PluginManifest }` |

Each implements `DatabaseDriver` by delegating to the existing `pub async fn` functions already in the module. **No logic is duplicated** — the wrappers are thin adapters.

---

### 4. `src-tauri/src/lib.rs`

- Exposes the new modules: `driver_trait`, `registry`
- At app startup, before building the Tauri builder:

```rust
drivers::registry::register_driver(drivers::mysql::MysqlDriver::new());
drivers::registry::register_driver(drivers::postgres::PostgresDriver::new());
drivers::registry::register_driver(drivers::sqlite::SqliteDriver::new());
```

---

### 5. `src-tauri/src/commands.rs`

Every `match driver { ... }` block is replaced with:

```rust
let driver = registry::get_driver(&saved_conn.params.driver)
    .ok_or_else(|| format!("Unsupported driver: {}", saved_conn.params.driver))?;

driver.get_tables(&params, schema.as_deref()).await
```

New Tauri command added:

```rust
#[tauri::command]
pub fn get_registered_drivers() -> Vec<PluginManifest> {
    registry::list_drivers()
}
```

Registered in `lib.rs` inside `invoke_handler![]`.

---

## Files to Modify (TypeScript Frontend)

### 6. `src/utils/connections.ts`

```typescript
// Before (closed union type):
export type DatabaseDriver = "postgres" | "mysql" | "sqlite";

// After (open, backward compatible):
export type DatabaseDriver = string;

// Keep constant helpers for built-in drivers:
export const BUILTIN_DRIVERS = ["postgres", "mysql", "sqlite"] as const;
export type BuiltinDriver = (typeof BUILTIN_DRIVERS)[number];
```

`getDefaultPort`, `getDriverLabel`, and `validateConnectionParams` continue to work — their `default` cases already return a generic value.

---

### 7. `src/types/plugins.ts` (new file)

```typescript
export interface DriverCapabilities {
  schemas: boolean;
  views: boolean;
  routines: boolean;
  file_based: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  default_port: number | null;
  capabilities: DriverCapabilities;
}
```

---

### 8. `src/hooks/useDrivers.ts` (new file)

```typescript
export function useDrivers(): {
  drivers: PluginManifest[];
  loading: boolean;
  error: string | null;
}
// Calls invoke("get_registered_drivers") → PluginManifest[]
// Result drives the driver selection UI in NewConnectionModal
```

---

### 9. `src/components/ui/NewConnectionModal.tsx`

The local `type Driver = "postgres" | "mysql" | "sqlite"` is removed. The driver list is loaded dynamically via `useDrivers()`. While loading, a fallback to the three built-in drivers is shown.

---

## How to Add a Custom Driver (end result)

An external contributor will need to:

1. Create a separate Rust crate with a dependency on `tabularis_lib`
2. Define a `struct MyDriver` and implement `DatabaseDriver`
3. In `lib.rs`, add one line:
   ```rust
   registry::register_driver(my_crate::MyDriver::new());
   ```
4. The frontend automatically shows the new driver in the connection form

---

## What Does NOT Change

| Area | Status |
|------|--------|
| SQL logic inside existing driver modules | Unchanged |
| `pool_manager.rs` | Unchanged (built-in drivers continue using it internally) |
| `models.rs` data structures | Unchanged |
| Existing tests | Continue to compile |

---

## Implementation Order

1. `driver_trait.rs` — defines the contract
2. `registry.rs` — infrastructure
3. `MysqlDriver`, `PostgresDriver`, `SqliteDriver` wrappers
4. `lib.rs` update (driver registration)
5. `commands.rs` update (dispatch via registry + new `get_registered_drivers` command)
6. Frontend: `plugins.ts`, `useDrivers.ts`, `connections.ts`, `NewConnectionModal.tsx`
7. `drivers/README.md` update
