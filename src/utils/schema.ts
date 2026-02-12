/**
 * Formats the count of database objects (tables, views, routines) into a compact summary string.
 *
 * @example formatObjectCount(3, 2, 1) // "3T / 2V / 1R"
 */
export function formatObjectCount(
  tables: number,
  views: number,
  routines: number,
): string {
  return `${tables}T / ${views}V / ${routines}R`;
}

/**
 * Filters a list of saved/selected schema names against the schemas actually
 * available in the current database, removing any stale entries.
 */
export function filterValidSchemas(
  saved: string[],
  available: string[],
): string[] {
  const availableSet = new Set(available);
  return saved.filter((s) => availableSet.has(s));
}

/**
 * Returns a sensible default schema from a list of available schemas.
 * Prefers "public" (the PostgreSQL default) when present; otherwise returns the first entry.
 * Returns undefined when the list is empty.
 */
export function getDefaultSchema(
  schemas: string[],
): string | undefined {
  if (schemas.length === 0) return undefined;
  if (schemas.includes("public")) return "public";
  return schemas[0];
}
