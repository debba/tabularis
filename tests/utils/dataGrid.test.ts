import { describe, it, expect } from 'vitest';
import {
  formatCellValue,
  getColumnSortState,
  calculateSelectionRange,
  toggleSetValue
} from '../../src/utils/dataGrid';

describe('dataGrid utils', () => {
  describe('formatCellValue', () => {
    it('should return nullLabel for null values', () => {
      expect(formatCellValue(null)).toBe('NULL');
      expect(formatCellValue(null, 'N/A')).toBe('N/A');
    });

    it('should return nullLabel for undefined values', () => {
      expect(formatCellValue(undefined)).toBe('NULL');
      expect(formatCellValue(undefined, 'Empty')).toBe('Empty');
    });

    it('should format boolean true as "true"', () => {
      expect(formatCellValue(true)).toBe('true');
    });

    it('should format boolean false as "false"', () => {
      expect(formatCellValue(false)).toBe('false');
    });

    it('should stringify objects as JSON', () => {
      expect(formatCellValue({ name: 'John', age: 30 })).toBe('{"name":"John","age":30}');
      expect(formatCellValue([1, 2, 3])).toBe('[1,2,3]');
    });

    it('should convert numbers to strings', () => {
      expect(formatCellValue(42)).toBe('42');
      expect(formatCellValue(3.14)).toBe('3.14');
      expect(formatCellValue(-100)).toBe('-100');
      expect(formatCellValue(0)).toBe('0');
    });

    it('should return strings as-is', () => {
      expect(formatCellValue('hello')).toBe('hello');
      expect(formatCellValue('')).toBe('');
      expect(formatCellValue('  spaced  ')).toBe('  spaced  ');
    });

    it('should handle special number values', () => {
      expect(formatCellValue(Infinity)).toBe('Infinity');
      expect(formatCellValue(-Infinity)).toBe('-Infinity');
      expect(formatCellValue(NaN)).toBe('NaN');
    });

    it('should handle nested objects', () => {
      const nested = { user: { name: 'John', address: { city: 'NYC' } } };
      expect(formatCellValue(nested)).toBe('{"user":{"name":"John","address":{"city":"NYC"}}}');
    });

    it('should handle empty objects and arrays', () => {
      expect(formatCellValue({})).toBe('{}');
      expect(formatCellValue([])).toBe('[]');
    });
  });

  describe('getColumnSortState', () => {
    it('should return null for empty sort clause', () => {
      expect(getColumnSortState('name', '')).toBeNull();
      expect(getColumnSortState('name', undefined)).toBeNull();
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

    it('should be case-insensitive for column names', () => {
      expect(getColumnSortState('NAME', 'name ASC')).toBe('asc');
      expect(getColumnSortState('Name', 'NAME desc')).toBe('desc');
    });

    it('should handle qualified column names (table.column)', () => {
      expect(getColumnSortState('users.name', 'users.name ASC')).toBe('asc');
      expect(getColumnSortState('name', 'users.name DESC')).toBe('desc');
    });

    it('should handle multiple sort columns', () => {
      expect(getColumnSortState('name', 'name ASC, id DESC')).toBe('asc');
      expect(getColumnSortState('id', 'name ASC, id DESC')).toBe('desc');
      expect(getColumnSortState('age', 'name ASC, id DESC')).toBeNull();
    });

    it('should return null when column not in sort clause', () => {
      expect(getColumnSortState('email', 'name ASC')).toBeNull();
      expect(getColumnSortState('id', 'name, email')).toBeNull();
    });

    it('should handle column names with special regex characters', () => {
      expect(getColumnSortState('col.name', 'col.name ASC')).toBe('asc');
      expect(getColumnSortState('col[name]', 'col[name] DESC')).toBe('desc');
    });

    it('should handle sort clause with whitespace variations', () => {
      expect(getColumnSortState('name', 'name   ASC')).toBe('asc');
      expect(getColumnSortState('name', 'name  desc')).toBe('desc');
    });
  });

  describe('calculateSelectionRange', () => {
    it('should calculate range from lower to higher index', () => {
      expect(calculateSelectionRange(2, 5)).toEqual([2, 3, 4, 5]);
    });

    it('should calculate range from higher to lower index', () => {
      expect(calculateSelectionRange(5, 2)).toEqual([2, 3, 4, 5]);
    });

    it('should return single index when start equals end', () => {
      expect(calculateSelectionRange(3, 3)).toEqual([3]);
    });

    it('should handle zero as start index', () => {
      expect(calculateSelectionRange(0, 3)).toEqual([0, 1, 2, 3]);
      expect(calculateSelectionRange(3, 0)).toEqual([0, 1, 2, 3]);
    });

    it('should handle negative indices', () => {
      expect(calculateSelectionRange(-2, 2)).toEqual([-2, -1, 0, 1, 2]);
      expect(calculateSelectionRange(2, -2)).toEqual([-2, -1, 0, 1, 2]);
    });

    it('should handle large ranges', () => {
      const range = calculateSelectionRange(0, 99);
      expect(range).toHaveLength(100);
      expect(range[0]).toBe(0);
      expect(range[99]).toBe(99);
    });

    it('should handle consecutive indices', () => {
      expect(calculateSelectionRange(5, 6)).toEqual([5, 6]);
      expect(calculateSelectionRange(6, 5)).toEqual([5, 6]);
    });
  });

  describe('toggleSetValue', () => {
    it('should add value to empty set', () => {
      const set = new Set<number>();
      const result = toggleSetValue(set, 1);
      expect(result.has(1)).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should add value to existing set', () => {
      const set = new Set([1, 2, 3]);
      const result = toggleSetValue(set, 4);
      expect(result.has(4)).toBe(true);
      expect(result.size).toBe(4);
    });

    it('should remove value if already present', () => {
      const set = new Set([1, 2, 3]);
      const result = toggleSetValue(set, 2);
      expect(result.has(2)).toBe(false);
      expect(result.size).toBe(2);
    });

    it('should not modify original set', () => {
      const set = new Set([1, 2, 3]);
      const result = toggleSetValue(set, 4);
      expect(set.has(4)).toBe(false);
      expect(set.size).toBe(3);
    });

    it('should handle string values', () => {
      const set = new Set<string>(['a', 'b']);
      const result = toggleSetValue(set, 'c');
      expect(result.has('c')).toBe(true);
      
      const removed = toggleSetValue(result, 'a');
      expect(removed.has('a')).toBe(false);
    });

    it('should handle object references', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const set = new Set([obj1]);
      
      const added = toggleSetValue(set, obj2);
      expect(added.has(obj2)).toBe(true);
      
      const removed = toggleSetValue(added, obj1);
      expect(removed.has(obj1)).toBe(false);
    });

    it('should handle mixed types (with union types)', () => {
      const set = new Set<string | number>(['a', 1]);
      const result = toggleSetValue(set, 2);
      expect(result.has(2)).toBe(true);
    });

    it('should toggle value back and forth', () => {
      let set = new Set<number>([1, 2]);
      set = toggleSetValue(set, 3);
      expect(set.has(3)).toBe(true);
      
      set = toggleSetValue(set, 3);
      expect(set.has(3)).toBe(false);
      
      set = toggleSetValue(set, 3);
      expect(set.has(3)).toBe(true);
    });

    it('should handle empty set removal', () => {
      const set = new Set<number>();
      const result = toggleSetValue(set, 1);
      const removed = toggleSetValue(result, 1);
      expect(removed.size).toBe(0);
    });
  });
});
