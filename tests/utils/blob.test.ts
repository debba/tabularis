import { describe, it, expect } from "vitest";
import {
  isBlobType,
  extractBlobMetadata,
  formatBlobValue,
  mimeToExtension,
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

  describe("extractBlobMetadata", () => {
    // Helper: build a canonical wire format string as the backend would produce
    function makeBlobWire(
      totalSize: number,
      mimeType: string,
      data: string,
    ): string {
      return `BLOB:${totalSize}:${mimeType}:${data}`;
    }

    it("should extract metadata from the backend wire format (PNG, small blob)", () => {
      const rawData = "\x89PNG\r\n\x1a\n" + "A".repeat(100);
      const b64 = btoa(rawData);
      // The backend encodes raw bytes; compute the decoded byte count from base64
      // to match what the backend would set as <size>
      const decodedByteSize = Math.floor((b64.replace(/=/g, "").length * 3) / 4);
      const wire = makeBlobWire(decodedByteSize, "image/png", b64);
      const metadata = extractBlobMetadata(wire);

      expect(metadata).not.toBeNull();
      expect(metadata?.mimeType).toBe("image/png");
      expect(metadata?.isBase64).toBe(true);
      expect(metadata?.isTruncated).toBe(false);
      expect(metadata?.formattedSize).toContain("B");
    });

    it("should extract metadata from the backend wire format (PDF)", () => {
      const b64 = btoa("%PDF-1.7" + "A".repeat(100));
      const wire = makeBlobWire(b64.length, "application/pdf", b64);
      const metadata = extractBlobMetadata(wire);

      expect(metadata).not.toBeNull();
      expect(metadata?.mimeType).toBe("application/pdf");
    });

    it("should mark large blobs as truncated", () => {
      const previewB64 = btoa("\x89PNG\r\n\x1a\n" + "A".repeat(100));
      // Report 5 MB total but only send a small preview
      const wire = makeBlobWire(5_242_880, "image/png", previewB64);
      const metadata = extractBlobMetadata(wire);

      expect(metadata).not.toBeNull();
      expect(metadata?.size).toBe(5_242_880);
      expect(metadata?.formattedSize).toBe("5.00 MB");
      expect(metadata?.mimeType).toBe("image/png");
      expect(metadata?.isBase64).toBe(true);
      expect(metadata?.isTruncated).toBe(true);
    });

    it("should not mark small blobs as truncated when size matches data", () => {
      const b64 = btoa("hello world");
      const wire = makeBlobWire(11, "text/plain", b64);
      const metadata = extractBlobMetadata(wire);

      expect(metadata?.isTruncated).toBe(false);
    });

    it("should handle null values", () => {
      expect(extractBlobMetadata(null)).toBeNull();
      expect(extractBlobMetadata(undefined)).toBeNull();
    });

    it("should handle plain-text blobs (UTF-8 decoded by backend)", () => {
      const plainText = "Hello, world!";
      const metadata = extractBlobMetadata(plainText);

      expect(metadata).not.toBeNull();
      expect(metadata?.mimeType).toBe("text/plain");
      expect(metadata?.isBase64).toBe(false);
      expect(metadata?.isTruncated).toBe(false);
    });
  });

  describe("formatBlobValue", () => {
    it("should format BLOB values with metadata", () => {
      const b64 = btoa("\x89PNG\r\n\x1a\n" + "A".repeat(100));
      const wire = `BLOB:${b64.length}:image/png:${b64}`;
      const formatted = formatBlobValue(wire, "BLOB");

      expect(formatted).toContain("image/png");
      expect(formatted).toMatch(/\(.*\)/);
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
      const b64 = btoa("test");
      const wire = `BLOB:4:application/octet-stream:${b64}`;

      expect(formatBlobValue(wire, "BLOB")).toContain("application/octet-stream");
      expect(formatBlobValue(wire, "TINYBLOB")).toContain("application/octet-stream");
      expect(formatBlobValue(wire, "MEDIUMBLOB")).toContain("application/octet-stream");
      expect(formatBlobValue(wire, "LONGBLOB")).toContain("application/octet-stream");
    });
  });

  describe("mimeToExtension", () => {
    it("should map common image types", () => {
      expect(mimeToExtension("image/png")).toBe("png");
      expect(mimeToExtension("image/jpeg")).toBe("jpg");
      expect(mimeToExtension("image/gif")).toBe("gif");
      expect(mimeToExtension("image/webp")).toBe("webp");
      expect(mimeToExtension("image/x-icon")).toBe("ico");
    });

    it("should map document types", () => {
      expect(mimeToExtension("application/pdf")).toBe("pdf");
      expect(mimeToExtension("application/msword")).toBe("doc");
      expect(mimeToExtension("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    });

    it("should map archive types", () => {
      expect(mimeToExtension("application/zip")).toBe("zip");
      expect(mimeToExtension("application/gzip")).toBe("gz");
      expect(mimeToExtension("application/x-7z-compressed")).toBe("7z");
      expect(mimeToExtension("application/vnd.rar")).toBe("rar");
      expect(mimeToExtension("application/x-bzip2")).toBe("bz2");
      expect(mimeToExtension("application/x-xz")).toBe("xz");
    });

    it("should map audio/video types", () => {
      expect(mimeToExtension("video/mp4")).toBe("mp4");
      expect(mimeToExtension("video/webm")).toBe("webm");
      expect(mimeToExtension("video/quicktime")).toBe("mov");
      expect(mimeToExtension("video/avi")).toBe("avi");
      expect(mimeToExtension("audio/mpeg")).toBe("mp3");
      expect(mimeToExtension("audio/mp4")).toBe("m4a");
      expect(mimeToExtension("audio/flac")).toBe("flac");
    });

    it("should fall back gracefully for unknown types", () => {
      expect(mimeToExtension("application/octet-stream")).toBe("bin");
      expect(mimeToExtension("image/avif")).toBe("avif");
      // Unknown type falls back to subtype
      expect(mimeToExtension("text/something-custom")).toBe("somethingcustom");
    });
  });
});
