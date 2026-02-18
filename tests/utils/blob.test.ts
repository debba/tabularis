import { describe, it, expect } from "vitest";
import {
  isBlobType,
  detectMimeTypeFromBase64,
  formatBlobSize,
  getBase64Size,
  extractBlobMetadata,
  formatBlobValue,
} from "../../src/utils/blob";

describe("blob utilities", () => {
  describe("isBlobType", () => {
    it("should identify MySQL BLOB types", () => {
      expect(isBlobType("BLOB")).toBe(true);
      expect(isBlobType("TINYBLOB")).toBe(true);
      expect(isBlobType("MEDIUMBLOB")).toBe(true);
      expect(isBlobType("LONGBLOB")).toBe(true);
    });

    it("should identify MySQL BINARY types", () => {
      expect(isBlobType("BINARY")).toBe(true);
      expect(isBlobType("VARBINARY")).toBe(true);
    });

    it("should identify PostgreSQL BYTEA type", () => {
      expect(isBlobType("BYTEA")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isBlobType("blob")).toBe(true);
      expect(isBlobType("Blob")).toBe(true);
      expect(isBlobType("BLOB")).toBe(true);
    });

    it("should return false for non-BLOB types", () => {
      expect(isBlobType("VARCHAR")).toBe(false);
      expect(isBlobType("INTEGER")).toBe(false);
      expect(isBlobType("TEXT")).toBe(false);
      expect(isBlobType("GEOMETRY")).toBe(false);
    });

    it("should handle undefined and empty strings", () => {
      expect(isBlobType("")).toBe(false);
      expect(isBlobType(undefined as any)).toBe(false);
    });
  });

  describe("detectMimeTypeFromBase64", () => {
    it("should detect PNG images", () => {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      const pngBase64 = btoa("\x89PNG\r\n\x1a\n");
      expect(detectMimeTypeFromBase64(pngBase64)).toBe("image/png");
    });

    it("should detect JPEG images", () => {
      // JPEG magic bytes: FF D8 FF
      const jpegBase64 = btoa("\xFF\xD8\xFF\xE0");
      expect(detectMimeTypeFromBase64(jpegBase64)).toBe("image/jpeg");
    });

    it("should detect GIF images", () => {
      // GIF magic bytes: 47 49 46 38
      const gifBase64 = btoa("GIF89a");
      expect(detectMimeTypeFromBase64(gifBase64)).toBe("image/gif");
    });

    it("should detect PDF files", () => {
      // PDF magic bytes: 25 50 44 46
      const pdfBase64 = btoa("%PDF-1.4");
      expect(detectMimeTypeFromBase64(pdfBase64)).toBe("application/pdf");
    });

    it("should detect ZIP files", () => {
      // ZIP magic bytes: 50 4B 03 04
      const zipBase64 = btoa("PK\x03\x04");
      expect(detectMimeTypeFromBase64(zipBase64)).toBe("application/zip");
    });

    it("should return octet-stream for unknown types", () => {
      const unknownBase64 = btoa("UNKNOWN_FORMAT");
      expect(detectMimeTypeFromBase64(unknownBase64)).toBe(
        "application/octet-stream",
      );
    });

    it("should handle invalid base64 gracefully", () => {
      expect(detectMimeTypeFromBase64("not-valid-base64!!!")).toBe(
        "application/octet-stream",
      );
    });
  });

  describe("formatBlobSize", () => {
    it("should format bytes", () => {
      expect(formatBlobSize(0)).toBe("0 B");
      expect(formatBlobSize(500)).toBe("500 B");
      expect(formatBlobSize(1023)).toBe("1023 B");
    });

    it("should format kilobytes", () => {
      expect(formatBlobSize(1024)).toBe("1.00 KB");
      expect(formatBlobSize(1536)).toBe("1.50 KB");
      expect(formatBlobSize(10240)).toBe("10.00 KB");
    });

    it("should format megabytes", () => {
      expect(formatBlobSize(1048576)).toBe("1.00 MB");
      expect(formatBlobSize(1572864)).toBe("1.50 MB");
      expect(formatBlobSize(10485760)).toBe("10.00 MB");
    });

    it("should format gigabytes", () => {
      expect(formatBlobSize(1073741824)).toBe("1.00 GB");
      expect(formatBlobSize(2147483648)).toBe("2.00 GB");
    });

    it("should format terabytes", () => {
      expect(formatBlobSize(1099511627776)).toBe("1.00 TB");
    });
  });

  describe("getBase64Size", () => {
    it("should calculate size for base64 strings without padding", () => {
      // "Hello" in base64 is "SGVsbG8=" (8 chars)
      // Original size: 5 bytes
      const base64 = "SGVsbG8=";
      expect(getBase64Size(base64)).toBe(5);
    });

    it("should calculate size for base64 strings with padding", () => {
      // "Hi" in base64 is "SGk=" (4 chars)
      // Original size: 2 bytes
      const base64 = "SGk=";
      expect(getBase64Size(base64)).toBe(2);
    });

    it("should handle empty strings", () => {
      expect(getBase64Size("")).toBe(0);
    });
  });

  describe("extractBlobMetadata", () => {
    it("should extract metadata from base64 PNG data", () => {
      const pngBase64 = btoa("\x89PNG\r\n\x1a\n" + "A".repeat(100));
      const metadata = extractBlobMetadata(pngBase64);

      expect(metadata).not.toBeNull();
      expect(metadata?.mimeType).toBe("image/png");
      expect(metadata?.isBase64).toBe(true);
      expect(metadata?.size).toBeGreaterThan(0);
      expect(metadata?.formattedSize).toContain("B");
      expect(metadata?.isTruncated).toBe(false);
    });

    it("should extract metadata from base64 JPEG data", () => {
      const jpegBase64 = btoa("\xFF\xD8\xFF\xE0" + "B".repeat(200));
      const metadata = extractBlobMetadata(jpegBase64);

      expect(metadata).not.toBeNull();
      expect(metadata?.mimeType).toBe("image/jpeg");
      expect(metadata?.isBase64).toBe(true);
      expect(metadata?.isTruncated).toBe(false);
    });

    it("should handle truncated BLOB format from backend", () => {
      const previewBase64 = btoa("\x89PNG\r\n\x1a\n" + "A".repeat(100));
      const truncatedBlob = `BLOB:5242880:${previewBase64}`; // 5MB size
      const metadata = extractBlobMetadata(truncatedBlob);

      expect(metadata).not.toBeNull();
      expect(metadata?.size).toBe(5242880);
      expect(metadata?.formattedSize).toBe("5.00 MB");
      expect(metadata?.mimeType).toBe("image/png");
      expect(metadata?.isBase64).toBe(true);
      expect(metadata?.isTruncated).toBe(true);
    });

    it("should handle null values", () => {
      expect(extractBlobMetadata(null)).toBeNull();
      expect(extractBlobMetadata(undefined)).toBeNull();
    });

    it("should handle non-base64 strings", () => {
      const plainText = "This is not base64!@#$%";
      const metadata = extractBlobMetadata(plainText);

      expect(metadata).not.toBeNull();
      expect(metadata?.mimeType).toBe("text/plain");
      expect(metadata?.isBase64).toBe(false);
      expect(metadata?.isTruncated).toBe(false);
    });
  });

  describe("formatBlobValue", () => {
    it("should format BLOB values with metadata", () => {
      const pngBase64 = btoa("\x89PNG\r\n\x1a\n" + "A".repeat(100));
      const formatted = formatBlobValue(pngBase64, "BLOB");

      expect(formatted).toContain("image/png");
      expect(formatted).toContain("B"); // Should contain size unit
      expect(formatted).toMatch(/\(.*\)/); // Should contain size in parentheses
    });

    it("should handle null BLOB values", () => {
      expect(formatBlobValue(null, "BLOB")).toBe("NULL");
      expect(formatBlobValue(undefined, "BLOB")).toBe("NULL");
    });

    it("should return raw value for non-BLOB types", () => {
      expect(formatBlobValue("test", "VARCHAR")).toBe("test");
      expect(formatBlobValue(123, "INTEGER")).toBe("123");
    });

    it("should work with different BLOB type names", () => {
      const data = btoa("test");

      expect(formatBlobValue(data, "BLOB")).toContain(
        "application/octet-stream",
      );
      expect(formatBlobValue(data, "TINYBLOB")).toContain(
        "application/octet-stream",
      );
      expect(formatBlobValue(data, "MEDIUMBLOB")).toContain(
        "application/octet-stream",
      );
      expect(formatBlobValue(data, "LONGBLOB")).toContain(
        "application/octet-stream",
      );
    });
  });
});
