---
title: "SQL Editor"
order: 4
excerpt: "How to use the modern SQL editor in Tabularis with syntax highlighting, autocomplete, and multi-tab support."
---

# SQL Editor

The **SQL Editor** in Tabularis is built around a highly customized integration of **Monaco** (the exact editor engine that powers VS Code). It provides a world-class typing experience optimized specifically for complex database querying.

## Intelligent Context-Aware Autocomplete

Unlike basic editors that simply suggest a static list of SQL keywords and table names, Tabularis implements a dynamic, context-aware autocomplete engine.

### How It Works
1. **AST Parsing**: As you type, a lightweight local parser analyzes your SQL statement to build an Abstract Syntax Tree (AST).
2. **Scope Resolution**: The engine identifies which tables are present in the `FROM` and `JOIN` clauses.
3. **Alias Mapping**: It maps aliases to their source tables (e.g., `FROM customer_orders AS co`).
4. **Targeted Suggestions**: When you type `co.`, the editor immediately suggests only the columns belonging to the `customer_orders` table, along with their data types.

### Caching Strategy
To ensure the editor remains responsive even on databases with thousands of tables, Tabularis caches schema metadata:
- **TTL**: Table metadata is cached in memory for 5 minutes.
- **Size limit**: The cache holds metadata for at most 50 tables. When the limit is exceeded, expired entries are evicted first; if still over the limit, the oldest entries are removed.
- **Manual Invalidation**: You can force a cache clear by clicking the "Refresh Schema" button in the sidebar or via the Command Palette.

## Editor Features & Shortcuts

The Monaco integration brings powerful developer features:

| Feature | Shortcut (Mac) | Shortcut (Win/Linux) | Description |
| :--- | :--- | :--- | :--- |
| **Execute** | `Cmd + Enter` or `Cmd + F5` | `Ctrl + Enter` or `Ctrl + F5` | Runs the selected text, or the entire script if nothing is selected. |
| **Execute Selection** | *(context menu only)* | *(context menu only)* | Right-click → "Execute Selection" to run highlighted text. |
| **Format SQL** | `Shift + Option + F` | `Shift + Alt + F` | Prettifies the SQL syntax (built-in Monaco). |
| **Toggle Comment** | `Cmd + /` | `Ctrl + /` | Comments/uncomments the current line or selection (built-in Monaco). |
| **Multi-Cursor** | `Option + Click` | `Alt + Click` | Place multiple cursors for simultaneous editing (built-in Monaco). |
| **Command Palette**| `F1` | `F1` | Open the Monaco command palette. |

## Query Execution & Data Grid

When you execute a query, Tabularis handles the results asynchronously, streaming them into the integrated Data Grid.

### Transaction Management
By default, queries are executed in auto-commit mode. However, you can manually wrap your statements in `BEGIN; ... COMMIT;` blocks. If an error occurs midway through a block, Tabularis halts execution and outputs the precise line and database engine error.

### Powerful Data Grid
The results grid is heavily optimized to handle thousands of rows without dropping frames:
- **Inline Editing**: Double-click any cell to modify its content. Changes are marked in yellow and can be committed back to the database with a single click (generating `UPDATE` statements securely via primary keys).
- **Rich Data Types**: JSON columns include a built-in JSON viewer/formatter. Spatial data displays coordinates.
- **Exporting**: Export the current view to CSV or JSON instantly.
- **Copy with Headers**: Highlight cells, right-click, and select "Copy with Headers" to easily paste data into Excel or Google Sheets.
