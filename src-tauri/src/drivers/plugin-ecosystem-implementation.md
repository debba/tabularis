# Plugin Ecosystem — Full Implementation

## Overview

This document contains the complete code for every file that needs to be created or modified
to transform the current hard-coded driver dispatch into an open plugin registry.

**Dependencies already present in `Cargo.toml`:**
- `async-trait = "0.1"` ✓
- `once_cell = "1.20"` ✓
- `tokio` with `full` features ✓

---

## 1. `src-tauri/src/drivers/driver_trait.rs` — New file

```rust
use std::collections::HashMap;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::models::{
    ConnectionParams, DataTypeInfo, ForeignKey, Index, QueryResult, RoutineInfo,
    RoutineParameter, TableColumn, TableInfo, TableSchema, ViewInfo,
};

/// Capabilities advertised by a driver.
/// The frontend uses these flags to decide which UI sections to show.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DriverCapabilities {
    /// Supports multiple named schemas (e.g. PostgreSQL).
    pub schemas: bool,
    /// Supports views.
    pub views: bool,
    /// Supports stored procedures and functions.
    pub routines: bool,
    /// File-based database (e.g. SQLite); no host/port required.
    pub file_based: bool,
}

/// Metadata describing a registered driver plugin.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginManifest {
    /// Unique identifier used in `ConnectionParams.driver` (e.g. `"mysql"`).
    pub id: String,
    /// Human-readable name shown in the UI (e.g. `"MySQL"`).
    pub name: String,
    /// Semver string of this driver implementation (e.g. `"1.0.0"`).
    pub version: String,
    /// Short description shown in the UI.
    pub description: String,
    /// Default TCP port, `None` for file-based drivers.
    pub default_port: Option<u16>,
    pub capabilities: DriverCapabilities,
}

/// The complete interface every database driver plugin must implement.
///
/// The `schema` parameter is `Option<&str>` throughout. Drivers that do not
/// use schemas (MySQL, SQLite) simply ignore it. Drivers that do (PostgreSQL)
/// fall back to `"public"` when it is `None`.
#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    // --- Metadata -----------------------------------------------------------

    fn manifest(&self) -> &PluginManifest;

    /// Returns the list of data types supported by this driver.
    fn get_data_types(&self) -> Vec<DataTypeInfo>;

    /// Builds the connection URL string for this driver.
    fn build_connection_url(&self, params: &ConnectionParams) -> Result<String, String>;

    // --- Database / schema discovery ----------------------------------------

    async fn get_databases(&self, params: &ConnectionParams) -> Result<Vec<String>, String>;
    async fn get_schemas(&self, params: &ConnectionParams) -> Result<Vec<String>, String>;

    // --- Schema inspection ---------------------------------------------------

    async fn get_tables(
        &self,
        params: &ConnectionParams,
        schema: Option<&str>,
    ) -> Result<Vec<TableInfo>, String>;

    async fn get_columns(
        &self,
        params: &ConnectionParams,
        table: &str,
        schema: Option<&str>,
    ) -> Result<Vec<TableColumn>, String>;

    async fn get_foreign_keys(
        &self,
        params: &ConnectionParams,
        table: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ForeignKey>, String>;

    async fn get_indexes(
        &self,
        params: &ConnectionParams,
        table: &str,
        schema: Option<&str>,
    ) -> Result<Vec<Index>, String>;

    // --- Views --------------------------------------------------------------

    async fn get_views(
        &self,
        params: &ConnectionParams,
        schema: Option<&str>,
    ) -> Result<Vec<ViewInfo>, String>;

    async fn get_view_definition(
        &self,
        params: &ConnectionParams,
        view_name: &str,
        schema: Option<&str>,
    ) -> Result<String, String>;

    async fn get_view_columns(
        &self,
        params: &ConnectionParams,
        view_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<TableColumn>, String>;

    async fn create_view(
        &self,
        params: &ConnectionParams,
        view_name: &str,
        definition: &str,
        schema: Option<&str>,
    ) -> Result<(), String>;

    async fn alter_view(
        &self,
        params: &ConnectionParams,
        view_name: &str,
        definition: &str,
        schema: Option<&str>,
    ) -> Result<(), String>;

    async fn drop_view(
        &self,
        params: &ConnectionParams,
        view_name: &str,
        schema: Option<&str>,
    ) -> Result<(), String>;

    // --- Routines -----------------------------------------------------------

    async fn get_routines(
        &self,
        params: &ConnectionParams,
        schema: Option<&str>,
    ) -> Result<Vec<RoutineInfo>, String>;

    async fn get_routine_parameters(
        &self,
        params: &ConnectionParams,
        routine_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<RoutineParameter>, String>;

    async fn get_routine_definition(
        &self,
        params: &ConnectionParams,
        routine_name: &str,
        routine_type: &str,
        schema: Option<&str>,
    ) -> Result<String, String>;

    // --- Query execution ----------------------------------------------------

    async fn execute_query(
        &self,
        params: &ConnectionParams,
        query: &str,
        limit: Option<u32>,
        page: u32,
        schema: Option<&str>,
    ) -> Result<QueryResult, String>;

    // --- CRUD ---------------------------------------------------------------

    async fn insert_record(
        &self,
        params: &ConnectionParams,
        table: &str,
        data: serde_json::Value,
        schema: Option<&str>,
    ) -> Result<u64, String>;

    async fn update_record(
        &self,
        params: &ConnectionParams,
        table: &str,
        pk_col: &str,
        pk_val: serde_json::Value,
        col_name: &str,
        new_val: serde_json::Value,
        schema: Option<&str>,
    ) -> Result<u64, String>;

    async fn delete_record(
        &self,
        params: &ConnectionParams,
        table: &str,
        pk_col: &str,
        pk_val: serde_json::Value,
        schema: Option<&str>,
    ) -> Result<u64, String>;

    // --- ER diagram (batch) -------------------------------------------------

    async fn get_schema_snapshot(
        &self,
        params: &ConnectionParams,
        schema: Option<&str>,
    ) -> Result<Vec<TableSchema>, String>;

    async fn get_all_columns_batch(
        &self,
        params: &ConnectionParams,
        schema: Option<&str>,
    ) -> Result<HashMap<String, Vec<TableColumn>>, String>;

    async fn get_all_foreign_keys_batch(
        &self,
        params: &ConnectionParams,
        schema: Option<&str>,
    ) -> Result<HashMap<String, Vec<ForeignKey>>, String>;
}
```

