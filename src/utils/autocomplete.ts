import type { Monaco } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import type { TableInfo } from "../contexts/DatabaseContext";
import { getCurrentStatement, parseTablesFromQuery } from "./sqlAnalysis";

// Lightweight column cache with TTL and size limits
interface CachedColumns {
  data: Array<{ label: string; detail: string }>;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 50; // Limit total cached tables
const columnsCache = new Map<string, CachedColumns>();

// Pre-built keyword suggestions (reused, not recreated each time)
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT", "OFFSET",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "JOIN", "LEFT JOIN",
  "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "ON", "AND", "OR", "NOT", "NULL",
  "IS", "IN", "BETWEEN", "LIKE", "AS", "DISTINCT", "COUNT", "SUM", "AVG",
  "MIN", "MAX", "HAVING", "CASE", "WHEN", "THEN", "ELSE", "END", "CREATE",
  "TABLE", "DROP", "ALTER", "INDEX", "PRIMARY KEY", "FOREIGN KEY", "REFERENCES"
] as const;

// Cache cleanup to prevent unbounded growth
const cleanupCache = () => {
  if (columnsCache.size <= MAX_CACHE_ENTRIES) return;
  
  const now = Date.now();
  const entries = Array.from(columnsCache.entries());
  
  // Remove expired entries first
  for (const [key, value] of entries) {
    if (now - value.timestamp > CACHE_TTL) {
      columnsCache.delete(key);
    }
  }
  
  // If still over limit, remove oldest entries
  if (columnsCache.size > MAX_CACHE_ENTRIES) {
    const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = sorted.slice(0, columnsCache.size - MAX_CACHE_ENTRIES);
    toRemove.forEach(([key]) => columnsCache.delete(key));
  }
};

const getTableColumns = async (connectionId: string, tableName: string, schema?: string | null) => {
  if (!connectionId || !tableName) return [];

  const cacheKey = schema ? `${connectionId}:${schema}:${tableName}` : `${connectionId}:${tableName}`;
  const cached = columnsCache.get(cacheKey);

  // Return cached data if valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const cols = await invoke<Array<{ name: string; data_type: string }>>("get_columns", {
      connectionId,
      tableName,
      ...(schema ? { schema } : {}),
    });
    
    if (!Array.isArray(cols)) {
      console.warn(`get_columns returned non-array for table ${tableName}`, cols);
      return [];
    }

    // Store only essential data (no kind, insertText duplicates)
    const simpleCols = cols.map(c => ({
      label: c.name,
      detail: c.data_type,
    }));

    columnsCache.set(cacheKey, {
      data: simpleCols,
      timestamp: Date.now()
    });
    
    cleanupCache();
    return simpleCols;
  } catch (e) {
    console.error(`Failed to fetch columns for autocomplete: ${tableName}`, e);
    return [];
  }
};

// Clear cache for a specific connection (call on disconnect)
export const clearAutocompleteCache = (connectionId?: string) => {
  if (connectionId) {
    const keysToDelete = Array.from(columnsCache.keys())
      .filter(key => key.startsWith(`${connectionId}:`));
    keysToDelete.forEach(key => columnsCache.delete(key));
  } else {
    columnsCache.clear();
  }
};

