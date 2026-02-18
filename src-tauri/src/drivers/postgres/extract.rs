use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use rust_decimal::Decimal;
use sqlx::Row;
use uuid::Uuid;

/// Maximum size in bytes for BLOB data to extract
/// BLOBs larger than this will be truncated and metadata will be included
const MAX_BLOB_PREVIEW_SIZE: usize = 512; // Only extract first 512 bytes for MIME detection

/// Extract value from PostgreSQL row
pub fn extract_value(row: &sqlx::postgres::PgRow, index: usize) -> serde_json::Value {
    use sqlx::ValueRef;

    // Check for NULL first
    if let Ok(val_ref) = row.try_get_raw(index) {
        if val_ref.is_null() {
            return serde_json::Value::Null;
        }
    }

    // DateTime types FIRST
    if let Ok(v) = row.try_get::<DateTime<Utc>, _>(index) {
        return serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Ok(v) = row.try_get::<NaiveDateTime, _>(index) {
        return serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Ok(v) = row.try_get::<NaiveDate, _>(index) {
        return serde_json::Value::String(v.to_string());
    }
    if let Ok(v) = row.try_get::<NaiveTime, _>(index) {
        return serde_json::Value::String(v.to_string());
    }

    // Signed integers only
    if let Ok(v) = row.try_get::<i64, _>(index) {
        return serde_json::Value::from(v);
    }
    if let Ok(v) = row.try_get::<i32, _>(index) {
        return serde_json::Value::from(v);
    }
    if let Ok(v) = row.try_get::<i16, _>(index) {
        return serde_json::Value::from(v);
    }

    // Decimal
    if let Ok(v) = row.try_get::<Decimal, _>(index) {
        return serde_json::Value::String(v.to_string());
    }

    // Floating point
    if let Ok(v) = row.try_get::<f64, _>(index) {
        return serde_json::Number::from_f64(v)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null);
    }
    if let Ok(v) = row.try_get::<f32, _>(index) {
        return serde_json::Number::from_f64(v as f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null);
    }

    // Boolean
    if let Ok(v) = row.try_get::<bool, _>(index) {
        return serde_json::Value::from(v);
    }

    // String
    if let Ok(v) = row.try_get::<String, _>(index) {
        return serde_json::Value::from(v);
    }

    // UUID
    if let Ok(v) = row.try_get::<Uuid, _>(index) {
        return serde_json::Value::String(v.to_string());
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

    // JSON
    if let Ok(v) = row.try_get::<serde_json::Value, _>(index) {
        return v;
    }

    serde_json::Value::Null
}
