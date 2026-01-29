use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<Value>,
    pub id: Option<Value>, // Can be null (notification)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// --- MCP Types ---

#[derive(Serialize, Deserialize, Debug)]
pub struct InitializeParams {
    pub protocolVersion: String,
    pub capabilities: Value,
    pub clientInfo: ClientInfo,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InitializeResult {
    pub protocolVersion: String,
    pub capabilities: ServerCapabilities,
    pub serverInfo: ServerInfo,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ServerCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<Value>, // e.g., { "listChanged": true }
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Value>, // e.g., { "listChanged": true }
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Resource {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
    pub mimeType: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ResourceContent {
    pub uri: String,
    pub mimeType: Option<String>,
    pub text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Tool {
    pub name: String,
    pub description: Option<String>,
    pub inputSchema: Value, // JSON Schema
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CallToolParams {
    pub name: String,
    pub arguments: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CallToolResult {
    pub content: Vec<ToolContent>,
    pub isError: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ToolContent {
    pub r#type: String, // "text"
    pub text: String,
}
