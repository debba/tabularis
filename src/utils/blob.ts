/**
 * Utility functions for handling BLOB data types
 * Provides functionality to detect and format binary data safely
 */

/**
 * Checks if a data type is a BLOB/binary type
 * Supports MySQL, PostgreSQL, and SQLite binary types
 */
export function isBlobType(dataType: string): boolean {
  if (!dataType) {
    return false;
  }

  const normalizedType = dataType.toUpperCase();

  // Binary types across different databases
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
 * Detects the MIME type from base64-encoded data by reading the magic bytes
 * @param base64Data - The base64-encoded binary data
 * @returns MIME type string (e.g., "image/png", "application/pdf") or "application/octet-stream" as fallback
 */
export function detectMimeTypeFromBase64(base64Data: string): string {
  try {
    // Decode the first few bytes to check magic numbers
    const binaryString = atob(base64Data.substring(0, 32));
    const bytes: number[] = [];

    for (let i = 0; i < Math.min(binaryString.length, 12); i++) {
      bytes.push(binaryString.charCodeAt(i));
    }

    // Check magic numbers for common file types
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }

    // GIF: 47 49 46 38
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return "image/gif";
    }

    // PDF: 25 50 44 46
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return "application/pdf";
    }

    // ZIP: 50 4B 03 04 or 50 4B 05 06
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      if (bytes[2] === 0x03 && bytes[3] === 0x04) {
        return "application/zip";
      }
      if (bytes[2] === 0x05 && bytes[3] === 0x06) {
        return "application/zip";
      }
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }

    // BMP: 42 4D
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return "image/bmp";
    }

    // TIFF: 49 49 2A 00 or 4D 4D 00 2A
    if (
      (bytes[0] === 0x49 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x2a &&
        bytes[3] === 0x00) ||
      (bytes[0] === 0x4d &&
        bytes[1] === 0x4d &&
        bytes[2] === 0x00 &&
        bytes[3] === 0x2a)
    ) {
      return "image/tiff";
    }

    // MP4: starts with specific bytes at offset 4
    if (bytes.length >= 12) {
      const ftyp =
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70;
      if (ftyp) {
        return "video/mp4";
      }
    }

    // Check if it looks like JSON (starts with { or [)
    if (bytes[0] === 0x7b || bytes[0] === 0x5b) {
      return "application/json";
    }

    // Check if it looks like XML (starts with <)
    if (bytes[0] === 0x3c) {
      return "application/xml";
    }

    return "application/octet-stream";
  } catch (error) {
    console.warn("Failed to detect MIME type:", error);
    return "application/octet-stream";
  }
}

/**
 * Formats a byte size into a human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.54 MB", "627.12 KB")
 */
export function formatBlobSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = bytes / Math.pow(k, i);

  // For bytes, show no decimals
  if (i === 0) {
    return `${size} ${units[i]}`;
  }

  // For other units, show 2 decimal places
  return `${size.toFixed(2)} ${units[i]}`;
}

/**
 * Calculates the size of base64-encoded data in bytes
 * @param base64Data - The base64 string
 * @returns Size in bytes
 */
export function getBase64Size(base64Data: string): number {
  // Remove padding characters
  const withoutPadding = base64Data.replace(/=/g, "");

  // Base64 encoding uses 4 characters to represent 3 bytes
  // So: original_bytes = (base64_length * 3) / 4
  return Math.floor((withoutPadding.length * 3) / 4);
}

/**
 * Extracts BLOB metadata from binary data
 * @param value - The BLOB value (base64 string, raw string, or BLOB:<size>:<preview> format)
 * @returns Object containing MIME type and size information
 */
export interface BlobMetadata {
  mimeType: string;
  size: number;
  formattedSize: string;
  isBase64: boolean;
  isTruncated?: boolean;
}

export function extractBlobMetadata(value: unknown): BlobMetadata | null {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value);

  // Check if it's the truncated BLOB format from backend: "BLOB:<size>:<base64_preview>"
  const truncatedBlobMatch = stringValue.match(/^BLOB:(\d+):(.+)$/);
  if (truncatedBlobMatch) {
    const size = parseInt(truncatedBlobMatch[1], 10);
    const previewBase64 = truncatedBlobMatch[2];
    const mimeType = detectMimeTypeFromBase64(previewBase64);

    return {
      mimeType,
      size,
      formattedSize: formatBlobSize(size),
      isBase64: true,
      isTruncated: true,
    };
  }

  // Check if it's a base64 string (common format from backend)
  // Base64 strings only contain A-Z, a-z, 0-9, +, /, and = for padding
  const isBase64 =
    /^[A-Za-z0-9+/]+=*$/.test(stringValue) && stringValue.length > 0;

  if (isBase64) {
    const size = getBase64Size(stringValue);
    const mimeType = detectMimeTypeFromBase64(stringValue);

    return {
      mimeType,
      size,
      formattedSize: formatBlobSize(size),
      isBase64: true,
      isTruncated: false,
    };
  }

  // For non-base64 strings, estimate size from string length
  // This is an approximation - actual byte size may vary with encoding
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
 * Formats a BLOB value for display in the DataGrid
 * Shows MIME type and size instead of raw data
 * @param value - The BLOB value
 * @param dataType - The column data type
 * @returns Formatted string like "image/png (1.54 MB)"
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
