/**
 * Returns the appropriate quote character for SQL identifiers based on the database driver.
 * MySQL/MariaDB use backticks (`), while PostgreSQL and SQLite use double quotes (").
 */
export function getQuoteChar(driver: string | null | undefined): string {
  return driver === "mysql" || driver === "mariadb" ? "`" : '"';
}

/**
 * Quotes a SQL identifier (table name, column name, view name, etc.) using the appropriate
 * quote character for the given database driver.
 * 
 * @param identifier - The identifier to quote (e.g., table name, column name)
 * @param driver - The database driver ("mysql", "mariadb", "postgres", "sqlite")
 * @returns The quoted identifier
 * 
 * @example
 * quoteIdentifier("my table", "mysql") // returns: `my table`
 * quoteIdentifier("my_table", "postgres") // returns: "my_table"
 */
export function quoteIdentifier(identifier: string, driver: string | null | undefined): string {
  const quote = getQuoteChar(driver);
  const escaped = quote === "`" ? identifier.replace(/`/g, "``") : identifier.replace(/"/g, '""');
  return `${quote}${escaped}${quote}`;
}

/**
 * Returns a schema-qualified, quoted table reference for use in SQL queries.
 * When a schema is provided, returns "schema"."table" (or `schema`.`table` for MySQL).
 * Otherwise returns just the quoted table name.
 */
export function quoteTableRef(
  table: string,
  driver: string | null | undefined,
  schema?: string | null,
): string {
  if (schema) {
    return `${quoteIdentifier(schema, driver)}.${quoteIdentifier(table, driver)}`;
  }
  return quoteIdentifier(table, driver);
}
