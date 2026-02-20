use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot};

use crate::drivers::driver_trait::{DatabaseDriver, PluginManifest};
use crate::models::{
    ConnectionParams, DataTypeInfo, ForeignKey, Index, QueryResult, RoutineInfo, RoutineParameter,
    TableColumn, TableInfo, TableSchema, ViewInfo,
};
use crate::plugins::rpc::{JsonRpcRequest, JsonRpcResponse};

struct PluginProcess {
    sender: mpsc::Sender<(JsonRpcRequest, oneshot::Sender<Result<Value, String>>)>,
    next_id: AtomicU64,
}

impl PluginProcess {
    fn new(executable_path: PathBuf) -> Self {
        let (tx, mut rx) = mpsc::channel::<(JsonRpcRequest, oneshot::Sender<Result<Value, String>>)>(100);

        tokio::spawn(async move {
            let mut child = Command::new(&executable_path)
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::inherit())
                .spawn()
                .expect("Failed to start plugin process");

            let mut stdin = child.stdin.take().expect("Failed to open stdin");
            let stdout = child.stdout.take().expect("Failed to open stdout");
            let mut reader = BufReader::new(stdout);

            let mut pending_requests: HashMap<u64, oneshot::Sender<Result<Value, String>>> = HashMap::new();
            let mut line_buf = String::new();

            loop {
                tokio::select! {
                    Some((req, resp_tx)) = rx.recv() => {
                        let id = req.id;
                        pending_requests.insert(id, resp_tx);

                        let mut req_str = serde_json::to_string(&req).unwrap();
                        req_str.push('\n');

                        if let Err(e) = stdin.write_all(req_str.as_bytes()).await {
                            log::error!("Failed to write to plugin stdin: {}", e);
                            if let Some(tx) = pending_requests.remove(&id) {
                                let _ = tx.send(Err(format!("Plugin communication error: {}", e)));
                            }
                        }
                    }
                    line_result = reader.read_line(&mut line_buf) => {
                        match line_result {
                            Ok(0) => {
                                log::error!("Plugin process exited unexpectedly");
                                break;
                            }
                            Ok(_) => {
                                match serde_json::from_str::<JsonRpcResponse>(&line_buf) {
                                    Ok(JsonRpcResponse::Success { result, id, .. }) => {
                                        if let Some(tx) = pending_requests.remove(&id) {
                                            let _ = tx.send(Ok(result));
                                        }
                                    }
                                    Ok(JsonRpcResponse::Error { error, id, .. }) => {
                                        if let Some(tx) = pending_requests.remove(&id) {
                                            let _ = tx.send(Err(error.message));
                                        }
                                    }
                                    Err(e) => {
                                        log::error!("Failed to parse plugin response: {}", e);
                                    }
                                }
                                line_buf.clear();
                            }
                            Err(e) => {
                                log::error!("Failed to read from plugin stdout: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
        });

        Self {
            sender: tx,
            next_id: AtomicU64::new(1),
        }
    }

    async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
            id,
        };

        let (tx, rx) = oneshot::channel();
        self.sender.send((req, tx)).await.map_err(|_| "Plugin process channel closed".to_string())?;

        rx.await.map_err(|_| "Plugin process did not respond".to_string())?
    }
}

pub struct RpcDriver {
    manifest: PluginManifest,
    process: Arc<PluginProcess>,
    data_types: Vec<DataTypeInfo>,
}

impl RpcDriver {
    pub fn new(manifest: PluginManifest, executable_path: PathBuf, data_types: Vec<DataTypeInfo>) -> Self {
        Self {
            manifest,
            process: Arc::new(PluginProcess::new(executable_path)),
            data_types,
        }
    }
}

#[async_trait]
impl DatabaseDriver for RpcDriver {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    fn get_data_types(&self) -> Vec<DataTypeInfo> {
        self.data_types.clone()
    }

    fn build_connection_url(&self, _params: &ConnectionParams) -> Result<String, String> {
        // Plugin drivers manage their own connections — no URL needed.
        Ok(format!("{}://...", self.manifest.id))
    }

    async fn test_connection(&self, params: &ConnectionParams) -> Result<(), String> {
        // Delegate to the plugin process via RPC instead of using sqlx
        let res = self.process.call("test_connection", json!({ "params": params })).await?;
        // If the plugin returns a success response (even null/true), connection is ok
        let _ = res;
        Ok(())
    }

    async fn get_databases(&self, params: &ConnectionParams) -> Result<Vec<String>, String> {
        let res = self.process.call("get_databases", json!({ "params": params })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_schemas(&self, params: &ConnectionParams) -> Result<Vec<String>, String> {
        let res = self.process.call("get_schemas", json!({ "params": params })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_tables(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<TableInfo>, String> {
        let res = self.process.call("get_tables", json!({ "params": params, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_columns(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<TableColumn>, String> {
        let res = self.process.call("get_columns", json!({ "params": params, "table": table, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_foreign_keys(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<ForeignKey>, String> {
        let res = self.process.call("get_foreign_keys", json!({ "params": params, "table": table, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_indexes(&self, params: &ConnectionParams, table: &str, schema: Option<&str>) -> Result<Vec<Index>, String> {
        let res = self.process.call("get_indexes", json!({ "params": params, "table": table, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_views(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<ViewInfo>, String> {
        let res = self.process.call("get_views", json!({ "params": params, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_view_definition(&self, params: &ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<String, String> {
        let res = self.process.call("get_view_definition", json!({ "params": params, "view_name": view_name, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_view_columns(&self, params: &ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<Vec<TableColumn>, String> {
        let res = self.process.call("get_view_columns", json!({ "params": params, "view_name": view_name, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn create_view(&self, params: &ConnectionParams, view_name: &str, definition: &str, schema: Option<&str>) -> Result<(), String> {
        let res = self.process.call("create_view", json!({ "params": params, "view_name": view_name, "definition": definition, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn alter_view(&self, params: &ConnectionParams, view_name: &str, definition: &str, schema: Option<&str>) -> Result<(), String> {
        let res = self.process.call("alter_view", json!({ "params": params, "view_name": view_name, "definition": definition, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn drop_view(&self, params: &ConnectionParams, view_name: &str, schema: Option<&str>) -> Result<(), String> {
        let res = self.process.call("drop_view", json!({ "params": params, "view_name": view_name, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_routines(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<RoutineInfo>, String> {
        let res = self.process.call("get_routines", json!({ "params": params, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_routine_parameters(&self, params: &ConnectionParams, routine_name: &str, schema: Option<&str>) -> Result<Vec<RoutineParameter>, String> {
        let res = self.process.call("get_routine_parameters", json!({ "params": params, "routine_name": routine_name, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_routine_definition(&self, params: &ConnectionParams, routine_name: &str, routine_type: &str, schema: Option<&str>) -> Result<String, String> {
        let res = self.process.call("get_routine_definition", json!({ "params": params, "routine_name": routine_name, "routine_type": routine_type, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn execute_query(&self, params: &ConnectionParams, query: &str, limit: Option<u32>, page: u32, schema: Option<&str>) -> Result<QueryResult, String> {
        let res = self.process.call("execute_query", json!({ "params": params, "query": query, "limit": limit, "page": page, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn insert_record(&self, params: &ConnectionParams, table: &str, data: HashMap<String, serde_json::Value>, schema: Option<&str>, max_blob_size: u64) -> Result<u64, String> {
        let res = self.process.call("insert_record", json!({ "params": params, "table": table, "data": data, "schema": schema, "max_blob_size": max_blob_size })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn update_record(&self, params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, schema: Option<&str>, max_blob_size: u64) -> Result<u64, String> {
        let res = self.process.call("update_record", json!({ "params": params, "table": table, "pk_col": pk_col, "pk_val": pk_val, "col_name": col_name, "new_val": new_val, "schema": schema, "max_blob_size": max_blob_size })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn delete_record(&self, params: &ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, schema: Option<&str>) -> Result<u64, String> {
        let res = self.process.call("delete_record", json!({ "params": params, "table": table, "pk_col": pk_col, "pk_val": pk_val, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_schema_snapshot(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<Vec<TableSchema>, String> {
        let res = self.process.call("get_schema_snapshot", json!({ "params": params, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_all_columns_batch(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<HashMap<String, Vec<TableColumn>>, String> {
        let res = self.process.call("get_all_columns_batch", json!({ "params": params, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }

    async fn get_all_foreign_keys_batch(&self, params: &ConnectionParams, schema: Option<&str>) -> Result<HashMap<String, Vec<ForeignKey>>, String> {
        let res = self.process.call("get_all_foreign_keys_batch", json!({ "params": params, "schema": schema })).await?;
        serde_json::from_value(res).map_err(|e| e.to_string())
    }
}
