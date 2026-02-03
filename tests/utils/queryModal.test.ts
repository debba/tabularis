import { describe, it, expect } from 'vitest';
import {
  validateQueryForm,
  cleanQueryFormData,
  hasMeaningfulSql,
  validateSqlSyntax,
  type QueryFormData,
} from '../../src/utils/queryModal';

describe('queryModal', () => {
  describe('validateQueryForm', () => {
    it('should validate valid form data', () => {
      const data: QueryFormData = {
        name: 'Test Query',
        sql: 'SELECT * FROM users',
      };
      const result = validateQueryForm(data);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty name', () => {
      const data: QueryFormData = {
        name: '',
        sql: 'SELECT * FROM users',
      };
      const result = validateQueryForm(data);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject whitespace-only name', () => {
      const data: QueryFormData = {
        name: '   ',
        sql: 'SELECT * FROM users',
      };
      const result = validateQueryForm(data);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject empty sql', () => {
      const data: QueryFormData = {
        name: 'Test Query',
        sql: '',
      };
      const result = validateQueryForm(data);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SQL content is required');
    });

    it('should reject whitespace-only sql', () => {
      const data: QueryFormData = {
        name: 'Test Query',
        sql: '   \n\t  ',
      };
      const result = validateQueryForm(data);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SQL content is required');
    });

    it('should reject both empty fields', () => {
      const data: QueryFormData = {
        name: '',
        sql: '',
      };
      const result = validateQueryForm(data);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });
  });

  describe('cleanQueryFormData', () => {
    it('should trim whitespace from name and sql', () => {
      const data: QueryFormData = {
        name: '  Test Query  ',
        sql: '  SELECT * FROM users  ',
      };
      const result = cleanQueryFormData(data);
      expect(result.name).toBe('Test Query');
      expect(result.sql).toBe('SELECT * FROM users');
    });

    it('should handle already trimmed values', () => {
      const data: QueryFormData = {
        name: 'Test',
        sql: 'SELECT 1',
      };
      const result = cleanQueryFormData(data);
      expect(result.name).toBe('Test');
      expect(result.sql).toBe('SELECT 1');
    });

    it('should handle empty strings', () => {
      const data: QueryFormData = {
        name: '',
        sql: '',
      };
      const result = cleanQueryFormData(data);
      expect(result.name).toBe('');
      expect(result.sql).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      const data: QueryFormData = {
        name: '   ',
        sql: '   \n\t   ',
      };
      const result = cleanQueryFormData(data);
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
      cleanQueryFormData(data);
      expect(data.name).toBe(originalName);
      expect(data.sql).toBe(originalSql);
    });
  });

  describe('hasMeaningfulSql', () => {
    it('should return true for valid SQL', () => {
      expect(hasMeaningfulSql('SELECT * FROM users')).toBe(true);
      expect(hasMeaningfulSql('INSERT INTO table VALUES (1, 2)')).toBe(true);
    });

    it('should return false for empty SQL', () => {
      expect(hasMeaningfulSql('')).toBe(false);
    });

    it('should return false for whitespace-only SQL', () => {
      expect(hasMeaningfulSql('   ')).toBe(false);
      expect(hasMeaningfulSql('\n\t  \n')).toBe(false);
    });

    it('should return false for comment-only SQL', () => {
      expect(hasMeaningfulSql('-- just a comment')).toBe(false);
      expect(hasMeaningfulSql('/* block comment */')).toBe(false);
    });

    it('should return true for SQL with comments and code', () => {
      expect(hasMeaningfulSql('-- get users\nSELECT * FROM users')).toBe(true);
      expect(hasMeaningfulSql('/* query */ SELECT 1')).toBe(true);
    });

    it('should handle multiple line comments', () => {
      const sql = `
        -- First comment
        -- Second comment
        SELECT 1
      `;
      expect(hasMeaningfulSql(sql)).toBe(true);
    });

    it('should handle block comments', () => {
      const sql = `
        /* Multi-line
           block comment */
        SELECT * FROM table
      `;
      expect(hasMeaningfulSql(sql)).toBe(true);
    });

    it('should handle nested comment-like patterns', () => {
      const sql = `
        -- comment /* not a block */
        SELECT 1
      `;
      expect(hasMeaningfulSql(sql)).toBe(true);
    });
  });

  describe('validateSqlSyntax', () => {
    it('should validate simple SELECT', () => {
      const result = validateSqlSyntax('SELECT * FROM users');
      expect(result.valid).toBe(true);
    });

    it('should reject empty SQL', () => {
      const result = validateSqlSyntax('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SQL cannot be empty');
    });

    it('should reject whitespace-only SQL', () => {
      const result = validateSqlSyntax('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SQL cannot be empty');
    });

    it('should detect DROP pattern', () => {
      const result = validateSqlSyntax('SELECT 1; DROP TABLE users');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Potentially dangerous SQL pattern detected');
    });

    it('should detect DELETE pattern', () => {
      const result = validateSqlSyntax('SELECT 1; DELETE FROM users');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Potentially dangerous SQL pattern detected');
    });

    it('should detect TRUNCATE pattern', () => {
      const result = validateSqlSyntax('SELECT 1; TRUNCATE TABLE users');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Potentially dangerous SQL pattern detected');
    });

    it('should allow DELETE within safe context', () => {
      // Note: This is a limitation of the simple regex check
      // DELETE without semicolon prefix is allowed by current implementation
      const result = validateSqlSyntax('DELETE FROM users WHERE id = 1');
      expect(result.valid).toBe(true);
    });

    it('should be case-insensitive for dangerous patterns', () => {
      expect(validateSqlSyntax('; DROP table').valid).toBe(false);
      expect(validateSqlSyntax('; Delete from').valid).toBe(false);
      expect(validateSqlSyntax('; TRUNCATE table').valid).toBe(false);
    });

    it('should handle multiline SQL', () => {
      const sql = `
        SELECT *
        FROM users
        WHERE id = 1
      `;
      const result = validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });
  });
});
