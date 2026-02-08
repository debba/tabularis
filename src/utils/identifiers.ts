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
  return `${quote}${identifier}${quote}`;
}
