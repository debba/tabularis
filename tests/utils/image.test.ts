import { describe, it, expect } from "vitest";
import {
  arrayBufferToBase64,
  validateImageSize,
  getMimeTypeFromExtension,
  createImageContentPart,
  createTextContentPart,
} from "../../src/utils/image";

describe("image", () => {
  describe("arrayBufferToBase64", () => {
    it("should convert ArrayBuffer to base64 string", () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("SGVsbG8=");
    });

    it("should handle empty buffer", () => {
      const buffer = new Uint8Array([]).buffer;
      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("");
    });

    it("should convert binary data correctly", () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG header
      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("iVBORw==");
    });
  });

  describe("validateImageSize", () => {
    it("should accept images under 5MB", () => {
      expect(validateImageSize(4 * 1024 * 1024)).toBe(true);
      expect(validateImageSize(1024)).toBe(true);
      expect(validateImageSize(0)).toBe(true);
    });

    it("should reject images over 5MB", () => {
      expect(validateImageSize(6 * 1024 * 1024)).toBe(false);
      expect(validateImageSize(10 * 1024 * 1024)).toBe(false);
    });

    it("should accept exactly 5MB", () => {
      expect(validateImageSize(5 * 1024 * 1024)).toBe(true);
    });

    it("should handle custom max size", () => {
      expect(validateImageSize(3 * 1024 * 1024, 2)).toBe(false);
      expect(validateImageSize(1 * 1024 * 1024, 2)).toBe(true);
    });
  });

  describe("getMimeTypeFromExtension", () => {
    it("should detect PNG mime type", () => {
      expect(getMimeTypeFromExtension("photo.png")).toBe("image/png");
      expect(getMimeTypeFromExtension("IMAGE.PNG")).toBe("image/png");
    });

    it("should detect JPEG mime types", () => {
      expect(getMimeTypeFromExtension("photo.jpg")).toBe("image/jpeg");
      expect(getMimeTypeFromExtension("photo.jpeg")).toBe("image/jpeg");
      expect(getMimeTypeFromExtension("PHOTO.JPG")).toBe("image/jpeg");
    });

    it("should detect GIF mime type", () => {
      expect(getMimeTypeFromExtension("animation.gif")).toBe("image/gif");
    });

    it("should detect WebP mime type", () => {
      expect(getMimeTypeFromExtension("modern.webp")).toBe("image/webp");
    });

    it("should handle paths with multiple dots", () => {
      expect(getMimeTypeFromExtension("/path/to/my.file.name.png")).toBe(
        "image/png"
      );
    });

    it("should return default for unknown extensions", () => {
      expect(getMimeTypeFromExtension("file.bmp")).toBe("image/jpeg");
      expect(getMimeTypeFromExtension("file.txt")).toBe("image/jpeg");
      expect(getMimeTypeFromExtension("noext")).toBe("image/jpeg");
    });
  });

  describe("createImageContentPart", () => {
    it("should create image content part with all fields", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
      const mimeType = "image/png";
      const result = createImageContentPart(dataUrl, mimeType);

      expect(result.type).toBe("image");
      expect(result.image_url).toBe(dataUrl);
      expect(result.mime_type).toBe(mimeType);
    });

    it("should handle different mime types", () => {
      const result = createImageContentPart(
        "data:image/jpeg;base64,/9j/4AA=",
        "image/jpeg"
      );

      expect(result.type).toBe("image");
      expect(result.mime_type).toBe("image/jpeg");
    });
  });

  describe("createTextContentPart", () => {
    it("should create text content part", () => {
      const text = "Hello, world!";
      const result = createTextContentPart(text);

      expect(result.type).toBe("text");
      expect(result.text).toBe(text);
    });

    it("should handle empty text", () => {
      const result = createTextContentPart("");

      expect(result.type).toBe("text");
      expect(result.text).toBe("");
    });

    it("should handle multiline text", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const result = createTextContentPart(text);

      expect(result.type).toBe("text");
      expect(result.text).toBe(text);
    });
  });
});