---

## 2. `src-tauri/src/drivers/registry.rs` — New file

```rust
use std::collections::HashMap;
use std::sync::Arc;

use once_cell::sync::Lazy;
use tokio::sync::RwLock;

use super::driver_trait::{DatabaseDriver, PluginManifest};

type Registry = Arc<RwLock<HashMap<String, Arc<dyn DatabaseDriver>>>>;

static REGISTRY: Lazy<Registry> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Register a driver. Called once at application startup for each built-in
/// driver, and can be called again at any point to add third-party drivers.
pub async fn register_driver(driver: impl DatabaseDriver + 'static) {
    let id = driver.manifest().id.clone();
    log::info!("Registering driver: {} ({})", driver.manifest().name, id);
    let mut reg = REGISTRY.write().await;
    reg.insert(id, Arc::new(driver));
}

/// Look up a driver by its `id` (matches `ConnectionParams.driver`).
/// Returns `None` if no driver with that id is registered.
pub async fn get_driver(id: &str) -> Option<Arc<dyn DatabaseDriver>> {
    let reg = REGISTRY.read().await;
    reg.get(id).cloned()
}

/// Returns the manifests of all registered drivers, sorted by id.
/// Called by the `get_registered_drivers` Tauri command.
pub async fn list_drivers() -> Vec<PluginManifest> {
    let reg = REGISTRY.read().await;
    let mut manifests: Vec<PluginManifest> =
        reg.values().map(|d| d.manifest().clone()).collect();
    manifests.sort_by(|a, b| a.id.cmp(&b.id));
    manifests
}
```

---

## 3. `src-tauri/src/drivers/mysql/mod.rs` — Append to existing file

All existing `pub async fn` functions stay exactly as they are. Add this block at the bottom.

