import re

files = [
    'src-tauri/src/drivers/mysql/mod.rs',
    'src-tauri/src/drivers/postgres/mod.rs',
    'src-tauri/src/drivers/sqlite/mod.rs'
]

for file in files:
    content = open(file).read()
    
    # fix insert_record
    content = re.sub(
        r'async fn insert_record\(&self, params: &crate::models::ConnectionParams, table: &str, data: serde_json::Value, (_\w+|schema): Option<&str>\) -> Result<u64, String> \{[\s\S]*?\}',
        r'''async fn insert_record(&self, params: &crate::models::ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>, \1: Option<&str>, max_blob_size: u64) -> Result<u64, String> {
        insert_record(params, table, data, max_blob_size).await
    }''' if 'mysql' in file or 'sqlite' in file else r'''async fn insert_record(&self, params: &crate::models::ConnectionParams, table: &str, data: std::collections::HashMap<String, serde_json::Value>, \1: Option<&str>, max_blob_size: u64) -> Result<u64, String> {
        insert_record(params, table, data, self.resolve_schema(\1), max_blob_size).await
    }''',
        content
    )
    
    # fix update_record
    content = re.sub(
        r'async fn update_record\(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, (_\w+|schema): Option<&str>\) -> Result<u64, String> \{[\s\S]*?\}',
        r'''async fn update_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, \1: Option<&str>, max_blob_size: u64) -> Result<u64, String> {
        update_record(params, table, pk_col, pk_val, col_name, new_val, max_blob_size).await
    }''' if 'mysql' in file or 'sqlite' in file else r'''async fn update_record(&self, params: &crate::models::ConnectionParams, table: &str, pk_col: &str, pk_val: serde_json::Value, col_name: &str, new_val: serde_json::Value, \1: Option<&str>, max_blob_size: u64) -> Result<u64, String> {
        update_record(params, table, pk_col, pk_val, col_name, new_val, self.resolve_schema(\1), max_blob_size).await
    }''',
        content
    )
    
    open(file, 'w').write(content)

