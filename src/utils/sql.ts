export function splitQueries(sql: string): string[] {
  const queries: string[] = [];
  let currentQuery = '';
  let inQuote = false;
  let quoteChar = '';
  let inLineComment = false; // --
  let inBlockComment = false; // /* */

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inLineComment) {
        if (char === '\n') inLineComment = false;
        currentQuery += char;
    } else if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            currentQuery += '*/';
            i++;
        } else {
            currentQuery += char;
        }
    } else if (inQuote) {
        if (char === quoteChar) {
            // Check for escape (double quote for SQL usually) - e.g. 'It''s'
            if (nextChar === quoteChar) {
                currentQuery += char + nextChar;
                i++;
            } else {
                inQuote = false;
                currentQuery += char;
            }
        } else {
            currentQuery += char;
        }
    } else {
        // Normal state
        if (char === '-' && nextChar === '-') {
            inLineComment = true;
            currentQuery += '--';
            i++;
        } else if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            currentQuery += '/*';
            i++;
        } else if (char === "'" || char === '"' || char === '`') {
            inQuote = true;
            quoteChar = char;
            currentQuery += char;
        } else if (char === ';') {
            if (currentQuery.trim()) {
                queries.push(currentQuery.trim());
            }
            currentQuery = '';
        } else {
            currentQuery += char;
        }
    }
  }
  if (currentQuery.trim()) {
      queries.push(currentQuery.trim());
  }
  return queries;
}
