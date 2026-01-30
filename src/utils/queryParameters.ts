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
  
  // Replace :paramName with the value (quoted if string-like logic is needed, 
  // but for now we trust the user or treat everything as a string/number literal).
  // Standard practice for client-side interpolation without type info:
  // If it looks like a number, keep it raw. If it looks like a string, quote it.
  // HOWEVER, DataGrip usually expects the user to type 'value' or 123 in the box.
  // If the user types 123, it's 123. If they type 'abc', it's 'abc'.
  // If they type abc (no quotes), it might be a column name or syntax error.
  // Let's implement a simple direct replacement first. 
  
  return sql.replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(?!\w)/g, (match, paramName) => {
    if (params[paramName] !== undefined) {
      return params[paramName];
    }
    return match; // Leave it if no value found (though logic should prevent this)
  });
};