```rust
// ============================================================
// Plugin wrapper
// ============================================================

use crate::drivers::driver_trait::{DatabaseDriver, DriverCapabilities, PluginManifest};
use async_trait::async_trait;
use std::collections::HashMap;

pub struct MysqlDriver {
    manifest: PluginManifest,
}

impl MysqlDriver {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "mysql".to_string(),
                name: "MySQL".to_string(),
                version: "1.0.0".to_string(),
                description: "MySQL and MariaDB databases".to_string(),
                default_port: Some(3306),
                capabilities: DriverCapabilities {
                    schemas: false,
                    views: true,
                    routines: true,
                    file_based: false,
                },
            },
        }
    }
}

#[async_trait]
impl DatabaseDriver for MysqlDriver {
    fn manifest(&self) -> &PluginManifest { &self.manifest }

    fn get_data_types(&self) -> Vec<crate::models::DataTypeInfo> {
        types::get_data_types()
    }

    fn build_connection_url(&self, params: &crate::models::ConnectionParams) -> Result<String, String> {
        use urlencoding::encode;
        let user = encode(params.username.as_deref().unwrap_or_default());
        let pass = encode(params.password.as_deref().unwrap_or_default());
        Ok(format!(
            "mysql://{}:{}@{}:{}/{}",
            user, pass,
            params.host.as_deref().unwrap_or("localhost"),
            params.port.unwrap_or(3306),
            params.database
        ))
    }

    async fn get_databases(&self, params: &crate::models::ConnectionParams) -> Result<Vec<String>, String> {
        // MySQL requires connecting to information_schema to list databases
        let mut p = params.clone();
        p.database = "information_schema".to_string();
        p.connection_id = None; // avoid caching under the real connection key
        get_databases(&p).await
    }

    async fn get_schemas(&self, params: &crate::models::ConnectionParams) -> Result<Vec<String>, String> {
        get_schemas(params).await
    }

    async fn get_tables(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::TableInfo>, String> {
        get_tables(params).await
    }

    async fn get_columns(&self, params: &crate::models::ConnectionParams, table: &str, _schema: Option<&str>) -> Result<Vec<crate::models::TableColumn>, String> {
        get_columns(params, table).await
    }

    async fn get_foreign_keys(&self, params: &crate::models::ConnectionParams, table: &str, _schema: Option<&str>) -> Result<Vec<crate::models::ForeignKey>, String> {
        get_foreign_keys(params, table).await
    }

    async fn get_indexes(&self, params: &crate::models::ConnectionParams, table: &str, _schema: Option<&str>) -> Result<Vec<crate::models::Index>, String> {
        get_indexes(params, table).await
    }

    async fn get_views(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::ViewInfo>, String> {
        get_views(params).await
    }

    async fn get_view_definition(&self, params: &crate::models::ConnectionParams, view_name: &str, _schema: Option<&str>) -> Result<String, String> {
        get_view_definition(params, view_name).await
    }

    async fn get_view_columns(&self, params: &crate::models::ConnectionParams, view_name: &str, _schema: Option<&str>) -> Result<Vec<crate::models::TableColumn>, String> {
        get_view_columns(params, view_name).await
    }

    async fn create_view(&self, params: &crate::models::ConnectionParams, view_name: &str, definition: &str, _schema: Option<&str>) -> Result<(), String> {
        create_view(params, view_name, definition).await
    }

    async fn alter_view(&self, params: &crate::models::ConnectionParams, view_name: &str, definition: &str, _schema: Option<&str>) -> Result<(), String> {
        alter_view(params, view_name, definition).await
    }

    async fn drop_view(&self, params: &crate::models::ConnectionParams, view_name: &str, _schema: Option<&str>) -> Result<(), String> {
        drop_view(params, view_name).await
    }

    async fn get_routines(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::RoutineInfo>, String> {
        get_routines(params).await
    }

    async fn get_routine_parameters(&self, params: &crate::models::ConnectionParams, routine_name: &str, _schema: Option<&str>) -> Result<Vec<crate::models::RoutineParameter>, String> {
        get_routine_parameters(params, routine_name).await
    }

    async fn get_routine_definition(&self, params: &crate::models::ConnectionParams, routine_name: &str, routine_type: &str, _schema: Option<&str>) -> Result<String, String> {
        get_routine_definition(params, routine_name, routine_type).await
    }

    async fn execute_query(&self, params: &crate::models::ConnectionParams, query: &str, limit: Option<u32>, page: u32, _schema: Option<&str>) -> Result<crate::models::QueryResult, String> {
        execute_query(params, query, limit, page).await
    }

    async fn insert_record(&self, params: &crate::models::ConnectionParams, table: &str, data: serde_json::Value, _schema: Option<&str>) -> Result<u64, String> {
        insert_record(params, table, data).await
    }

    async fn update_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, _schema: Option<&str>) -> Result<u64, String> {
        update_record(params, table, pk_col, pk_val, col_name, new_val).await
    }

    async fn delete_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, _schema: Option<&str>) -> Result<u64, String> {
        delete_record(params, table, pk_col, pk_val).await
    }

    async fn get_all_columns_batch(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<HashMap<String, Vec<crate::models::TableColumn>>, String> {
        get_all_columns_batch(params).await
    }

    async fn get_all_foreign_keys_batch(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<HashMap<String, Vec<crate::models::ForeignKey>>, String> {
        get_all_foreign_keys_batch(params).await
    }

    async fn get_schema_snapshot(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<Vec<crate::models::TableSchema>, String> {
        let tables = self.get_tables(params, schema).await?;
        let mut columns_map = self.get_all_columns_batch(params, schema).await?;
        let mut fks_map = self.get_all_foreign_keys_batch(params, schema).await?;
        Ok(tables.into_iter().map(|t| crate::models::TableSchema {
            name: t.name.clone(),
            columns: columns_map.remove(&t.name).unwrap_or_default(),
            foreign_keys: fks_map.remove(&t.name).unwrap_or_default(),
        }).collect())
    }
}
```

