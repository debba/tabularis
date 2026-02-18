/**
 * Utility functions for handling BLOB data types.
 * MIME detection is performed exclusively on the backend via the `infer` crate.
 * All blob values arrive from the backend in the canonical wire format:
 *   "BLOB:<total_size_bytes>:<mime_type>:<base64_data>"
 */

/**
 * Checks if a data type is a BLOB/binary type.
 * Supports MySQL, PostgreSQL, and SQLite binary types.
 */
export function isBlobType(dataType: string): boolean {
  if (!dataType) {
    return false;
  }

  const normalizedType = dataType.toUpperCase();

  const binaryTypes = [
    "BLOB",
    "TINYBLOB",
    "MEDIUMBLOB",
    "LONGBLOB",
    "BINARY",
    "VARBINARY",
    "BYTEA", // PostgreSQL
  ];

  return binaryTypes.some((type) => normalizedType.includes(type));
}

/**
 * Formats a byte size into a human-readable string.
 */
function formatBlobSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = bytes / Math.pow(k, i);

  if (i === 0) {
    return `${size} ${units[i]}`;
  }

  return `${size.toFixed(2)} ${units[i]}`;
}

export interface BlobMetadata {
  mimeType: string;
  size: number;
  formattedSize: string;
  isBase64: boolean;
  isTruncated?: boolean;
}

/**
 * Extracts BLOB metadata from a value produced by the backend.
 *
 * Expected wire formats: 
 *   - "BLOB:<size_bytes>:<mime_type>:<base64_data>"
 *   - "BLOB_FILE_REF:<size>:<mime>:<filepath>"
 *
 * Returns null for null/undefined values.
 * Returns a text/plain metadata object for plain-text strings that are not
 * in the BLOB wire format (e.g. BLOBs that contained valid UTF-8 text and
 * were returned as-is by the backend).
 */
export function extractBlobMetadata(value: unknown): BlobMetadata | null {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value);

  // Handle BLOB_FILE_REF format: "BLOB_FILE_REF:<size>:<mime>:<filepath>"
  if (stringValue.startsWith("BLOB_FILE_REF:")) {
    const firstColon = 14; // right after "BLOB_FILE_REF:"
    const secondColon = stringValue.indexOf(":", firstColon);
    const thirdColon = stringValue.indexOf(":", secondColon + 1);
    if (secondColon !== -1 && thirdColon !== -1) {
      const size = parseInt(stringValue.substring(firstColon, secondColon), 10);
      const mimeType = stringValue.substring(secondColon + 1, thirdColon);

      return {
        mimeType,
        size,
        formattedSize: formatBlobSize(size),
        isBase64: false, // It's a file reference, not base64
        isTruncated: false, // File refs are never truncated
      };
    }
  }

  // Canonical wire format: "BLOB:<size>:<mime_type>:<base64_data>"
  // Parse by colon positions instead of regex to avoid allocating a copy of
  // the (potentially huge) base64 payload — only the length is needed here.
  if (stringValue.startsWith("BLOB:")) {
    const firstColon = 5; // right after "BLOB:"
    const secondColon = stringValue.indexOf(":", firstColon);
    const thirdColon = stringValue.indexOf(":", secondColon + 1);
    if (secondColon !== -1 && thirdColon !== -1) {
      const size = parseInt(stringValue.substring(firstColon, secondColon), 10);
      const mimeType = stringValue.substring(secondColon + 1, thirdColon);
      const base64Length = stringValue.length - thirdColon - 1;
      const isTruncated = size > (base64Length * 3) / 4;

      return {
        mimeType,
        size,
        formattedSize: formatBlobSize(size),
        isBase64: true,
        isTruncated,
      };
    }
  }

  // Plain-text blob (backend returned UTF-8 decoded content directly)
  const size = new Blob([stringValue]).size;

  return {
    mimeType: "text/plain",
    size,
    formattedSize: formatBlobSize(size),
    isBase64: false,
    isTruncated: false,
  };
}

/**
 * Maps a MIME type string to a file extension.
 */
export function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/x-icon": "ico",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/gzip": "gz",
    "application/x-tar": "tar",
    "application/x-7z-compressed": "7z",
    "application/vnd.rar": "rar",
    "application/x-rar-compressed": "rar",
    "application/x-bzip2": "bz2",
    "application/x-xz": "xz",
    "application/json": "json",
    "application/xml": "xml",
    "application/octet-stream": "bin",
    "application/x-sqlite3": "sqlite",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/x-matroska": "mkv",
    "video/quicktime": "mov",
    "video/avi": "avi",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/flac": "flac",
    "audio/aac": "aac",
    "text/plain": "txt",
    "text/html": "html",
    "text/csv": "csv",
    "font/woff": "woff",
    "font/woff2": "woff2",
    "font/ttf": "ttf",
    "font/otf": "otf",
  };
  return map[mimeType] ?? mimeType.split("/")[1]?.replace(/[^a-z0-9]/g, "") ?? "bin";
}

/**
 * Formats a BLOB value for display in the DataGrid.
 * Shows MIME type and size instead of raw data.
 */
export function formatBlobValue(value: unknown, dataType: string): string {
  if (!isBlobType(dataType)) {
    return String(value ?? "");
  }

  const metadata = extractBlobMetadata(value);

  if (!metadata) {
    return "NULL";
  }

  return `${metadata.mimeType} (${metadata.formattedSize})`;
}
