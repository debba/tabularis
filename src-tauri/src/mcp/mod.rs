use std::io::{self, BufRead, Write};
use serde_json::json;
use crate::commands;
use crate::persistence;
use crate::paths;
use crate::drivers::{mysql, postgres, sqlite};

pub mod protocol;
pub mod install;
use protocol::*;

pub async fn run_mcp_server() {
    eprintln!("[MCP] Starting Tabularis MCP Server...");
    
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut iterator = stdin.lock().lines();

    while let Some(line_result) = iterator.next() {
        match line_result {
            Ok(line) => {
                if line.trim().is_empty() {
                    continue;
                }
                
                // Log input to stderr for debugging
                eprintln!("[MCP] Received: {}", line);
                
                match serde_json::from_str::<JsonRpcRequest>(&line) {
                    Ok(request) => {
                        let response = handle_request(request).await;
                        if let Some(resp) = response {
                            let json = serde_json::to_string(&resp).unwrap();
                            // Log output to stderr
                            eprintln!("[MCP] Sending: {}", json);
                            stdout.write_all(json.as_bytes()).unwrap();
                            stdout.write_all(b"\n").unwrap();
                            stdout.flush().unwrap();
                        }
                    }
                    Err(e) => {
                        eprintln!("[MCP] Error parsing JSON: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("[MCP] Error reading stdin: {}", e);
                break;
            }
        }
    }
}

async fn handle_request(req: JsonRpcRequest) -> Option<JsonRpcResponse> {
    // Notifications (no id)
    if req.id.is_none() {
        if req.method == "notifications/initialized" {
            eprintln!("[MCP] Client initialized.");
        }
        return None;
    }

    let id = req.id.clone();
    let result = match req.method.as_str() {
        "initialize" => handle_initialize(req.params),
        "resources/list" => handle_list_resources().await,
        "resources/read" => handle_read_resource(req.params).await,
        "tools/list" => handle_list_tools(),
        "tools/call" => handle_call_tool(req.params).await,
        _ => Err(JsonRpcError {
            code: -32601,
            message: "Method not found".to_string(),
            data: None,
        }),
    };

    let (res, err) = match result {
        Ok(val) => (Some(val), None),
        Err(e) => (None, Some(e)),
    };

    Some(JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id,
        result: res,
        error: err,
    })
}

fn handle_initialize(_params: Option<serde_json::Value>) -> Result<serde_json::Value, JsonRpcError> {
    let result = InitializeResult {
        protocolVersion: "2024-11-05".to_string(), 
        capabilities: ServerCapabilities {
            resources: Some(json!({ "listChanged": false })),
            tools: Some(json!({ "listChanged": false })),
            prompts: None,
        },
        serverInfo: ServerInfo {
            name: "tabularis-mcp".to_string(),
            version: "0.1.0".to_string(),
        },
    };
    Ok(serde_json::to_value(result).unwrap())
}

async fn handle_list_resources() -> Result<serde_json::Value, JsonRpcError> {
    let config_path = paths::get_app_config_dir().join("connections.json");
    let connections = persistence::load_connections(&config_path)
        .map_err(|e| JsonRpcError {
            code: -32000,
            message: format!("Failed to load connections: {}", e),
            data: None
        })?;

    let mut resources = Vec::new();
    
    // Add connection list resource
    resources.push(Resource {
        uri: "tabularis://connections".to_string(),
        name: "Connections List".to_string(),
        description: Some("List of all configured database connections".to_string()),
        mimeType: Some("application/json".to_string()),
    });

    // Add schema resources for each connection
    for conn in connections {
        resources.push(Resource {
            uri: format!("tabularis://{}/schema", conn.id),
            name: format!("Schema: {}", conn.name),
            description: Some(format!("Database schema for {}", conn.name)),
            mimeType: Some("application/json".to_string()),
        });
    }

    Ok(json!({
        "resources": resources
    }))
}

async fn handle_read_resource(params: Option<serde_json::Value>) -> Result<serde_json::Value, JsonRpcError> {
    let params = params.ok_or(JsonRpcError {
        code: -32602,
        message: "Missing params".to_string(),
        data: None,
    })?;
    
    let uri = params["uri"].as_str().ok_or(JsonRpcError {
        code: -32602,
        message: "Missing uri".to_string(),
        data: None,
    })?;

    if uri == "tabularis://connections" {
        let config_path = paths::get_app_config_dir().join("connections.json");
        let connections = persistence::load_connections(&config_path)
            .map_err(|e| JsonRpcError { code: -32000, message: e, data: None })?;
        
        let safe_list: Vec<_> = connections.iter().map(|c| json!({
            "id": c.id,
            "name": c.name,
            "driver": c.params.driver,
            "host": c.params.host,
            "database": c.params.database
        })).collect();

        return Ok(json!({
            "contents": [{
                "uri": uri,
                "mimeType": "application/json",
                "text": serde_json::to_string_pretty(&safe_list).unwrap()
            }]
        }));
    }

    if uri.starts_with("tabularis://") && uri.ends_with("/schema") {
        let parts: Vec<&str> = uri.split('/').collect();
        // uri format: tabularis://{id}/schema -> ["tabularis:", "", "{id}", "schema"]
        if parts.len() < 4 {
             return Err(JsonRpcError { code: -32602, message: "Invalid URI format".to_string(), data: None });
        }
        let conn_id = parts[2];
        
        let config_path = paths::get_app_config_dir().join("connections.json");
        let connections = persistence::load_connections(&config_path)
            .map_err(|e| JsonRpcError { code: -32000, message: e, data: None })?;

        let conn = connections.iter().find(|c| c.id == conn_id || c.name == conn_id).ok_or(JsonRpcError {
            code: -32000,
            message: format!("Connection not found: {}", conn_id),
            data: None
        })?;

        let params = commands::resolve_connection_params(&conn.params).map_err(|e| JsonRpcError {
            code: -32000,
            message: e,
            data: None
        })?;

        let tables = match conn.params.driver.as_str() {
             "mysql" => mysql::get_tables(&params).await,
             "postgres" => postgres::get_tables(&params).await,
             "sqlite" => sqlite::get_tables(&params).await,
             _ => Err("Unsupported driver".into()),
        }.map_err(|e| JsonRpcError { code: -32000, message: e, data: None })?;

        // Format as simplified DDL or JSON
        let schema_json = serde_json::to_string_pretty(&tables).unwrap();

        return Ok(json!({
            "contents": [{
                "uri": uri,
                "mimeType": "application/json",
                "text": schema_json
            }]
        }));
    }

    Err(JsonRpcError {
        code: -32602,
        message: "Resource not found".to_string(),
        data: None,
    })
}

fn handle_list_tools() -> Result<serde_json::Value, JsonRpcError> {
    let tools = vec![
        Tool {
            name: "run_query".to_string(),
            description: Some("Execute a SQL query on a specific connection".to_string()),
            inputSchema: json!({
                "type": "object",
                "properties": {
                    "connection_id": { "type": "string", "description": "The ID or Name of the connection (from tabularis://connections)" },
                    "query": { "type": "string", "description": "The SQL query to execute" }
                },
                "required": ["connection_id", "query"]
            }),
        }
    ];

    Ok(json!({
        "tools": tools
    }))
}

async fn handle_call_tool(params: Option<serde_json::Value>) -> Result<serde_json::Value, JsonRpcError> {
    let params = params.ok_or(JsonRpcError { code: -32602, message: "Missing params".to_string(), data: None })?;
    let name = params["name"].as_str().unwrap_or("");
    let args = params["arguments"].as_object().ok_or(JsonRpcError { code: -32602, message: "Missing arguments".to_string(), data: None })?;

    if name == "run_query" {
        let conn_id = args.get("connection_id").and_then(|v| v.as_str()).ok_or(JsonRpcError {
            code: -32602, message: "Missing connection_id".to_string(), data: None
        })?;
        let query = args.get("query").and_then(|v| v.as_str()).ok_or(JsonRpcError {
            code: -32602, message: "Missing query".to_string(), data: None
        })?;

        let config_path = paths::get_app_config_dir().join("connections.json");
        let connections = persistence::load_connections(&config_path)
             .map_err(|e| JsonRpcError { code: -32000, message: e, data: None })?;

        let conn = connections.iter().find(|c| c.id == conn_id || c.name == conn_id).ok_or(JsonRpcError {
            code: -32000,
            message: format!("Connection not found: {}", conn_id),
            data: None
        })?;

        let db_params = commands::resolve_connection_params(&conn.params).map_err(|e| JsonRpcError {
            code: -32000,
            message: e,
            data: None
        })?;

        let result = match conn.params.driver.as_str() {
             "mysql" => mysql::execute_query(&db_params, query, Some(100), 1).await,
             "postgres" => postgres::execute_query(&db_params, query, Some(100), 1).await,
             "sqlite" => sqlite::execute_query(&db_params, query, Some(100), 1).await,
             _ => Err("Unsupported driver".into()),
        }.map_err(|e| JsonRpcError { code: -32000, message: e, data: None })?;

        return Ok(json!({
            "content": [{
                "type": "text",
                "text": serde_json::to_string_pretty(&result).unwrap()
            }]
        }));
    }

    Err(JsonRpcError {
        code: -32601,
        message: "Tool not found".to_string(),
        data: None,
    })
}
