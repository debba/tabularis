use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ConnectionParams {
    pub driver: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub database: String,
    // SSH Tunnel
    pub ssh_enabled: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_user: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_key_file: Option<String>,
    pub save_in_keychain: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub params: ConnectionParams,
}

#[derive(Debug, Serialize)]
pub struct TableInfo {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct TableColumn {
    pub name: String,
    pub data_type: String,
    pub is_pk: bool,
    pub is_nullable: bool,
    pub is_auto_increment: bool,
}

#[derive(Debug, Serialize)]
pub struct ForeignKey {
    pub name: String,
    pub column_name: String,
    pub ref_table: String,
    pub ref_column: String,
    pub on_delete: Option<String>,
    pub on_update: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Index {
    pub name: String,
    pub column_name: String,
    pub is_unique: bool,
    pub is_primary: bool,
    pub seq_in_index: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Pagination {
    pub page: u32,
    pub page_size: u32,
    pub total_rows: u64,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: u64,
    #[serde(default)]
    pub truncated: bool,
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Serialize)]
pub struct TableSchema {
    pub name: String,
    pub columns: Vec<TableColumn>,
    pub foreign_keys: Vec<ForeignKey>,
}
