use sqlx::Row;

/// Maximum size in bytes for BLOB data to extract
/// BLOBs larger than this will be truncated and metadata will be included
const MAX_BLOB_PREVIEW_SIZE: usize = 512; // Only extract first 512 bytes for MIME detection

/// Extract value from SQLite row
pub fn extract_value(row: &sqlx::sqlite::SqliteRow, index: usize) -> serde_json::Value {
    use sqlx::ValueRef;

    // Check for NULL first
    if let Ok(val_ref) = row.try_get_raw(index) {
        if val_ref.is_null() {
            return serde_json::Value::Null;
        }
    }

    // String first (SQLite stores dates as text)
    if let Ok(v) = row.try_get::<String, _>(index) {
        return serde_json::Value::from(v);
    }

    // Integers
    if let Ok(v) = row.try_get::<i64, _>(index) {
        return serde_json::Value::from(v);
    }
    if let Ok(v) = row.try_get::<i32, _>(index) {
        return serde_json::Value::from(v);
    }

    // Floating point
    if let Ok(v) = row.try_get::<f64, _>(index) {
        return serde_json::Number::from_f64(v)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null);
    }

    // Boolean
    if let Ok(v) = row.try_get::<bool, _>(index) {
        return serde_json::Value::from(v);
    }

    // Binary data
    if let Ok(v) = row.try_get::<Vec<u8>, _>(index) {
        let blob_size = v.len();

        // For small BLOBs, encode fully
        if blob_size <= MAX_BLOB_PREVIEW_SIZE {
            return serde_json::Value::String(base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                v,
            ));
        }

        // For large BLOBs, only extract preview for MIME detection
        // Format: "BLOB:<size_in_bytes>:<base64_preview>"
        let preview_bytes = &v[..MAX_BLOB_PREVIEW_SIZE];
        let preview_base64 =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, preview_bytes);

        return serde_json::Value::String(format!("BLOB:{}:{}", blob_size, preview_base64));
    }

    serde_json::Value::Null
}