---

## 4. `src-tauri/src/drivers/postgres/mod.rs` — Append to existing file

```rust
// ============================================================
// Plugin wrapper
// ============================================================

use crate::drivers::driver_trait::{DatabaseDriver, DriverCapabilities, PluginManifest};
use async_trait::async_trait;
use std::collections::HashMap;

pub struct PostgresDriver {
    manifest: PluginManifest,
}

impl PostgresDriver {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "postgres".to_string(),
                name: "PostgreSQL".to_string(),
                version: "1.0.0".to_string(),
                description: "PostgreSQL databases".to_string(),
                default_port: Some(5432),
                capabilities: DriverCapabilities {
                    schemas: true,
                    views: true,
                    routines: true,
                    file_based: false,
                },
            },
        }
    }

    fn resolve_schema<'a>(&self, schema: Option<&'a str>) -> &'a str {
        schema.unwrap_or("public")
    }
}

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    fn manifest(&self) -> &PluginManifest { &self.manifest }

    fn get_data_types(&self) -> Vec<crate::models::DataTypeInfo> {
        types::get_data_types()
    }

    fn build_connection_url(&self, params: &crate::models::ConnectionParams) -> Result<String, String> {
        use urlencoding::encode;
        let user = encode(params.username.as_deref().unwrap_or_default());
        let pass = encode(params.password.as_deref().unwrap_or_default());
        Ok(format!(
            "postgres://{}:{}@{}:{}/{}",
            user, pass,
            params.host.as_deref().unwrap_or("localhost"),
            params.port.unwrap_or(5432),
            params.database
        ))
    }

    async fn get_databases(&self, params: &crate::models::ConnectionParams) -> Result<Vec<String>, String> {
        let mut p = params.clone();
        p.database = "postgres".to_string();
        get_databases(&p).await
    }

    async fn get_schemas(&self, params: &crate::models::ConnectionParams) -> Result<Vec<String>, String> {
        get_schemas(params).await
    }

    async fn get_tables(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<Vec<crate::models::TableInfo>, String> {
        get_tables(params, self.resolve_schema(schema)).await
    }

    async fn get_columns(&self, params: &crate::models::ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<crate::models::TableColumn>, String> {
        get_columns(params, table, self.resolve_schema(schema)).await
    }

    async fn get_foreign_keys(&self, params: &crate::models::ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<crate::models::ForeignKey>, String> {
        get_foreign_keys(params, table, self.resolve_schema(schema)).await
    }

    async fn get_indexes(&self, params: &crate::models::ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<crate::models::Index>, String> {
        get_indexes(params, table, self.resolve_schema(schema)).await
    }

    async fn get_views(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<Vec<crate::models::ViewInfo>, String> {
        get_views(params, self.resolve_schema(schema)).await
    }

    async fn get_view_definition(&self, params: &crate::models::ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<String, String> {
        get_view_definition(params, view_name, self.resolve_schema(schema)).await
    }

    async fn get_view_columns(&self, params: &crate::models::ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<Vec<crate::models::TableColumn>, String> {
        get_view_columns(params, view_name, self.resolve_schema(schema)).await
    }

    async fn create_view(&self, params: &crate::models::ConnectionParams, view_name: &str, definition: &str, schema: Option<&str>) -> Result<(), String> {
        create_view(params, view_name, definition, self.resolve_schema(schema)).await
    }

    async fn alter_view(&self, params: &crate::models::ConnectionParams, view_name: &str, definition: &str, schema: Option<&str>) -> Result<(), String> {
        alter_view(params, view_name, definition, self.resolve_schema(schema)).await
    }

    async fn drop_view(&self, params: &crate::models::ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<(), String> {
        drop_view(params, view_name, self.resolve_schema(schema)).await
    }

    async fn get_routines(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<Vec<crate::models::RoutineInfo>, String> {
        get_routines(params, self.resolve_schema(schema)).await
    }

    async fn get_routine_parameters(&self, params: &crate::models::ConnectionParams, routine_name: &str, schema: Option<&str>) -> Result<Vec<crate::models::RoutineParameter>, String> {
        get_routine_parameters(params, routine_name, self.resolve_schema(schema)).await
    }

    async fn get_routine_definition(&self, params: &crate::models::ConnectionParams, routine_name: &str, routine_type: &str, schema: Option<&str>) -> Result<String, String> {
        get_routine_definition(params, routine_name, routine_type, self.resolve_schema(schema)).await
    }

    async fn execute_query(&self, params: &crate::models::ConnectionParams, query: &str, limit: Option<u32>, page: u32, schema: Option<&str>) -> Result<crate::models::QueryResult, String> {
        execute_query(params, query, limit, page, schema).await
    }

    async fn insert_record(&self, params: &crate::models::ConnectionParams, table: &str, data: serde_json::Value, schema: Option<&str>) -> Result<u64, String> {
        insert_record(params, table, data, self.resolve_schema(schema)).await
    }

    async fn update_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, schema: Option<&str>) -> Result<u64, String> {
        update_record(params, table, pk_col, pk_val, col_name, new_val, self.resolve_schema(schema)).await
    }

    async fn delete_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, schema: Option<&str>) -> Result<u64, String> {
        delete_record(params, table, pk_col, pk_val, self.resolve_schema(schema)).await
    }

    async fn get_all_columns_batch(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<HashMap<String, Vec<crate::models::TableColumn>>, String> {
        get_all_columns_batch(params, self.resolve_schema(schema)).await
    }

    async fn get_all_foreign_keys_batch(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<HashMap<String, Vec<crate::models::ForeignKey>>, String> {
        get_all_foreign_keys_batch(params, self.resolve_schema(schema)).await
    }

    async fn get_schema_snapshot(&self, params: &crate::models::ConnectionParams, schema: Option<&str>) -> Result<Vec<crate::models::TableSchema>, String> {
        let pg_schema = self.resolve_schema(schema);
        let tables = get_tables(params, pg_schema).await?;
        let mut columns_map = get_all_columns_batch(params, pg_schema).await?;
        let mut fks_map = get_all_foreign_keys_batch(params, pg_schema).await?;
        Ok(tables.into_iter().map(|t| crate::models::TableSchema {
            name: t.name.clone(),
            columns: columns_map.remove(&t.name).unwrap_or_default(),
            foreign_keys: fks_map.remove(&t.name).unwrap_or_default(),
        }).collect())
    }
}
```

