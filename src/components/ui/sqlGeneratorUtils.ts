/**
 * SQL Generation utilities for CREATE TABLE statements
 * Supports multiple database drivers with driver-specific syntax
 */

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

/**
 * Gets the quote character for identifiers based on driver
 * MySQL/MariaDB use backticks, PostgreSQL and SQLite use double quotes
 */
export function getIdentifierQuote(driver: DatabaseDriver): string {
  return driver === 'mysql' || driver === 'mariadb' ? '`' : '"';
}

/**
 * Generates column definition SQL for a single column
 */
export function generateColumnDefinition(
  column: TableColumn,
  driver: DatabaseDriver,
  quote: string
): string {
  let def = `  ${quote}${column.name}${quote} ${column.data_type}`;

  if (!column.is_nullable) {
    def += ' NOT NULL';
  }

  if (column.default_value !== null && column.default_value !== undefined) {
    def += ` DEFAULT ${column.default_value}`;
  }

  if (column.is_auto_increment) {
    if (driver === 'mysql' || driver === 'mariadb') {
      def += ' AUTO_INCREMENT';
    } else if (driver === 'sqlite') {
      def = def.replace(
        new RegExp(`^\\s*${quote}${column.name}${quote}\\s*`),
        `  ${quote}${column.name}${quote} INTEGER PRIMARY KEY AUTOINCREMENT `
      );
    } else if (driver === 'postgresql') {
      def = def.replace(
        new RegExp(`^\\s*${quote}${column.name}${quote}\\s*`),
        `  ${quote}${column.name}${quote} SERIAL `
      );
    }
  }

  return def;
}

/**
 * Generates the PRIMARY KEY constraint clause
 * Note: SQLite handles PK differently with AUTOINCREMENT
 */
export function generatePrimaryKeyConstraint(
  columns: TableColumn[],
  driver: DatabaseDriver,
  quote: string
): string | null {
  const pkColumns = columns.filter(c => c.is_pk).map(c => `${quote}${c.name}${quote}`);
  
  if (pkColumns.length === 0) return null;
  if (driver === 'sqlite') return null; // SQLite handles PK in column def
  
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
 * Generates complete CREATE TABLE SQL statement
 */
export function generateCreateTableSQL(
  tableName: string,
  columns: TableColumn[],
  foreignKeys: ForeignKey[],
  indexes: Index[],
  driver: DatabaseDriver
): string {
  const quote = getIdentifierQuote(driver);
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
