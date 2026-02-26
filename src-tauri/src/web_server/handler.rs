use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use super::router::AppState;

#[derive(Deserialize)]
pub struct InvokeRequest {
    pub command: String,
    pub params: Option<Value>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum InvokeResponse {
    Ok(Value),
    Err { error: String },
}

pub async fn invoke_handler(
    State(state): State<AppState>,
    Json(body): Json<InvokeRequest>,
) -> Response {
    let params = body.params.unwrap_or(Value::Object(Default::default()));

    match dispatch_command(&state.app, &body.command, params).await {
        Ok(val) => (StatusCode::OK, Json(val)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
    }
}

/// Dispatch an IPC command to the appropriate Rust function.
pub async fn dispatch_command(
    app: &AppHandle,
    command: &str,
    params: Value,
) -> Result<Value, String> {
    use crate::commands;
    use crate::config;
    use crate::preferences;
    use crate::saved_queries;

    match command {
        // ── Connections ──────────────────────────────────────────────────────
        "get_connections" => {
            let result = commands::get_connections(app.clone()).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "save_connection" => {
            let name = get_string(&params, "name")?;
            let conn_params = serde_json::from_value(
                params.get("params").cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            let result = commands::save_connection(app.clone(), name, conn_params).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "update_connection" => {
            let id = get_string(&params, "id")?;
            let name = get_string(&params, "name")?;
            let conn_params = serde_json::from_value(
                params.get("params").cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            let result = commands::update_connection(app.clone(), id, name, conn_params).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "delete_connection" => {
            let id = get_string(&params, "id")?;
            commands::delete_connection(app.clone(), id).await?;
            Ok(Value::Null)
        }

        "duplicate_connection" => {
            let id = get_string(&params, "id")?;
            let result = commands::duplicate_connection(app.clone(), id).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "test_connection" => {
            // Frontend sends { request: { params, connection_id } }
            let request_val = params
                .get("request")
                .cloned()
                .unwrap_or(params.clone());
            let request = serde_json::from_value(request_val).map_err(|e| e.to_string())?;
            let result = commands::test_connection(app.clone(), request).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "disconnect_connection" => {
            let connection_id = get_string(&params, "connectionId")?;
            commands::disconnect_connection(app.clone(), connection_id).await?;
            Ok(Value::Null)
        }

        // ── Schema / Meta ────────────────────────────────────────────────────
        "list_databases" => {
            // Frontend sends { request: { params, connection_id } }
            let request_val = params
                .get("request")
                .cloned()
                .unwrap_or(params.clone());
            let request = serde_json::from_value(request_val).map_err(|e| e.to_string())?;
            let result = commands::list_databases(app.clone(), request).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_schemas" => {
            let connection_id = get_string(&params, "connectionId")?;
            let result = commands::get_schemas(app.clone(), connection_id).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_tables" => {
            let connection_id = get_string(&params, "connectionId")?;
            let schema = get_opt_string(&params, "schema");
            let result = commands::get_tables(app.clone(), connection_id, schema).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_columns" => {
            let connection_id = get_string(&params, "connectionId")?;
            let table_name = get_string(&params, "tableName")
                .or_else(|_| get_string(&params, "table"))?;
            let schema = get_opt_string(&params, "schema");
            let result =
                commands::get_columns(app.clone(), connection_id, table_name, schema).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_views" => {
            let connection_id = get_string(&params, "connectionId")?;
            let schema = get_opt_string(&params, "schema");
            let result = commands::get_views(app.clone(), connection_id, schema).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_view_definition" => {
            let connection_id = get_string(&params, "connectionId")?;
            let view_name = get_string(&params, "viewName")?;
            let schema = get_opt_string(&params, "schema");
            let result =
                commands::get_view_definition(app.clone(), connection_id, view_name, schema)
                    .await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_foreign_keys" => {
            let connection_id = get_string(&params, "connectionId")?;
            let table_name = get_string(&params, "tableName")
                .or_else(|_| get_string(&params, "table"))?;
            let schema = get_opt_string(&params, "schema");
            let result =
                commands::get_foreign_keys(app.clone(), connection_id, table_name, schema).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_indexes" => {
            let connection_id = get_string(&params, "connectionId")?;
            let table_name = get_string(&params, "tableName")
                .or_else(|_| get_string(&params, "table"))?;
            let schema = get_opt_string(&params, "schema");
            let result =
                commands::get_indexes(app.clone(), connection_id, table_name, schema).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_routines" => {
            let connection_id = get_string(&params, "connectionId")?;
            let schema = get_opt_string(&params, "schema");
            let result = commands::get_routines(app.clone(), connection_id, schema).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        // ── Query ────────────────────────────────────────────────────────────
        "execute_query" => {
            use crate::commands::QueryCancellationState;
            use tauri::Manager;
            let state = app.state::<QueryCancellationState>();
            let connection_id = get_string(&params, "connectionId")?;
            let query = get_string(&params, "query")?;
            let limit = get_opt_u32(&params, "limit");
            let page = get_opt_u32(&params, "page");
            let schema = get_opt_string(&params, "schema");
            let result = commands::execute_query(
                app.clone(),
                state,
                connection_id,
                query,
                limit,
                page,
                schema,
            )
            .await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "cancel_query" => {
            use crate::commands::QueryCancellationState;
            use tauri::Manager;
            let state = app.state::<QueryCancellationState>();
            let connection_id = get_string(&params, "connectionId")?;
            commands::cancel_query(state, connection_id).await?;
            Ok(Value::Null)
        }

        // ── Records ──────────────────────────────────────────────────────────
        "insert_record" => {
            let connection_id = get_string(&params, "connectionId")?;
            let table = get_string(&params, "table")?;
            let schema = get_opt_string(&params, "schema");
            let data = params
                .get("data")
                .cloned()
                .unwrap_or(Value::Object(Default::default()));
            let record_data = serde_json::from_value(data).map_err(|e| e.to_string())?;
            let result =
                commands::insert_record(app.clone(), connection_id, table, record_data, schema)
                    .await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "update_record" => {
            let connection_id = get_string(&params, "connectionId")?;
            let table = get_string(&params, "table")?;
            let schema = get_opt_string(&params, "schema");
            let pk_col = get_string(&params, "pkCol")?;
            let pk_val = params
                .get("pkVal")
                .cloned()
                .unwrap_or(Value::Null);
            let col_name = get_string(&params, "colName")?;
            let new_val = params
                .get("newVal")
                .cloned()
                .unwrap_or(Value::Null);
            let result = commands::update_record(
                app.clone(),
                connection_id,
                table,
                pk_col,
                pk_val,
                col_name,
                new_val,
                schema,
            )
            .await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "delete_record" => {
            let connection_id = get_string(&params, "connectionId")?;
            let table = get_string(&params, "table")?;
            let schema = get_opt_string(&params, "schema");
            let pk_col = get_string(&params, "pkCol")?;
            let pk_val = params
                .get("pkVal")
                .cloned()
                .unwrap_or(Value::Null);
            let result =
                commands::delete_record(app.clone(), connection_id, table, pk_col, pk_val, schema)
                    .await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        // ── Config ───────────────────────────────────────────────────────────
        "get_config" => {
            let result = config::get_config(app.clone());
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "save_config" => {
            let app_config = serde_json::from_value(params).map_err(|e| e.to_string())?;
            config::save_config(app.clone(), app_config)?;
            Ok(Value::Null)
        }

        "get_schema_preference" => {
            let connection_id = get_string(&params, "connectionId")?;
            let result = config::get_schema_preference(app.clone(), connection_id);
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "set_schema_preference" => {
            let connection_id = get_string(&params, "connectionId")?;
            let schema = get_string(&params, "schema")?;
            config::set_schema_preference(app.clone(), connection_id, schema)?;
            Ok(Value::Null)
        }

        "get_selected_schemas" => {
            let connection_id = get_string(&params, "connectionId")?;
            let result = config::get_selected_schemas(app.clone(), connection_id);
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "set_selected_schemas" => {
            let connection_id = get_string(&params, "connectionId")?;
            let schemas: Vec<String> = serde_json::from_value(
                params.get("schemas").cloned().unwrap_or(Value::Array(vec![])),
            )
            .map_err(|e| e.to_string())?;
            config::set_selected_schemas(app.clone(), connection_id, schemas)?;
            Ok(Value::Null)
        }

        // ── Saved Queries ────────────────────────────────────────────────────
        "get_saved_queries" => {
            let connection_id = get_string(&params, "connectionId")?;
            let result = saved_queries::get_saved_queries(app.clone(), connection_id).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "save_query" => {
            let connection_id = get_string(&params, "connectionId")?;
            let name = get_string(&params, "name")?;
            let sql = get_string(&params, "sql")?;
            let result = saved_queries::save_query(app.clone(), connection_id, name, sql).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "update_saved_query" => {
            let id = get_string(&params, "id")?;
            let name = get_string(&params, "name")?;
            let sql = get_string(&params, "sql")?;
            saved_queries::update_saved_query(app.clone(), id, name, sql).await?;
            Ok(Value::Null)
        }

        "delete_saved_query" => {
            let id = get_string(&params, "id")?;
            saved_queries::delete_saved_query(app.clone(), id).await?;
            Ok(Value::Null)
        }

        // ── Drivers ──────────────────────────────────────────────────────────
        "get_registered_drivers" => {
            let result = commands::get_registered_drivers().await;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "get_driver_manifest" => {
            let driver_id = get_string(&params, "driverId")?;
            let result = commands::get_driver_manifest(driver_id).await;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        // ── SSH Connections ──────────────────────────────────────────────────
        "get_ssh_connections" => {
            let result = commands::get_ssh_connections(app.clone()).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "save_ssh_connection" => {
            let name = get_string(&params, "name")?;
            let ssh = serde_json::from_value(
                params.get("ssh").cloned().unwrap_or(params.clone()),
            )
            .map_err(|e| e.to_string())?;
            let result = commands::save_ssh_connection(app.clone(), name, ssh).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "delete_ssh_connection" => {
            let id = get_string(&params, "id")?;
            commands::delete_ssh_connection(app.clone(), id).await?;
            Ok(Value::Null)
        }

        "test_ssh_connection" => {
            // Frontend sends { ssh: { host, port, user, ..., connection_id } }
            let ssh_val = params.get("ssh").cloned().unwrap_or(params.clone());
            let test_params = serde_json::from_value(ssh_val).map_err(|e| e.to_string())?;
            let result = commands::test_ssh_connection(app.clone(), test_params).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        // ── Preferences ──────────────────────────────────────────────────────
        "get_editor_preferences" | "load_editor_preferences" => {
            let connection_id = get_string(&params, "connectionId")?;
            let result = preferences::load_editor_preferences(connection_id).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }

        "save_editor_preferences" => {
            let connection_id = get_string(&params, "connectionId")?;
            let prefs = serde_json::from_value(
                params.get("preferences").cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            preferences::save_editor_preferences(connection_id, prefs).await?;
            Ok(Value::Null)
        }

        // ── No-ops (desktop-only features) ───────────────────────────────────
        "set_window_title" | "open_devtools" | "close_devtools" | "open_er_diagram_window" => {
            Ok(Value::Null)
        }

        _ => Err(format!(
            "Command '{}' is not supported in Remote Control mode",
            command
        )),
    }
}

// ── Param helpers ────────────────────────────────────────────────────────────

fn get_string(params: &Value, key: &str) -> Result<String, String> {
    params
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Missing required parameter: {}", key))
}

fn get_opt_string(params: &Value, key: &str) -> Option<String> {
    params
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn get_opt_u32(params: &Value, key: &str) -> Option<u32> {
    params.get(key).and_then(|v| v.as_u64()).map(|n| n as u32)
}
