export const extractQueryParams = (sql: string): string[] => {
  if (!sql) return [];
  // Matches :paramName but ignores ::cast (Postgres)
  // Look for colon followed by word characters, ensuring it's not preceded by a colon
  const regex = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(?!\w)/g;
  const matches = sql.match(regex);
  if (!matches) return [];
  
  // Remove duplicate parameters and the leading colon
  const uniqueParams = new Set(matches.map(m => m.substring(1)));
  return Array.from(uniqueParams);
};

export const interpolateQueryParams = (sql: string, params: Record<string, string>): string => {
  if (!sql) return "";
  
  // Values are substituted verbatim; callers are responsible for quoting.
  // SQL injection risk is accepted at the UI layer — this is a developer tool.
  return sql.replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(?!\w)/g, (match, paramName) => {
    if (params[paramName] !== undefined) {
      return params[paramName];
    }
    return match; // Leave it if no value found (though logic should prevent this)
  });
};
