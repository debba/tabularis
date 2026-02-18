/// Maximum size in bytes for BLOB data to include as base64 preview.
/// All blobs are serialised as "BLOB:<size>:<mime_type>:<base64_data>".
/// For blobs larger than this threshold only the first N bytes are included;
/// smaller blobs are encoded in full.
pub const MAX_BLOB_PREVIEW_SIZE: usize = 4096;

/// Encodes a blob byte slice into the canonical wire format used by all drivers.
/// Format: "BLOB:<total_size_bytes>:<mime_type>:<base64_data>"
pub fn encode_blob(data: &[u8]) -> String {
    let total_size = data.len();
    let preview = if total_size > MAX_BLOB_PREVIEW_SIZE {
        &data[..MAX_BLOB_PREVIEW_SIZE]
    } else {
        data
    };

    let mime_type = infer::get(preview)
        .map(|k| k.mime_type())
        .unwrap_or("application/octet-stream");

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, preview);

    format!("BLOB:{}:{}:{}", total_size, mime_type, b64)
}

/// Encodes a blob byte slice into the canonical wire format encoding ALL bytes.
/// Unlike `encode_blob` which truncates to MAX_BLOB_PREVIEW_SIZE for the read
/// path, this function preserves the complete data — used by upload / write paths
/// so that files larger than 4KB are not silently truncated.
pub fn encode_blob_full(data: &[u8]) -> String {
    let total_size = data.len();

    let mime_type = infer::get(data)
        .map(|k| k.mime_type())
        .unwrap_or("application/octet-stream");

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, data);

    format!("BLOB:{}:{}:{}", total_size, mime_type, b64)
}

/// Resolves a BLOB_FILE_REF to actual bytes by reading from disk.
/// Format: "BLOB_FILE_REF:<size>:<mime>:<filepath>"
/// Returns the raw file bytes, or an error if the file cannot be read.
pub fn resolve_blob_file_ref(value: &str) -> Result<Vec<u8>, String> {
    let rest = value
        .strip_prefix("BLOB_FILE_REF:")
        .ok_or_else(|| "Not a BLOB_FILE_REF".to_string())?;

    // Parse: <size>:<mime>:<filepath>
    let parts: Vec<&str> = rest.splitn(3, ':').collect();
    if parts.len() != 3 {
        return Err("Invalid BLOB_FILE_REF format".to_string());
    }

    let file_path = parts[2];

    // Read file from disk
    std::fs::read(file_path).map_err(|e| format!("Failed to read BLOB file: {}", e))
}

/// Decodes the canonical blob wire format back to raw bytes.
///
/// Expected format: "BLOB:<total_size_bytes>:<mime_type>:<base64_data>"
/// or "BLOB_FILE_REF:<size>:<mime>:<filepath>"
///
/// Returns `Some(Vec<u8>)` with the decoded bytes if the string matches the
/// wire format, or `None` if it is a plain string that should be stored as-is.
/// This is used by all write paths (update_record / insert_record) so that the
/// database always receives raw binary data instead of the internal wire format
/// string, ensuring interoperability with other SQL editors.
pub fn decode_blob_wire_format(value: &str) -> Option<Vec<u8>> {
    // Handle BLOB_FILE_REF first
    if value.starts_with("BLOB_FILE_REF:") {
        return resolve_blob_file_ref(value).ok();
    }

    // Format: "BLOB:<digits>:<mime_type>:<base64_data>"
    // MIME type can contain letters, digits, dots, plus, hyphens, slashes
    let rest = value.strip_prefix("BLOB:")?;

    // Skip the size field
    let after_size = rest.splitn(2, ':').nth(1)?;

    // Skip the mime field — split only on the first colon after mime
    let base64_data = after_size.splitn(2, ':').nth(1)?;

    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, base64_data).ok()
}

/// Check if a query is a SELECT statement
pub fn is_select_query(query: &str) -> bool {
    query.trim_start().to_uppercase().starts_with("SELECT")
}

/// Calculate offset for pagination
pub fn calculate_offset(page: u32, page_size: u32) -> u32 {
    (page - 1) * page_size
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_blob_wire_format_valid() {
        // Encode some known bytes, then verify decode round-trips correctly
        let original = b"hello blob";
        let encoded = encode_blob(original);
        let decoded = decode_blob_wire_format(&encoded).expect("should decode valid wire format");
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_decode_blob_wire_format_not_wire_format() {
        assert!(decode_blob_wire_format("plain string").is_none());
        assert!(decode_blob_wire_format("BLOB_NOT_VALID").is_none());
        assert!(decode_blob_wire_format("").is_none());
        assert!(decode_blob_wire_format("__USE_DEFAULT__").is_none());
    }

    #[test]
    fn test_decode_blob_wire_format_truncated_preview() {
        // Even if the wire format contains only a truncated preview, the decoded
        // bytes should equal the preview portion (first MAX_BLOB_PREVIEW_SIZE bytes)
        let data: Vec<u8> = (0u8..=255u8).cycle().take(8192).collect();
        let wire = encode_blob(&data);
        let decoded = decode_blob_wire_format(&wire).expect("should decode truncated wire format");
        assert_eq!(decoded, &data[..MAX_BLOB_PREVIEW_SIZE]);
    }

    #[test]
    fn test_decode_blob_wire_format_composite_mime() {
        // MIME types with plus signs (e.g. image/svg+xml) must be handled correctly
        let svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
        let wire = encode_blob(svg);
        let decoded = decode_blob_wire_format(&wire).expect("should decode svg wire format");
        assert_eq!(decoded, svg);
    }

    #[test]
    fn test_is_select_query() {
        assert!(is_select_query("SELECT * FROM users"));
        assert!(is_select_query("  select * from users"));
        assert!(is_select_query("\n\tSELECT id FROM posts"));
        assert!(!is_select_query("UPDATE users SET name = 'test'"));
        assert!(!is_select_query("DELETE FROM users"));
        assert!(!is_select_query("INSERT INTO users VALUES (1)"));
    }

    #[test]
    fn test_calculate_offset() {
        assert_eq!(calculate_offset(1, 100), 0);
        assert_eq!(calculate_offset(2, 100), 100);
        assert_eq!(calculate_offset(3, 50), 100);
        assert_eq!(calculate_offset(10, 25), 225);
    }

    #[test]
    fn test_encode_blob_full_preserves_all_data() {
        // 8KB of data — encode_blob would truncate, encode_blob_full must not
        let data: Vec<u8> = (0u8..=255u8).cycle().take(8192).collect();
        let wire = encode_blob_full(&data);
        let decoded = decode_blob_wire_format(&wire).expect("should decode full wire format");
        assert_eq!(decoded.len(), 8192);
        assert_eq!(decoded, data);
    }

    #[test]
    fn test_encode_blob_full_small_data_matches_encode_blob() {
        // For data smaller than MAX_BLOB_PREVIEW_SIZE both functions must produce
        // identical output since no truncation occurs.
        let data = b"small payload";
        assert_eq!(encode_blob_full(data), encode_blob(data));
    }

    #[test]
    fn test_encode_blob_full_roundtrip_large() {
        // Simulate a real file upload: 50KB of pseudo-random data
        let data: Vec<u8> = (0..50_000).map(|i| (i % 256) as u8).collect();
        let wire = encode_blob_full(&data);

        // Wire format header must report the real size
        assert!(wire.starts_with(&format!("BLOB:{}:", data.len())));

        // Round-trip through decode must yield identical bytes
        let decoded = decode_blob_wire_format(&wire).expect("should decode 50KB wire format");
        assert_eq!(decoded, data);
    }
}