---

## 5. `src-tauri/src/drivers/sqlite/mod.rs` — Append to existing file

```rust
// ============================================================
// Plugin wrapper
// ============================================================

use crate::drivers::driver_trait::{DatabaseDriver, DriverCapabilities, PluginManifest};
use async_trait::async_trait;
use std::collections::HashMap;

pub struct SqliteDriver {
    manifest: PluginManifest,
}

impl SqliteDriver {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "sqlite".to_string(),
                name: "SQLite".to_string(),
                version: "1.0.0".to_string(),
                description: "SQLite file-based databases".to_string(),
                default_port: None,
                capabilities: DriverCapabilities {
                    schemas: false,
                    views: true,
                    routines: false,
                    file_based: true,
                },
            },
        }
    }
}

#[async_trait]
impl DatabaseDriver for SqliteDriver {
    fn manifest(&self) -> &PluginManifest { &self.manifest }

    fn get_data_types(&self) -> Vec<crate::models::DataTypeInfo> {
        types::get_data_types()
    }

    fn build_connection_url(&self, params: &crate::models::ConnectionParams) -> Result<String, String> {
        Ok(format!("sqlite://{}", params.database))
    }

    async fn get_databases(&self, params: &crate::models::ConnectionParams) -> Result<Vec<String>, String> {
        get_databases(params).await
    }

    async fn get_schemas(&self, params: &crate::models::ConnectionParams) -> Result<Vec<String>, String> {
        get_schemas(params).await
    }

    async fn get_tables(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::TableInfo>, String> {
        get_tables(params).await
    }

    async fn get_columns(&self, params: &crate::models::ConnectionParams, table: &str, _schema: Option<&str>) -> Result<Vec<crate::models::TableColumn>, String> {
        get_columns(params, table).await
    }

    async fn get_foreign_keys(&self, params: &crate::models::ConnectionParams, table: &str, _schema: Option<&str>) -> Result<Vec<crate::models::ForeignKey>, String> {
        get_foreign_keys(params, table).await
    }

    async fn get_indexes(&self, params: &crate::models::ConnectionParams, table: &str, _schema: Option<&str>) -> Result<Vec<crate::models::Index>, String> {
        get_indexes(params, table).await
    }

    async fn get_views(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::ViewInfo>, String> {
        get_views(params).await
    }

    async fn get_view_definition(&self, params: &crate::models::ConnectionParams, view_name: &str, _schema: Option<&str>) -> Result<String, String> {
        get_view_definition(params, view_name).await
    }

    async fn get_view_columns(&self, params: &crate::models::ConnectionParams, view_name: &str, _schema: Option<&str>) -> Result<Vec<crate::models::TableColumn>, String> {
        get_view_columns(params, view_name).await
    }

    async fn create_view(&self, params: &crate::models::ConnectionParams, view_name: &str, definition: &str, _schema: Option<&str>) -> Result<(), String> {
        create_view(params, view_name, definition).await
    }

    async fn alter_view(&self, params: &crate::models::ConnectionParams, view_name: &str, definition: &str, _schema: Option<&str>) -> Result<(), String> {
        alter_view(params, view_name, definition).await
    }

    async fn drop_view(&self, params: &crate::models::ConnectionParams, view_name: &str, _schema: Option<&str>) -> Result<(), String> {
        drop_view(params, view_name).await
    }

    async fn get_routines(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::RoutineInfo>, String> {
        get_routines(params).await
    }

    async fn get_routine_parameters(&self, params: &crate::models::ConnectionParams, routine_name: &str, _schema: Option<&str>) -> Result<Vec<crate::models::RoutineParameter>, String> {
        get_routine_parameters(params, routine_name).await
    }

    async fn get_routine_definition(&self, params: &crate::models::ConnectionParams, routine_name: &str, routine_type: &str, _schema: Option<&str>) -> Result<String, String> {
        get_routine_definition(params, routine_name, routine_type).await
    }

    async fn execute_query(&self, params: &crate::models::ConnectionParams, query: &str, limit: Option<u32>, page: u32, _schema: Option<&str>) -> Result<crate::models::QueryResult, String> {
        execute_query(params, query, limit, page).await
    }

    async fn insert_record(&self, params: &crate::models::ConnectionParams, table: &str, data: serde_json::Value, _schema: Option<&str>) -> Result<u64, String> {
        insert_record(params, table, data).await
    }

    async fn update_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, _schema: Option<&str>) -> Result<u64, String> {
        update_record(params, table, pk_col, pk_val, col_name, new_val).await
    }

    async fn delete_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, _schema: Option<&str>) -> Result<u64, String> {
        delete_record(params, table, pk_col, pk_val).await
    }

    async fn get_all_columns_batch(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<HashMap<String, Vec<crate::models::TableColumn>>, String> {
        let tables = get_tables(params).await?;
        let names: Vec<String> = tables.into_iter().map(|t| t.name).collect();
        get_all_columns_batch(params, &names).await
    }

    async fn get_all_foreign_keys_batch(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<HashMap<String, Vec<crate::models::ForeignKey>>, String> {
        let tables = get_tables(params).await?;
        let names: Vec<String> = tables.into_iter().map(|t| t.name).collect();
        get_all_foreign_keys_batch(params, &names).await
    }

    async fn get_schema_snapshot(&self, params: &crate::models::ConnectionParams, _schema: Option<&str>) -> Result<Vec<crate::models::TableSchema>, String> {
        let tables = get_tables(params).await?;
        let names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        let mut columns_map = get_all_columns_batch(params, &names).await?;
        let mut fks_map = get_all_foreign_keys_batch(params, &names).await?;
        Ok(tables.into_iter().map(|t| crate::models::TableSchema {
            name: t.name.clone(),
            columns: columns_map.remove(&t.name).unwrap_or_default(),
            foreign_keys: fks_map.remove(&t.name).unwrap_or_default(),
        }).collect())
    }
}
```

