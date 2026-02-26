/**
 * SQL Generation utilities for CREATE TABLE statements
 * Supports multiple database drivers with driver-specific syntax,
 * via either legacy string driver IDs or DriverCapabilities objects.
 */

import type { DriverCapabilities } from "../types/plugins";

export interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
  default_value: string | null;
}

export interface ForeignKey {
  name: string;
  column_name: string;
  ref_table: string;
  ref_column: string;
}

export interface Index {
  name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

export type DatabaseDriver = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite';

interface ResolvedSqlCapabilities {
  quote: string;
  auto_increment_keyword: string;
  serial_type: string;
  inline_pk: boolean;
}

/**
 * Resolves SQL generation capabilities from either a DriverCapabilities object
 * or a legacy string driver ID.
 */
function resolveSqlCapabilities(
  driver: DriverCapabilities | DatabaseDriver,
): ResolvedSqlCapabilities {
  if (typeof driver === 'object') {
    return {
      quote: driver.identifier_quote || '"',
      auto_increment_keyword: driver.auto_increment_keyword || '',
      serial_type: driver.serial_type || '',
      inline_pk: driver.inline_pk ?? false,
    };
  }
  // Legacy string driver IDs
  switch (driver) {
    case 'mysql':
    case 'mariadb':
      return { quote: '`', auto_increment_keyword: 'AUTO_INCREMENT', serial_type: '', inline_pk: false };
    case 'postgresql':
      return { quote: '"', auto_increment_keyword: '', serial_type: 'SERIAL', inline_pk: false };
    case 'sqlite':
      return { quote: '"', auto_increment_keyword: 'AUTOINCREMENT', serial_type: '', inline_pk: true };
    default:
      return { quote: '"', auto_increment_keyword: '', serial_type: '', inline_pk: false };
  }
}

/**
 * Gets the quote character for identifiers based on driver.
 * Accepts either a DriverCapabilities object (uses identifier_quote) or
 * a legacy string driver ID (MySQL/MariaDB use backticks, others use double quotes).
 */
export function getIdentifierQuote(driver: DriverCapabilities | DatabaseDriver): string {
  if (typeof driver === 'object') {
    return driver.identifier_quote || '"';
  }
  return driver === 'mysql' || driver === 'mariadb' ? '`' : '"';
}

/**
 * Generates column definition SQL for a single column.
 * Accepts either a DriverCapabilities object or a legacy string driver ID.
 * When driver is a DriverCapabilities object, the quote parameter is derived from
 * driver.identifier_quote; the passed quote is used only for legacy string drivers.
 */
export function generateColumnDefinition(
  column: TableColumn,
  driver: DriverCapabilities | DatabaseDriver,
  quote: string,
): string {
  const caps = resolveSqlCapabilities(driver);
  const q = typeof driver === 'object' ? caps.quote : quote;

  if (column.is_auto_increment) {
    if (caps.inline_pk) {
      // Inline PK style (e.g. SQLite): "id" INTEGER PRIMARY KEY AUTOINCREMENT
      // The data type is replaced by INTEGER and the PK constraint is inline.
      return `  ${q}${column.name}${q} INTEGER PRIMARY KEY ${caps.auto_increment_keyword}`.trimEnd();
    }

    if (caps.serial_type) {
      // Type replacement style (e.g. PostgreSQL SERIAL): rebuild with replacement type.
      let def = `  ${q}${column.name}${q} ${caps.serial_type}`;
      if (!column.is_nullable) def += ' NOT NULL';
      if (column.default_value !== null && column.default_value !== undefined) {
        def += ` DEFAULT ${column.default_value}`;
      }
      return def;
    }
  }

  let def = `  ${q}${column.name}${q} ${column.data_type}`;

  if (!column.is_nullable) {
    def += ' NOT NULL';
  }

  if (column.default_value !== null && column.default_value !== undefined) {
    def += ` DEFAULT ${column.default_value}`;
  }

  if (column.is_auto_increment && caps.auto_increment_keyword) {
    // Keyword append style (e.g. MySQL AUTO_INCREMENT)
    def += ` ${caps.auto_increment_keyword}`;
  }

  return def;
}

/**
 * Generates the PRIMARY KEY constraint clause.
 * When inline_pk is true (e.g. SQLite), returns null because the PK is in the column def.
 * Accepts either a DriverCapabilities object or a legacy string driver ID.
 */
export function generatePrimaryKeyConstraint(
  columns: TableColumn[],
  driver: DriverCapabilities | DatabaseDriver,
  quote: string,
): string | null {
  const caps = resolveSqlCapabilities(driver);
  const q = typeof driver === 'object' ? caps.quote : quote;
  const pkColumns = columns.filter(c => c.is_pk).map(c => `${q}${c.name}${q}`);

  if (pkColumns.length === 0) return null;
  if (caps.inline_pk) return null;

  return `  PRIMARY KEY (${pkColumns.join(', ')})`;
}

/**
 * Generates FOREIGN KEY constraint clauses
 */
export function generateForeignKeyConstraints(
  foreignKeys: ForeignKey[],
  quote: string
): string[] {
  return foreignKeys.map(fk =>
    `  CONSTRAINT ${quote}${fk.name}${quote} FOREIGN KEY (${quote}${fk.column_name}${quote}) ` +
    `REFERENCES ${quote}${fk.ref_table}${quote} (${quote}${fk.ref_column}${quote})`
  );
}

/**
 * Generates CREATE INDEX statements
 */
export function generateIndexStatements(
  indexes: Index[],
  tableName: string,
  quote: string
): string[] {
  const statements: string[] = [];

  // Unique indexes (excluding primary keys)
  const uniqueIndexes = indexes.filter(idx => idx.is_unique && !idx.is_primary);
  uniqueIndexes.forEach(idx => {
    statements.push(
      `CREATE UNIQUE INDEX ${quote}${idx.name}${quote} ON ${quote}${tableName}${quote} (${quote}${idx.column_name}${quote});`
    );
  });

  // Non-unique indexes (excluding primary keys)
  const nonUniqueIndexes = indexes.filter(idx => !idx.is_unique && !idx.is_primary);
  nonUniqueIndexes.forEach(idx => {
    statements.push(
      `CREATE INDEX ${quote}${idx.name}${quote} ON ${quote}${tableName}${quote} (${quote}${idx.column_name}${quote});`
    );
  });

  return statements;
}

/**
 * Generates complete CREATE TABLE SQL statement.
 * Accepts either a DriverCapabilities object (preferred, driver-agnostic) or
 * a legacy string driver ID (for backward compatibility).
 */
export function generateCreateTableSQL(
  tableName: string,
  columns: TableColumn[],
  foreignKeys: ForeignKey[],
  indexes: Index[],
  driver: DriverCapabilities | DatabaseDriver
): string {
  const caps = resolveSqlCapabilities(driver);
  const quote = caps.quote;
  const lines: string[] = [];

  // Start CREATE TABLE
  lines.push(`CREATE TABLE ${quote}${tableName}${quote} (`);

  // Column definitions
  const columnDefs = columns.map(col => generateColumnDefinition(col, driver, quote));

  // Primary key constraint (if not handled in column def)
  const pkConstraint = generatePrimaryKeyConstraint(columns, driver, quote);
  if (pkConstraint) {
    columnDefs.push(pkConstraint);
  }

  // Foreign key constraints
  const fkConstraints = generateForeignKeyConstraints(foreignKeys, quote);
  columnDefs.push(...fkConstraints);

  // Close column definitions
  lines.push(columnDefs.join(',\n'));
  lines.push(');');

  // Index statements
  const indexStatements = generateIndexStatements(indexes, tableName, quote);
  if (indexStatements.length > 0) {
    lines.push('');
    lines.push(...indexStatements);
  }

  return lines.join('\n');
}
