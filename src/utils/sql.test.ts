import { describe, it, expect } from 'vitest';
import { splitQueries, extractTableName } from './sql';

describe('sql utils', () => {
  describe('splitQueries', () => {
    it('should split multiple queries by semicolon', () => {
      const sql = 'SELECT * FROM users; SELECT * FROM posts;';
      const result = splitQueries(sql);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('SELECT * FROM users');
      expect(result[1]).toBe('SELECT * FROM posts');
    });

    it('should handle single query without semicolon', () => {
      const sql = 'SELECT * FROM users';
      const result = splitQueries(sql);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('SELECT * FROM users');
    });

    it('should ignore semicolons inside quotes', () => {
      const sql = "SELECT * FROM users WHERE name = 'John; Doe'; SELECT 2";
      const result = splitQueries(sql);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe("SELECT * FROM users WHERE name = 'John; Doe'");
      expect(result[1]).toBe('SELECT 2');
    });

    it('should ignore semicolons inside comments', () => {
      const sql = 'SELECT 1; -- comment with ; \n SELECT 2';
      const result = splitQueries(sql);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('SELECT 1');
      expect(result[1]).toContain('SELECT 2');
    });
  });

  describe('extractTableName', () => {
    it('should extract table name from simple SELECT', () => {
      expect(extractTableName('SELECT * FROM users')).toBe('users');
      expect(extractTableName('select * from "users"')).toBe('users');
      expect(extractTableName("SELECT * FROM `my_table` WHERE id = 1")).toBe('my_table');
    });

    it('should return null for non-SELECT queries', () => {
      expect(extractTableName('UPDATE users SET name="test"')).toBeNull();
      expect(extractTableName('DELETE FROM users')).toBeNull();
    });

    it('should return null for aggregate queries', () => {
        expect(extractTableName('SELECT COUNT(*) FROM users')).toBeNull();
        expect(extractTableName('SELECT SUM(price) FROM orders')).toBeNull();
        expect(extractTableName('SELECT * FROM users GROUP BY type')).toBeNull();
    });
  });
});