---

## 6. `src-tauri/src/lib.rs` — Changes

### Expose new modules

```rust
// Before:
pub mod drivers {
    pub mod common;
    pub mod mysql;
    pub mod postgres;
    pub mod sqlite;
}

// After:
pub mod drivers {
    pub mod common;
    pub mod driver_trait;
    pub mod registry;
    pub mod mysql;
    pub mod postgres;
    pub mod sqlite;
}
```

### Register built-in drivers inside `.setup()`

```rust
.setup(move |app| {
    // Register built-in drivers
    tauri::async_runtime::block_on(async {
        drivers::registry::register_driver(drivers::mysql::MysqlDriver::new()).await;
        drivers::registry::register_driver(drivers::postgres::PostgresDriver::new()).await;
        drivers::registry::register_driver(drivers::sqlite::SqliteDriver::new()).await;
    });

    if args.debug {
        if let Some(window) = app.get_webview_window("main") {
            window.open_devtools();
        }
    }
    Ok(())
})
```

### Add new command to `invoke_handler![]`

```rust
commands::get_registered_drivers,
```

---

## 7. `src-tauri/src/commands.rs` — Changes

### Add helper function (near the top, after imports)

```rust
/// Resolve the driver from the registry or return a descriptive error.
async fn driver_for(
    id: &str,
) -> Result<std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>, String> {
    crate::drivers::registry::get_driver(id)
        .await
        .ok_or_else(|| format!("Unsupported driver: {}", id))
}
```

