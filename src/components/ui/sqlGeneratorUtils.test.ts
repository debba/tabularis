import { describe, it, expect } from 'vitest';
import {
  getIdentifierQuote,
  generateColumnDefinition,
  generatePrimaryKeyConstraint,
  generateForeignKeyConstraints,
  generateIndexStatements,
  generateCreateTableSQL,
  type TableColumn,
  type ForeignKey,
  type Index,
} from './sqlGeneratorUtils';

describe('sqlGeneratorUtils', () => {
  describe('getIdentifierQuote', () => {
    it('should return backtick for MySQL', () => {
      expect(getIdentifierQuote('mysql')).toBe('`');
    });

    it('should return backtick for MariaDB', () => {
      expect(getIdentifierQuote('mariadb')).toBe('`');
    });

    it('should return double quote for PostgreSQL', () => {
      expect(getIdentifierQuote('postgresql')).toBe('"');
    });

    it('should return double quote for SQLite', () => {
      expect(getIdentifierQuote('sqlite')).toBe('"');
    });
  });

  describe('generateColumnDefinition', () => {
    const baseColumn: TableColumn = {
      name: 'id',
      data_type: 'INT',
      is_pk: true,
      is_nullable: false,
      is_auto_increment: false,
      default_value: null,
    };

    it('should generate basic column definition', () => {
      const col = { ...baseColumn, is_nullable: true };
      const result = generateColumnDefinition(col, 'mysql', '`');
      expect(result).toBe('  `id` INT');
    });

    it('should add NOT NULL for non-nullable columns', () => {
      const result = generateColumnDefinition(baseColumn, 'mysql', '`');
      expect(result).toBe('  `id` INT NOT NULL');
    });

    it('should add DEFAULT value', () => {
      const col = { ...baseColumn, default_value: '0' };
      const result = generateColumnDefinition(col, 'mysql', '`');
      expect(result).toBe('  `id` INT NOT NULL DEFAULT 0');
    });

    it('should handle AUTO_INCREMENT for MySQL', () => {
      const col = { ...baseColumn, is_auto_increment: true };
      const result = generateColumnDefinition(col, 'mysql', '`');
      expect(result).toContain('AUTO_INCREMENT');
    });

    it('should handle AUTO_INCREMENT for MariaDB', () => {
      const col = { ...baseColumn, is_auto_increment: true };
      const result = generateColumnDefinition(col, 'mariadb', '`');
      expect(result).toContain('AUTO_INCREMENT');
    });

    it('should convert to INTEGER PRIMARY KEY AUTOINCREMENT for SQLite', () => {
      const col = { ...baseColumn, is_auto_increment: true };
      const result = generateColumnDefinition(col, 'sqlite', '"');
      expect(result).toContain('INTEGER PRIMARY KEY AUTOINCREMENT');
    });

    it('should convert to SERIAL for PostgreSQL', () => {
      const col = { ...baseColumn, is_auto_increment: true };
      const result = generateColumnDefinition(col, 'postgresql', '"');
      expect(result).toContain('SERIAL');
    });

    it('should handle string default values', () => {
      const col: TableColumn = {
        ...baseColumn,
        name: 'status',
        data_type: 'VARCHAR(255)',
        default_value: "'active'",
      };
      const result = generateColumnDefinition(col, 'mysql', '`');
      expect(result).toContain("DEFAULT 'active'");
    });
  });

  describe('generatePrimaryKeyConstraint', () => {
    it('should return null when no PK columns', () => {
      const columns: TableColumn[] = [
        { name: 'name', data_type: 'VARCHAR(100)', is_pk: false, is_nullable: true, is_auto_increment: false, default_value: null },
      ];
      const result = generatePrimaryKeyConstraint(columns, 'mysql', '`');
      expect(result).toBeNull();
    });

    it('should return null for SQLite', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: true, default_value: null },
      ];
      const result = generatePrimaryKeyConstraint(columns, 'sqlite', '"');
      expect(result).toBeNull();
    });

    it('should generate single column PK for MySQL', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: true, default_value: null },
      ];
      const result = generatePrimaryKeyConstraint(columns, 'mysql', '`');
      expect(result).toBe('  PRIMARY KEY (`id`)');
    });

    it('should generate composite PK for PostgreSQL', () => {
      const columns: TableColumn[] = [
        { name: 'order_id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: false, default_value: null },
        { name: 'product_id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: false, default_value: null },
      ];
      const result = generatePrimaryKeyConstraint(columns, 'postgresql', '"');
      expect(result).toBe('  PRIMARY KEY ("order_id", "product_id")');
    });
  });

  describe('generateForeignKeyConstraints', () => {
    it('should generate single FK constraint', () => {
      const fks: ForeignKey[] = [
        { name: 'fk_user', column_name: 'user_id', ref_table: 'users', ref_column: 'id' },
      ];
      const result = generateForeignKeyConstraints(fks, '`');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('  CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)');
    });

    it('should generate multiple FK constraints', () => {
      const fks: ForeignKey[] = [
        { name: 'fk_user', column_name: 'user_id', ref_table: 'users', ref_column: 'id' },
        { name: 'fk_product', column_name: 'product_id', ref_table: 'products', ref_column: 'id' },
      ];
      const result = generateForeignKeyConstraints(fks, '"');
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('"fk_user"');
      expect(result[1]).toContain('"fk_product"');
    });

    it('should return empty array when no FKs', () => {
      const result = generateForeignKeyConstraints([], '`');
      expect(result).toEqual([]);
    });
  });

  describe('generateIndexStatements', () => {
    it('should generate unique index statement', () => {
      const indexes: Index[] = [
        { name: 'idx_email', column_name: 'email', is_unique: true, is_primary: false },
      ];
      const result = generateIndexStatements(indexes, 'users', '`');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('CREATE UNIQUE INDEX `idx_email` ON `users` (`email`);');
    });

    it('should generate non-unique index statement', () => {
      const indexes: Index[] = [
        { name: 'idx_name', column_name: 'name', is_unique: false, is_primary: false },
      ];
      const result = generateIndexStatements(indexes, 'users', '`');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('CREATE INDEX `idx_name` ON `users` (`name`);');
    });

    it('should skip primary key indexes', () => {
      const indexes: Index[] = [
        { name: 'PRIMARY', column_name: 'id', is_unique: true, is_primary: true },
        { name: 'idx_name', column_name: 'name', is_unique: false, is_primary: false },
      ];
      const result = generateIndexStatements(indexes, 'users', '`');
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('idx_name');
    });

    it('should generate multiple index statements', () => {
      const indexes: Index[] = [
        { name: 'idx_email', column_name: 'email', is_unique: true, is_primary: false },
        { name: 'idx_status', column_name: 'status', is_unique: false, is_primary: false },
      ];
      const result = generateIndexStatements(indexes, 'users', '"');
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('UNIQUE');
      expect(result[1]).not.toContain('UNIQUE');
    });

    it('should return empty array when no indexes', () => {
      const result = generateIndexStatements([], 'users', '`');
      expect(result).toEqual([]);
    });
  });

  describe('generateCreateTableSQL', () => {
    it('should generate basic CREATE TABLE for MySQL', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: true, default_value: null },
        { name: 'name', data_type: 'VARCHAR(255)', is_pk: false, is_nullable: false, is_auto_increment: false, default_value: null },
      ];
      const result = generateCreateTableSQL('users', columns, [], [], 'mysql');
      expect(result).toContain('CREATE TABLE `users` (');
      expect(result).toContain('`id` INT NOT NULL AUTO_INCREMENT');
      expect(result).toContain('`name` VARCHAR(255) NOT NULL');
      expect(result).toContain('PRIMARY KEY (`id`)');
    });

    it('should generate CREATE TABLE with foreign keys for PostgreSQL', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'SERIAL', is_pk: true, is_nullable: false, is_auto_increment: false, default_value: null },
        { name: 'user_id', data_type: 'INT', is_pk: false, is_nullable: true, is_auto_increment: false, default_value: null },
      ];
      const fks: ForeignKey[] = [
        { name: 'fk_user', column_name: 'user_id', ref_table: 'users', ref_column: 'id' },
      ];
      const result = generateCreateTableSQL('orders', columns, fks, [], 'postgresql');
      expect(result).toContain('"orders"');
      expect(result).toContain('FOREIGN KEY ("user_id")');
      expect(result).toContain('REFERENCES "users"');
    });

    it('should generate CREATE TABLE with indexes for SQLite', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'INTEGER', is_pk: true, is_nullable: false, is_auto_increment: true, default_value: null },
        { name: 'email', data_type: 'TEXT', is_pk: false, is_nullable: false, is_auto_increment: false, default_value: null },
      ];
      const indexes: Index[] = [
        { name: 'idx_email', column_name: 'email', is_unique: true, is_primary: false },
      ];
      const result = generateCreateTableSQL('users', columns, [], indexes, 'sqlite');
      expect(result).toContain('CREATE TABLE "users"');
      expect(result).toContain('INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(result).toContain('CREATE UNIQUE INDEX "idx_email"');
    });

    it('should handle all features combined', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: true, default_value: null },
        { name: 'email', data_type: 'VARCHAR(255)', is_pk: false, is_nullable: false, is_auto_increment: false, default_value: null },
        { name: 'status', data_type: 'VARCHAR(50)', is_pk: false, is_nullable: true, is_auto_increment: false, default_value: "'active'" },
      ];
      const fks: ForeignKey[] = [];
      const indexes: Index[] = [
        { name: 'idx_email', column_name: 'email', is_unique: true, is_primary: false },
        { name: 'idx_status', column_name: 'status', is_unique: false, is_primary: false },
      ];
      const result = generateCreateTableSQL('users', columns, fks, indexes, 'mysql');
      
      // Verify structure
      expect(result).toContain('CREATE TABLE `users`');
      expect(result).toContain('`id` INT NOT NULL AUTO_INCREMENT');
      expect(result).toContain('`email` VARCHAR(255) NOT NULL');
      expect(result).toContain('`status` VARCHAR(50) DEFAULT \'active\'');
      expect(result).toContain('PRIMARY KEY (`id`)');
      expect(result).toContain('CREATE UNIQUE INDEX `idx_email`');
      expect(result).toContain('CREATE INDEX `idx_status`');
    });

    it('should end with semicolon', () => {
      const columns: TableColumn[] = [
        { name: 'id', data_type: 'INT', is_pk: true, is_nullable: false, is_auto_increment: false, default_value: null },
      ];
      const result = generateCreateTableSQL('test', columns, [], [], 'mysql');
      expect(result.trim().endsWith(');')).toBe(true);
    });
  });
});
