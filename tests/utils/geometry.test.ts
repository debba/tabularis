import { describe, it, expect } from "vitest";
import {
  isWkbHexString,
  isGeometricType,
  wkbHexToWkt,
  formatGeometricValue,
} from "../../src/utils/geometry";

describe("geometry utils", () => {
  describe("isWkbHexString", () => {
    it("should return true for valid WKB hex strings with 0x prefix", () => {
      expect(isWkbHexString("0x0101000000")).toBe(true);
      expect(isWkbHexString("0x01010000000000000000000000")).toBe(true);
      expect(isWkbHexString("0xABCDEF123456")).toBe(true);
    });

    it("should return true for uppercase 0X prefix", () => {
      expect(isWkbHexString("0X0101000000")).toBe(true);
    });

    it("should return false for non-hex strings", () => {
      expect(isWkbHexString("POINT(1 2)")).toBe(false);
      expect(isWkbHexString("0xGHIJKL")).toBe(false);
      expect(isWkbHexString("not a hex")).toBe(false);
    });

    it("should return false for strings without 0x prefix", () => {
      expect(isWkbHexString("0101000000")).toBe(false);
      expect(isWkbHexString("ABCDEF")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isWkbHexString(null)).toBe(false);
      expect(isWkbHexString(undefined)).toBe(false);
      expect(isWkbHexString(123)).toBe(false);
      expect(isWkbHexString({})).toBe(false);
      expect(isWkbHexString([])).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isWkbHexString("")).toBe(false);
      expect(isWkbHexString("0x")).toBe(false);
    });
  });

  describe("isGeometricType", () => {
    it("should return true for common geometric types", () => {
      expect(isGeometricType("GEOMETRY")).toBe(true);
      expect(isGeometricType("POINT")).toBe(true);
      expect(isGeometricType("LINESTRING")).toBe(true);
      expect(isGeometricType("POLYGON")).toBe(true);
      expect(isGeometricType("MULTIPOINT")).toBe(true);
      expect(isGeometricType("MULTILINESTRING")).toBe(true);
      expect(isGeometricType("MULTIPOLYGON")).toBe(true);
      expect(isGeometricType("GEOMETRYCOLLECTION")).toBe(true);
      expect(isGeometricType("GEOGRAPHY")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isGeometricType("point")).toBe(true);
      expect(isGeometricType("Point")).toBe(true);
      expect(isGeometricType("POINT")).toBe(true);
      expect(isGeometricType("geometry")).toBe(true);
    });

    it("should match types that contain geometric keywords", () => {
      // MySQL often uses suffixes like POINT NOT NULL
      expect(isGeometricType("POINT NOT NULL")).toBe(true);
      expect(isGeometricType("geometry(Point,4326)")).toBe(true);
    });

    it("should return false for non-geometric types", () => {
      expect(isGeometricType("VARCHAR")).toBe(false);
      expect(isGeometricType("INT")).toBe(false);
      expect(isGeometricType("DECIMAL")).toBe(false);
      expect(isGeometricType("TEXT")).toBe(false);
      expect(isGeometricType("BOOLEAN")).toBe(false);
    });

    it("should return false for empty or null strings", () => {
      expect(isGeometricType("")).toBe(false);
      expect(isGeometricType(null as unknown as string)).toBe(false);
      expect(isGeometricType(undefined as unknown as string)).toBe(false);
    });
  });

  describe("wkbHexToWkt", () => {
    it("should convert WKB POINT to WKT", () => {
      // WKB for POINT(1 2) - Little-endian
      // 0101000000 = byte order (01) + type (01000000 = POINT)
      // Then 8 bytes for X (1.0) and 8 bytes for Y (2.0)
      const wkbPoint = "0x0101000000000000000000F03F0000000000000040";
      const wkt = wkbHexToWkt(wkbPoint);
      expect(wkt).toContain("POINT");
      expect(wkt).toContain("1");
      expect(wkt).toContain("2");
    });

    it("should handle hex strings without 0x prefix", () => {
      const wkbPoint = "0101000000000000000000F03F0000000000000040";
      const wkt = wkbHexToWkt(wkbPoint);
      expect(wkt).toContain("POINT");
    });

    it("should handle uppercase 0X prefix", () => {
      const wkbPoint = "0X0101000000000000000000F03F0000000000000040";
      const wkt = wkbHexToWkt(wkbPoint);
      expect(wkt).toContain("POINT");
    });

    it("should throw error for invalid WKB data", () => {
      expect(() => wkbHexToWkt("0x00")).toThrow();
      expect(() => wkbHexToWkt("0xZZZZ")).toThrow();
    });

    it("should convert WKB LINESTRING to WKT", () => {
      // This is a simplified test - actual WKB for LINESTRING is more complex
      // WKB LINESTRING with 2 points: (0,0) and (1,1)
      const wkbLineString = "0x010200000002000000000000000000000000000000000000000000000000000000F03F000000000000F03F";
      const wkt = wkbHexToWkt(wkbLineString);
      expect(wkt).toContain("LINESTRING");
    });
  });

  describe("formatGeometricValue", () => {
    it("should return NULL for null values", () => {
      expect(formatGeometricValue(null)).toBe("NULL");
      expect(formatGeometricValue(undefined)).toBe("NULL");
    });

    it("should return WKT as-is if already in WKT format", () => {
      expect(formatGeometricValue("POINT(1 2)")).toBe("POINT(1 2)");
      expect(formatGeometricValue("LINESTRING(0 0, 1 1, 2 2)")).toBe("LINESTRING(0 0, 1 1, 2 2)");
      expect(formatGeometricValue("POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))")).toBe("POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");
    });

    it("should convert WKB hex to WKT", () => {
      const wkbPoint = "0x0101000000000000000000F03F0000000000000040";
      const result = formatGeometricValue(wkbPoint);
      expect(result).toContain("POINT");
    });

    it("should handle conversion errors gracefully", () => {
      // Invalid WKB should return the original string
      const invalidWkb = "0x00";
      const result = formatGeometricValue(invalidWkb);
      expect(result).toBe(invalidWkb);
    });

    it("should return non-geometric strings as-is", () => {
      expect(formatGeometricValue("some text")).toBe("some text");
      expect(formatGeometricValue("123")).toBe("123");
    });

    it("should handle case-insensitive WKT detection", () => {
      expect(formatGeometricValue("point(1 2)")).toBe("point(1 2)");
      expect(formatGeometricValue("Point(1 2)")).toBe("Point(1 2)");
    });

    it("should handle WKT with extra whitespace", () => {
      const wkt = "POINT (1 2)";
      expect(formatGeometricValue(wkt)).toBe(wkt);
    });

    it("should handle MULTIPOINT WKT", () => {
      const wkt = "MULTIPOINT((1 2), (3 4))";
      expect(formatGeometricValue(wkt)).toBe(wkt);
    });

    it("should handle MULTILINESTRING WKT", () => {
      const wkt = "MULTILINESTRING((0 0, 1 1), (2 2, 3 3))";
      expect(formatGeometricValue(wkt)).toBe(wkt);
    });

    it("should handle MULTIPOLYGON WKT", () => {
      const wkt = "MULTIPOLYGON(((0 0, 10 0, 10 10, 0 10, 0 0)))";
      expect(formatGeometricValue(wkt)).toBe(wkt);
    });

    it("should handle GEOMETRYCOLLECTION WKT", () => {
      const wkt = "GEOMETRYCOLLECTION(POINT(1 2), LINESTRING(0 0, 1 1))";
      expect(formatGeometricValue(wkt)).toBe(wkt);
    });
  });
});