### Replace every `match driver` dispatch

**Before (repeated ~20 times):**
```rust
match saved_conn.params.driver.as_str() {
    "mysql"    => mysql::get_tables(&params).await,
    "postgres" => postgres::get_tables(&params, schema.as_deref().unwrap_or("public")).await,
    "sqlite"   => sqlite::get_tables(&params).await,
    _          => Err("Unsupported driver".into()),
}
```

**After:**
```rust
let drv = driver_for(&saved_conn.params.driver).await?;
drv.get_tables(&params, schema.as_deref()).await
```

Full substitution table:

| Command function | New dispatch call |
|-----------------|-------------------|
| `get_schemas` | `drv.get_schemas(&params).await` |
| `get_tables` | `drv.get_tables(&params, schema.as_deref()).await` |
| `get_columns` | `drv.get_columns(&params, &table_name, schema.as_deref()).await` |
| `get_foreign_keys` | `drv.get_foreign_keys(&params, &table_name, schema.as_deref()).await` |
| `get_indexes` | `drv.get_indexes(&params, &table_name, schema.as_deref()).await` |
| `get_views` | `drv.get_views(&params, schema.as_deref()).await` |
| `get_view_definition` | `drv.get_view_definition(&params, &view_name, schema.as_deref()).await` |
| `get_view_columns` | `drv.get_view_columns(&params, &view_name, schema.as_deref()).await` |
| `create_view` | `drv.create_view(&params, &view_name, &definition, schema.as_deref()).await` |
| `alter_view` | `drv.alter_view(&params, &view_name, &definition, schema.as_deref()).await` |
| `drop_view` | `drv.drop_view(&params, &view_name, schema.as_deref()).await` |
| `get_routines` | `drv.get_routines(&params, schema.as_deref()).await` |
| `get_routine_parameters` | `drv.get_routine_parameters(&params, &routine_name, schema.as_deref()).await` |
| `get_routine_definition` | `drv.get_routine_definition(&params, &routine_name, &routine_type, schema.as_deref()).await` |
| `insert_record` | `drv.insert_record(&params, &table, data, schema.as_deref()).await` |
| `update_record` | `drv.update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref()).await` |
| `delete_record` | `drv.delete_record(&params, &table, &pk_col, pk_val, schema.as_deref()).await` |
| `get_schema_snapshot` | `drv.get_schema_snapshot(&params, schema.as_deref()).await` |

### Special case — `execute_query` (spawns a cancellable task)

`Arc<dyn DatabaseDriver + Send + Sync>` is `Send`, so it can be moved into `tokio::spawn`:

```rust
let drv = driver_for(&saved_conn.params.driver).await?;
let task = tokio::spawn(async move {
    drv.execute_query(&params, &sanitized_query, limit, page.unwrap_or(1), schema.as_deref()).await
});
```

### Special case — `list_databases`

The database-switching logic (e.g. MySQL connecting to `information_schema`) is now
encapsulated inside `MysqlDriver::get_databases` and `PostgresDriver::get_databases`:

```rust
let drv = driver_for(&resolved_params.driver).await?;
drv.get_databases(&resolved_params).await
```

### Special case — `get_data_types`

```rust
#[tauri::command]
pub async fn get_data_types(driver: String) -> crate::models::DataTypeRegistry {
    let types = match crate::drivers::registry::get_driver(&driver).await {
        Some(drv) => drv.get_data_types(),
        None => {
            log::warn!("Unknown driver: {}, returning empty type list", driver);
            vec![]
        }
    };
    crate::models::DataTypeRegistry { driver, types }
}
```

### Special case — `build_connection_url`

```rust
pub async fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {
    let drv = driver_for(&params.driver).await?;
    drv.build_connection_url(params)
}
```

### New command

```rust
#[tauri::command]
pub async fn get_registered_drivers() -> Vec<crate::drivers::driver_trait::PluginManifest> {
    crate::drivers::registry::list_drivers().await
}
```

---

## 8. `src/types/plugins.ts` — New file

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

## 9. `src/hooks/useDrivers.ts` — New file