export const registerSqlAutocomplete = (
  monaco: Monaco,
  connectionId: string | null,
  tables: TableInfo[],
  schema?: string | null,
) => {
  const provider = monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", " ", "\n"],
    provideCompletionItems: async (model: { getWordUntilPosition: (position: { lineNumber: number; column: number }) => { startColumn: number; endColumn: number }; getValueInRange: (range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => string; getValue: () => string; getOffsetAt: (position: { lineNumber: number; column: number }) => number }, position: { lineNumber: number; column: number }) => {
      if (!connectionId) return { suggestions: [] };

      const wordUntil = model.getWordUntilPosition(position);
      
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordUntil.startColumn,
        endColumn: wordUntil.endColumn,
      };

      // Get text until cursor position
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Get current statement context
      const currentStatement = getCurrentStatement(model, position);
      const tableAliases = parseTablesFromQuery(currentStatement);

      // ============================================
      // 1. DOT TRIGGER (table.column or alias.column)
      // ============================================
      const dotMatch = textUntilPosition.match(/(?:["'`])?([a-zA-Z0-9_]+)(?:["'`])?\.([a-zA-Z0-9_]*)$/);
      
      if (dotMatch) {
        const typedName = dotMatch[1].toLowerCase();
        const partialColumn = dotMatch[2]; // What user has typed after the dot
        
        // Check if it's an alias or table name
        let actualTableName = tableAliases?.get(typedName);
        
        if (!actualTableName) {
          // Try direct table name match
          const foundTable = tables.find(t => t.name.toLowerCase() === typedName);
          actualTableName = foundTable?.name;
        }
        
        if (actualTableName) {
          const columns = await getTableColumns(connectionId, actualTableName, schema);
          
          // Calculate range for column name after dot
          const columnRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - partialColumn.length,
            endColumn: position.column,
          };
          
          const suggestions = columns.map(c => ({
            label: c.label,
            kind: monaco.languages.CompletionItemKind.Field,
            detail: c.detail,
            insertText: c.label,
            range: columnRange,
            sortText: `0_${c.label}`,
          }));
          
          return { suggestions };
        }
      }

      // ============================================
      // 2. CONTEXT-AWARE COLUMN SUGGESTIONS
      // ============================================
      const contextColumnSuggestions: Array<{
        label: string;
        kind: number;
        detail: string;
        insertText: string;
        range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number };
        sortText: string;
      }> = [];
      
      if (tableAliases && tableAliases.size > 0) {
        // User is inside a query with FROM/JOIN - suggest columns from those tables
        const tableNames = Array.from(new Set(tableAliases.values()));
        const matchingTables = tableNames
          .map(name => tables.find(t => t.name.toLowerCase() === name.toLowerCase()))
          .filter(Boolean) as TableInfo[];
        
        // Limit parallel fetches to prevent memory spikes
        const MAX_PARALLEL_FETCHES = 5;
        if (matchingTables.length > MAX_PARALLEL_FETCHES) {
          matchingTables.splice(MAX_PARALLEL_FETCHES);
        }
        
        const results = await Promise.all(
          matchingTables.map(t => getTableColumns(connectionId, t.name, schema))
        );
        
        const seenColumns = new Set<string>();
        
        matchingTables.forEach((table, idx) => {
          const columns = results[idx];
          columns.forEach(col => {
            const key = `${col.label}`;
            if (!seenColumns.has(key)) {
              seenColumns.add(key);
              
              // Find alias for this table (if any)
              let aliasHint = "";
              for (const [alias, tableName] of tableAliases.entries()) {
                if (tableName.toLowerCase() === table.name.toLowerCase() && alias !== table.name.toLowerCase()) {
                  aliasHint = ` (${alias})`;
                  break;
                }
              }
              
              contextColumnSuggestions.push({
                label: col.label,
                kind: monaco.languages.CompletionItemKind.Field,
                detail: `${col.detail} — ${table.name}${aliasHint}`,
                insertText: col.label,
                range,
                sortText: `0_${col.label}`,
              });
            }
          });
        });
      }

      // ============================================
      // 3. KEYWORD SUGGESTIONS (only if no context columns)
      // ============================================
      let keywordSuggestions: Array<{
        label: string;
        kind: number;
        insertText: string;
        range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number };
        sortText: string;
      }> = [];
      if (contextColumnSuggestions.length === 0) {
        keywordSuggestions = SQL_KEYWORDS.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: `2_${kw}`
        }));
      }

      // ============================================
      // 4. TABLE SUGGESTIONS (limit to 50 for large schemas)
      // ============================================
      const MAX_TABLE_SUGGESTIONS = 50;
      const tablesToShow = tables.length > MAX_TABLE_SUGGESTIONS 
        ? tables.slice(0, MAX_TABLE_SUGGESTIONS) 
        : tables;
      
      const tableSuggestions = tablesToShow.map((t) => ({
        label: t.name,
        kind: monaco.languages.CompletionItemKind.Class,
        detail: "Table",
        insertText: t.name,
        range,
        sortText: `1_${t.name}`
      }));

      // Combine suggestions with smart limits
      const allSuggestions = [
        ...contextColumnSuggestions,
        ...tableSuggestions,
        ...keywordSuggestions
      ];
      
      // Monaco handles filtering/limiting internally, but we cap total results
      const MAX_TOTAL_SUGGESTIONS = 200;
      
      return {
        suggestions: allSuggestions.slice(0, MAX_TOTAL_SUGGESTIONS),
      };
    },
  });

  return provider;
};
