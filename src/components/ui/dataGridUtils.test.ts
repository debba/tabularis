import { describe, it, expect } from 'vitest';
import {
  formatCellValue,
  getColumnSortState,
  calculateSelectionRange,
  toggleSetValue,
} from './dataGridUtils';

describe('dataGridUtils', () => {
  describe('formatCellValue', () => {
    it('should format null values', () => {
      expect(formatCellValue(null)).toBe('NULL');
      expect(formatCellValue(undefined)).toBe('NULL');
    });

    it('should format null with custom label', () => {
      expect(formatCellValue(null, 'N/A')).toBe('N/A');
      expect(formatCellValue(undefined, 'Empty')).toBe('Empty');
    });

    it('should format boolean values', () => {
      expect(formatCellValue(true)).toBe('true');
      expect(formatCellValue(false)).toBe('false');
    });

    it('should format numbers', () => {
      expect(formatCellValue(42)).toBe('42');
      expect(formatCellValue(3.14)).toBe('3.14');
      expect(formatCellValue(0)).toBe('0');
      expect(formatCellValue(-10)).toBe('-10');
    });

    it('should format strings', () => {
      expect(formatCellValue('hello')).toBe('hello');
      expect(formatCellValue('')).toBe('');
    });

    it('should format objects as JSON', () => {
      expect(formatCellValue({ a: 1 })).toBe('{"a":1}');
      expect(formatCellValue([1, 2, 3])).toBe('[1,2,3]');
    });

    it('should format nested objects', () => {
      const nested = { user: { name: 'John', age: 30 } };
      expect(formatCellValue(nested)).toBe('{"user":{"name":"John","age":30}}');
    });
  });

  describe('getColumnSortState', () => {
    it('should return null when no sort clause', () => {
      expect(getColumnSortState('name', undefined)).toBeNull();
      expect(getColumnSortState('name', '')).toBeNull();
    });

    it('should detect ASC sort', () => {
      expect(getColumnSortState('name', 'name ASC')).toBe('asc');
      expect(getColumnSortState('name', 'name asc')).toBe('asc');
    });

    it('should detect DESC sort', () => {
      expect(getColumnSortState('name', 'name DESC')).toBe('desc');
      expect(getColumnSortState('name', 'name desc')).toBe('desc');
    });

    it('should default to ASC when no direction specified', () => {
      expect(getColumnSortState('name', 'name')).toBe('asc');
    });

    it('should be case insensitive for column names', () => {
      expect(getColumnSortState('NAME', 'name ASC')).toBe('asc');
      expect(getColumnSortState('Name', 'NAME desc')).toBe('desc');
    });

    it('should find column in multi-column sort clause', () => {
      expect(getColumnSortState('id', 'name ASC, id DESC')).toBe('desc');
      expect(getColumnSortState('name', 'name ASC, id DESC')).toBe('asc');
    });

    it('should return null for column not in sort clause', () => {
      expect(getColumnSortState('email', 'name ASC, id DESC')).toBeNull();
    });

    it('should handle qualified column names', () => {
      expect(getColumnSortState('users.name', 'users.name ASC')).toBe('asc');
      expect(getColumnSortState('u.name', 'u.name desc, u.id asc')).toBe('desc');
    });
  });

  describe('calculateSelectionRange', () => {
    it('should calculate range when start < end', () => {
      expect(calculateSelectionRange(0, 4)).toEqual([0, 1, 2, 3, 4]);
    });

    it('should calculate range when start > end', () => {
      expect(calculateSelectionRange(5, 2)).toEqual([2, 3, 4, 5]);
    });

    it('should return single item when start === end', () => {
      expect(calculateSelectionRange(3, 3)).toEqual([3]);
    });

    it('should handle negative indices', () => {
      expect(calculateSelectionRange(-2, 2)).toEqual([-2, -1, 0, 1, 2]);
    });

    it('should handle large ranges', () => {
      const range = calculateSelectionRange(0, 99);
      expect(range).toHaveLength(100);
      expect(range[0]).toBe(0);
      expect(range[99]).toBe(99);
    });
  });

  describe('toggleSetValue', () => {
    it('should add value to empty set', () => {
      const set = new Set<number>();
      const result = toggleSetValue(set, 1);
      expect(result.has(1)).toBe(true);
    });

    it('should add value to existing set', () => {
      const set = new Set([1, 2, 3]);
      const result = toggleSetValue(set, 4);
      expect(result.has(4)).toBe(true);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);
    });

    it('should remove existing value', () => {
      const set = new Set([1, 2, 3]);
      const result = toggleSetValue(set, 2);
      expect(result.has(2)).toBe(false);
      expect(result.has(1)).toBe(true);
      expect(result.has(3)).toBe(true);
    });

    it('should not modify original set', () => {
      const set = new Set([1, 2, 3]);
      toggleSetValue(set, 4);
      expect(set.has(4)).toBe(false);
      expect(set.size).toBe(3);
    });

    it('should work with string values', () => {
      const set = new Set(['a', 'b']);
      const result = toggleSetValue(set, 'c');
      expect(result.has('c')).toBe(true);
      
      const result2 = toggleSetValue(result, 'a');
      expect(result2.has('a')).toBe(false);
    });
  });
});