```typescript
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import type { PluginManifest } from "../types/plugins";

const FALLBACK_DRIVERS: PluginManifest[] = [
  {
    id: "postgres",
    name: "PostgreSQL",
    version: "1.0.0",
    description: "PostgreSQL databases",
    default_port: 5432,
    capabilities: { schemas: true, views: true, routines: true, file_based: false },
  },
  {
    id: "mysql",
    name: "MySQL",
    version: "1.0.0",
    description: "MySQL and MariaDB databases",
    default_port: 3306,
    capabilities: { schemas: false, views: true, routines: true, file_based: false },
  },
  {
    id: "sqlite",
    name: "SQLite",
    version: "1.0.0",
    description: "SQLite file-based databases",
    default_port: null,
    capabilities: { schemas: false, views: true, routines: false, file_based: true },
  },
];

export function useDrivers(): {
  drivers: PluginManifest[];
  loading: boolean;
  error: string | null;
} {
  const [drivers, setDrivers] = useState<PluginManifest[]>(FALLBACK_DRIVERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<PluginManifest[]>("get_registered_drivers")
      .then((result) => {
        setDrivers(result);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  return { drivers, loading, error };
}
```

---

## 10. `src/utils/connections.ts` — Changes

```typescript
// Before:
export type DatabaseDriver = "postgres" | "mysql" | "sqlite";

// After:
export type DatabaseDriver = string;

// Keep these for places in the codebase that check against known built-in ids:
export const BUILTIN_DRIVER_IDS = ["postgres", "mysql", "sqlite"] as const;
export type BuiltinDriverId = (typeof BUILTIN_DRIVER_IDS)[number];
```

No other changes needed — `getDefaultPort`, `getDriverLabel`, `validateConnectionParams`,
`formatConnectionString`, and `generateConnectionName` all have `default` branches that
already handle unknown driver strings gracefully.

---

## 11. `src/components/ui/NewConnectionModal.tsx` — Changes

```typescript
// Remove the local type alias:
// type Driver = "postgres" | "mysql" | "sqlite";   ← delete this

// Add imports:
import { useDrivers } from "../../hooks/useDrivers";
import type { PluginManifest } from "../../types/plugins";

// Inside the component, replace the hard-coded useState<Driver>:
const { drivers } = useDrivers();
const [selectedDriverId, setSelectedDriverId] = useState<string>("postgres");
const activeDriver = drivers.find((d) => d.id === selectedDriverId) ?? drivers[0];

// Replace the static driver button list:
// Before:
// {(["mysql", "postgres", "sqlite"] as Driver[]).map((d) => (...))}

// After:
{drivers.map((d: PluginManifest) => (
  <button
    key={d.id}
    onClick={() => setSelectedDriverId(d.id)}
    className={selectedDriverId === d.id ? "active" : ""}
  >
    {d.name}
  </button>
))}

// Replace driver string comparisons with capability checks where possible:
// driver !== "sqlite"   →   activeDriver?.capabilities.file_based !== true
// driver === "postgres" →   activeDriver?.capabilities.schemas === true
// driver === "sqlite"   →   activeDriver?.capabilities.file_based === true
```

---

## Third-party plugin guide

To ship a new driver (e.g. ClickHouse):

### 1. Depend on `tabularis_lib`

```toml
[dependencies]
tabularis_lib = { path = "../tabularis" }
async-trait   = "0.1"
clickhouse    = "0.11"
```

### 2. Implement the trait

```rust
use async_trait::async_trait;
use tabularis_lib::drivers::driver_trait::{DatabaseDriver, DriverCapabilities, PluginManifest};
use tabularis_lib::models::*;

pub struct ClickHouseDriver { manifest: PluginManifest }

impl ClickHouseDriver {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "clickhouse".to_string(),
                name: "ClickHouse".to_string(),
                version: "0.1.0".to_string(),
                description: "ClickHouse OLAP database".to_string(),
                default_port: Some(8123),
                capabilities: DriverCapabilities {
                    schemas: false,
                    views: true,
                    routines: false,
                    file_based: false,
                },
            },
        }
    }
}

#[async_trait]
impl DatabaseDriver for ClickHouseDriver {
    fn manifest(&self) -> &PluginManifest { &self.manifest }
    // ... implement all required methods
}
```

### 3. Register at startup — one line in `lib.rs`

```rust
drivers::registry::register_driver(clickhouse_driver::ClickHouseDriver::new()).await;
```

The frontend picks up the new driver automatically via `get_registered_drivers` —
no frontend changes required.

---

## What stays unchanged

| Component | Status |
|-----------|--------|
| SQL logic inside `mysql/mod.rs`, `postgres/mod.rs`, `sqlite/mod.rs` | Unchanged |
| `models.rs` | Unchanged |
| `pool_manager.rs` | Unchanged |
| SSH tunnel handling | Unchanged |
| Export, dump, MCP, AI commands | Unchanged |
| Existing Rust tests | Unchanged |
