import { describe, it, expect } from 'vitest';
import {
  validateQueryForm,
  trimFormValues,
  formatNumberLocale,
  formatCompactNumber,
  type QueryFormData,
} from '../../src/utils/modalForms';

describe('modalForms', () => {
  describe('validateQueryForm', () => {
    it('should validate valid form data', () => {
      const data: QueryFormData = {
        name: 'Test Query',
        sql: 'SELECT * FROM users',
      };
      const result = validateQueryForm(data);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject empty name', () => {
      const data: QueryFormData = {
        name: '',
        sql: 'SELECT * FROM users',
      };
      const result = validateQueryForm(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject whitespace-only name', () => {
      const data: QueryFormData = {
        name: '   ',
        sql: 'SELECT * FROM users',
      };
      const result = validateQueryForm(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject empty sql', () => {
      const data: QueryFormData = {
        name: 'Test Query',
        sql: '',
      };
      const result = validateQueryForm(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('SQL content is required');
    });

    it('should reject whitespace-only sql', () => {
      const data: QueryFormData = {
        name: 'Test Query',
        sql: '   \n\t  ',
      };
      const result = validateQueryForm(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('SQL content is required');
    });

    it('should reject both empty fields', () => {
      const data: QueryFormData = {
        name: '',
        sql: '',
      };
      const result = validateQueryForm(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });
  });

  describe('trimFormValues', () => {
    it('should trim whitespace from name and sql', () => {
      const data: QueryFormData = {
        name: '  Test Query  ',
        sql: '  SELECT * FROM users  ',
      };
      const result = trimFormValues(data);
      expect(result.name).toBe('Test Query');
      expect(result.sql).toBe('SELECT * FROM users');
    });

    it('should handle already trimmed values', () => {
      const data: QueryFormData = {
        name: 'Test',
        sql: 'SELECT 1',
      };
      const result = trimFormValues(data);
      expect(result.name).toBe('Test');
      expect(result.sql).toBe('SELECT 1');
    });

    it('should handle empty strings', () => {
      const data: QueryFormData = {
        name: '',
        sql: '',
      };
      const result = trimFormValues(data);
      expect(result.name).toBe('');
      expect(result.sql).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      const data: QueryFormData = {
        name: '   ',
        sql: '   \n\t   ',
      };
      const result = trimFormValues(data);
      expect(result.name).toBe('');
      expect(result.sql).toBe('');
    });

    it('should not mutate original data', () => {
      const data: QueryFormData = {
        name: '  Original  ',
        sql: '  SQL  ',
      };
      const originalName = data.name;
      const originalSql = data.sql;
      trimFormValues(data);
      expect(data.name).toBe(originalName);
      expect(data.sql).toBe(originalSql);
    });
  });

  describe('formatNumberLocale', () => {
    it('should format small numbers', () => {
      expect(formatNumberLocale(42)).toBe('42');
      expect(formatNumberLocale(0)).toBe('0');
      expect(formatNumberLocale(1)).toBe('1');
    });

    it('should format large numbers with locale separators', () => {
      expect(formatNumberLocale(1000)).toMatch(/1[,.]?000/);
      expect(formatNumberLocale(1000000)).toMatch(/1[,.]?000[,.]?000/);
    });

    it('should format negative numbers', () => {
      expect(formatNumberLocale(-42)).toBe('-42');
      expect(formatNumberLocale(-1000)).toMatch(/-1[,.]?000/);
    });

    it('should format decimal numbers', () => {
      expect(formatNumberLocale(3.14)).toMatch(/3[,.]?14/);
      expect(formatNumberLocale(1234.56)).toMatch(/1[,.]?234[,.]?56/);
    });
  });

  describe('formatCompactNumber', () => {
    it('should return small numbers as-is', () => {
      expect(formatCompactNumber(0)).toBe('0');
      expect(formatCompactNumber(42)).toBe('42');
      expect(formatCompactNumber(999)).toBe('999');
    });

    it('should format thousands with K suffix', () => {
      expect(formatCompactNumber(1000)).toBe('1.0K');
      expect(formatCompactNumber(1500)).toBe('1.5K');
      expect(formatCompactNumber(999999)).toBe('1000.0K');
    });

    it('should format millions with M suffix', () => {
      expect(formatCompactNumber(1000000)).toBe('1.0M');
      expect(formatCompactNumber(2500000)).toBe('2.5M');
      expect(formatCompactNumber(999999999)).toBe('1000.0M');
    });

    it('should format billions with B suffix', () => {
      expect(formatCompactNumber(1000000000)).toBe('1.0B');
      expect(formatCompactNumber(3500000000)).toBe('3.5B');
      expect(formatCompactNumber(1000000000000)).toBe('1000.0B');
    });

    it('should handle negative numbers (documenting current behavior)', () => {
      // Note: Current implementation treats negative numbers < 1000
      // This is a known limitation - negative compact formatting could be improved
      expect(formatCompactNumber(-1000)).toBe('-1000'); // Not '-1.0K'
      expect(formatCompactNumber(-1000000)).toBe('-1000000'); // Not '-1.0M'
      expect(formatCompactNumber(-999)).toBe('-999'); // Falls into < 1000 case
    });

    it('should handle edge cases at boundaries', () => {
      expect(formatCompactNumber(999)).toBe('999');
      expect(formatCompactNumber(1000)).toBe('1.0K');
      expect(formatCompactNumber(999999)).toBe('1000.0K');
      expect(formatCompactNumber(1000000)).toBe('1.0M');
    });
  });
});
