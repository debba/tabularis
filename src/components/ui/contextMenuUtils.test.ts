import { describe, it, expect } from 'vitest';
import {
  calculateContextMenuPosition,
  shouldPositionLeft,
  shouldPositionAbove,
  clamp,
  type ViewportConstraints,
} from './contextMenuUtils';

describe('contextMenuUtils', () => {
  describe('calculateContextMenuPosition', () => {
    it('should return click position when menu fits in viewport', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 1920,
        viewportHeight: 1080,
        menuWidth: 200,
        menuHeight: 300,
        clickX: 500,
        clickY: 400,
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result).toEqual({ top: 400, left: 500 });
    });

    it('should adjust position when menu overflows right edge', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 500,
        viewportHeight: 600,
        menuWidth: 200,
        menuHeight: 100,
        clickX: 450, // Near right edge
        clickY: 100,
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result.left).toBeLessThan(450);
      // Should be positioned to the left with margin
      expect(result.left).toBe(500 - 200 - 10); // viewport - menu - margin
    });

    it('should adjust position when menu overflows bottom edge', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 800,
        viewportHeight: 600,
        menuWidth: 150,
        menuHeight: 200,
        clickX: 100,
        clickY: 550, // Near bottom edge
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result.top).toBeLessThan(550);
      // Should be positioned above with margin
      expect(result.top).toBe(600 - 200 - 10); // viewport - menu - margin
    });

    it('should adjust both X and Y when overflowing both edges', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 400,
        viewportHeight: 400,
        menuWidth: 200,
        menuHeight: 200,
        clickX: 350,
        clickY: 350,
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result.left).toBe(400 - 200 - 10); // adjusted to fit
      expect(result.top).toBe(400 - 200 - 10); // adjusted to fit
    });

    it('should enforce minimum left margin', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 300,
        viewportHeight: 400,
        menuWidth: 400, // Wider than viewport
        menuHeight: 100,
        clickX: 50,
        clickY: 100,
      };
      
      const result = calculateContextMenuPosition(constraints);
      // Even if menu is wider than viewport, should respect left margin
      expect(result.left).toBeGreaterThanOrEqual(10);
    });

    it('should enforce minimum top margin', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 400,
        viewportHeight: 300,
        menuWidth: 100,
        menuHeight: 400, // Taller than viewport
        clickX: 100,
        clickY: 50,
      };
      
      const result = calculateContextMenuPosition(constraints);
      // Even if menu is taller than viewport, should respect top margin
      expect(result.top).toBeGreaterThanOrEqual(10);
    });

    it('should use custom margin when provided', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 500,
        viewportHeight: 500,
        menuWidth: 200,
        menuHeight: 100,
        clickX: 450,
        clickY: 100,
        margin: 20,
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result.left).toBe(500 - 200 - 20); // using custom margin
    });

    it('should handle very small viewports', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 100,
        viewportHeight: 100,
        menuWidth: 80,
        menuHeight: 80,
        clickX: 50,
        clickY: 50,
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result.left).toBeGreaterThanOrEqual(10);
      expect(result.top).toBeGreaterThanOrEqual(10);
    });

    it('should handle zero dimensions gracefully', () => {
      const constraints: ViewportConstraints = {
        viewportWidth: 100,
        viewportHeight: 100,
        menuWidth: 0,
        menuHeight: 0,
        clickX: 50,
        clickY: 50,
      };
      
      const result = calculateContextMenuPosition(constraints);
      expect(result).toEqual({ top: 50, left: 50 });
    });
  });

  describe('shouldPositionLeft', () => {
    it('should return false when menu fits on the right', () => {
      expect(shouldPositionLeft(100, 200, 1920)).toBe(false);
    });

    it('should return true when menu overflows right edge', () => {
      expect(shouldPositionLeft(1800, 200, 1920)).toBe(true);
    });

    it('should consider margin in calculation', () => {
      // 1800 + 200 = 2000, with 1920 viewport and 10 margin, should overflow
      expect(shouldPositionLeft(1800, 200, 1920, 10)).toBe(true);
      // But with 0 margin, it would fit exactly
      expect(shouldPositionLeft(1720, 200, 1920, 0)).toBe(false);
    });

    it('should handle edge case exactly at boundary', () => {
      // Exactly at boundary with default 10px margin: 1710 + 200 = 1910, viewport 1920 - margin 10 = 1910
      // At exact boundary, should NOT need to position left (it fits perfectly)
      expect(shouldPositionLeft(1710, 200, 1920)).toBe(false);
      // Just over boundary
      expect(shouldPositionLeft(1711, 200, 1920)).toBe(true);
      // Well under boundary
      expect(shouldPositionLeft(1700, 200, 1920)).toBe(false);
    });
  });

  describe('shouldPositionAbove', () => {
    it('should return false when menu fits below', () => {
      expect(shouldPositionAbove(100, 200, 1080)).toBe(false);
    });

    it('should return true when menu overflows bottom edge', () => {
      expect(shouldPositionAbove(1000, 200, 1080)).toBe(true);
    });

    it('should consider margin in calculation', () => {
      expect(shouldPositionAbove(900, 200, 1080, 10)).toBe(true);
      expect(shouldPositionAbove(880, 200, 1080, 0)).toBe(false);
    });
  });

  describe('clamp', () => {
    it('should return value when within bounds', () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(0, 0, 100)).toBe(0);
      expect(clamp(100, 0, 100)).toBe(100);
    });

    it('should return min when value is below', () => {
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(-100, -50, 50)).toBe(-50);
    });

    it('should return max when value is above', () => {
      expect(clamp(150, 0, 100)).toBe(100);
      expect(clamp(100, -50, 50)).toBe(50);
    });

    it('should handle negative ranges', () => {
      expect(clamp(-75, -100, -50)).toBe(-75);
      expect(clamp(-200, -100, -50)).toBe(-100);
      expect(clamp(0, -100, -50)).toBe(-50);
    });

    it('should handle decimal values', () => {
      expect(clamp(3.14, 0, 10)).toBe(3.14);
      expect(clamp(-1.5, 0, 10)).toBe(0);
      expect(clamp(15.7, 0, 10)).toBe(10);
    });
  });
});
