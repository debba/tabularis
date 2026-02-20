# Writing a Custom Database Driver Plugin for Tabularis

Tabularis supports extending its capabilities via a Rust-based plugin system. By implementing the `DatabaseDriver` trait, you can add support for virtually any SQL or NoSQL database.

This guide details how to implement and register a custom plugin.

## 1. Implement the `DatabaseDriver` Trait

All drivers must implement the `DatabaseDriver` trait from `tabularis::drivers::driver_trait::DatabaseDriver`. 

You start by creating a structure that holds your driver's configuration (like a `PluginManifest`) and implementing the trait for it.

### Example Scaffold

```rust
use async_trait::async_trait;
use std::collections::HashMap;
use serde_json::Value;

use tabularis::drivers::driver_trait::{
    DatabaseDriver, DriverCapabilities, PluginManifest
};
use tabularis::models::{
    ConnectionParams, DataTypeInfo, ForeignKey, Index, QueryResult, RoutineInfo,
    RoutineParameter, TableColumn, TableInfo, TableSchema, ViewInfo,
};

pub struct MyCustomDriver {
    manifest: PluginManifest,
}

impl MyCustomDriver {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "mydriver".to_string(), // Must match the `driver` field in `ConnectionParams`
                name: "My Custom DB".to_string(),
                version: "1.0.0".to_string(),
                description: "A custom database driver".to_string(),
                default_port: Some(1234), // Or None if file-based
                capabilities: DriverCapabilities {
                    schemas: true, // Does it support namespaces/schemas like Postgres?
                    views: false,  // Does it support views?
                    routines: false, // Does it support stored procedures/functions?
                    file_based: false, // True for SQLite, DuckDB, etc.
                },
            },
        }
    }
}
```

## 2. Implementing the Methods

The `DatabaseDriver` trait requires several async functions. The `schema` parameter is `Option<&str>` throughout and should be ignored by drivers that do not use schemas. 

Below are the main categories of methods you must implement:

### Metadata & Discovery

```rust
#[async_trait]
impl DatabaseDriver for MyCustomDriver {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    fn get_data_types(&self) -> Vec<DataTypeInfo> {
        // Return a list of supported types (e.g. VARCHAR, INT) with their properties
        vec![]
    }

    fn build_connection_url(&self, params: &ConnectionParams) -> Result<String, String> {
        // Format the ConnectionParams into a valid connection string 
        // e.g., "mysql://user:pass@host:3306/db"
        Ok(format!(
            "custom://{}:{}@{}:{}/{}",
            params.username.as_deref().unwrap_or_default(),
            params.password.as_deref().unwrap_or_default(),
            params.host.as_deref().unwrap_or("localhost"),
            params.port.unwrap_or(1234),
            params.database
        ))
    }

    async fn get_databases(&self, params: &ConnectionParams) -> Result<Vec<String>, String> {
        // Query to list all databases in the server
        Ok(vec![params.database.clone()])
    }

    async fn get_schemas(&self, params: &ConnectionParams) -> Result<Vec<String>, String> {
        // Query to list all schemas in the database
        Ok(vec!["public".to_string()])
    }
}
```

### Schema Inspection

You need to write queries to list tables, columns, indexes, and foreign keys.

```rust
    async fn get_tables(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<TableInfo>, String> {
        // Return a list of TableInfo objects
        Ok(vec![])
    }

    async fn get_columns(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<TableColumn>, String> {
        // Return details for each column in the requested table
        Ok(vec![])
    }

    // Similar for `get_foreign_keys` and `get_indexes`
```

### Query Execution

This is the core execution method. It handles standard `SELECT`, `INSERT`, etc., returning data as JSON.

```rust
    async fn execute_query(
        &self,
        params: &ConnectionParams,
        query: &str,
        limit: Option<u32>,
        page: u32,
        schema: Option<&str>,
    ) -> Result<QueryResult, String> {
        // Execute the arbitrary SQL and return the result set
        unimplemented!()
    }
```

### CRUD Operations

Tabularis UI allows inline editing. Implement these methods to power that feature:

```rust
    async fn insert_record(
        &self,
        params: &ConnectionParams,
        table: &str,
        data: HashMap<String, Value>,
        schema: Option<&str>,
        max_blob_size: u64,
    ) -> Result<u64, String> {
        // Insert data and return the number of affected rows
        Ok(1)
    }

    async fn update_record(
        &self,
        params: &ConnectionParams,
        table: &str,
        pk_col: &str,
        pk_val: Value,
        col_name: &str,
        new_val: Value,
        schema: Option<&str>,
        max_blob_size: u64,
    ) -> Result<u64, String> {
        // Update a specific column for a record matching the primary key
        Ok(1)
    }

    async fn delete_record(
        &self,
        params: &ConnectionParams,
        table: &str,
        pk_col: &str,
        pk_val: Value,
        schema: Option<&str>,
    ) -> Result<u64, String> {
        // Delete a record matching the primary key
        Ok(1)
    }
```

### Batch ER Diagram Support

To efficiently draw Entity-Relationship (ER) diagrams, implement the batch methods to prevent `N+1` queries.

```rust
    async fn get_schema_snapshot(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<TableSchema>, String> {
        // Usually implemented by fetching tables, batch columns, and batch foreign keys
        // and merging them into `TableSchema` objects.
        Ok(vec![])
    }
```

## 3. Registering the Driver

Once your driver is fully implemented, register it in the Tabularis core logic during initialization (in `src-tauri/src/lib.rs`).

```rust
// src-tauri/src/lib.rs

use tabularis::drivers::registry::register_driver;

// ... inside tauri::Builder::default().setup() ...
.setup(move |app| {
    tauri::async_runtime::block_on(async {
        // Register built-in drivers
        drivers::registry::register_driver(drivers::mysql::MysqlDriver::new()).await;
        drivers::registry::register_driver(drivers::postgres::PostgresDriver::new()).await;
        drivers::registry::register_driver(drivers::sqlite::SqliteDriver::new()).await;

        // Register YOUR custom driver here
        drivers::registry::register_driver(MyCustomDriver::new()).await;
    });
    
    Ok(())
})
```

## 4. Activating in the Frontend

Because Tabularis allows the user to disable non-builtin plugins in the Settings page, your driver needs to be manually toggled on the first time.

1. Launch Tabularis.
2. Go to **Settings** -> **Plugins**.
3. Locate your new driver (`My Custom DB`) in the list.
4. Toggle it to **Enabled**. 
5. When creating a new connection, your driver will now appear as an option in the "Database Type" selection!
