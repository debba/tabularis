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
- **LRU Cache**: A Least Recently Used cache limits memory footprint to the 100 most recently accessed tables.
- **Manual Invalidation**: You can force a cache clear by clicking the "Refresh Schema" button in the sidebar or via the Command Palette.

## Editor Features & Shortcuts

The Monaco integration brings powerful developer features:

| Feature | Shortcut (Mac) | Shortcut (Win/Linux) | Description |
| :--- | :--- | :--- | :--- |
| **Execute All** | `Cmd + Enter` | `Ctrl + Enter` | Runs the entire script. |
| **Execute Selected** | `Cmd + E` | `Ctrl + E` | Runs only the highlighted query, or the query under the cursor. |
| **Format SQL** | `Shift + Option + F` | `Shift + Alt + F` | Prettifies the SQL syntax. |
| **Toggle Comment** | `Cmd + /` | `Ctrl + /` | Comments/uncomments the current line or selection. |
| **Multi-Cursor** | `Option + Click` | `Alt + Click` | Place multiple cursors for simultaneous editing. |
| **Command Palette**| `F1` | `F1` | Open the Monaco command palette. |

## Query Execution & Data Grid

When you execute a query, Tabularis handles the results asynchronously, streaming them into the integrated Data Grid.

### Transaction Management
By default, queries are executed in auto-commit mode. However, you can manually wrap your statements in `BEGIN; ... COMMIT;` blocks. If an error occurs midway through a block, Tabularis halts execution and outputs the precise line and database engine error.

### Powerful Data Grid
The results grid is heavily optimized to handle thousands of rows without dropping frames:
- **Inline Editing**: Double-click any cell to modify its content. Changes are marked in yellow and can be committed back to the database with a single click (generating `UPDATE` statements securely via primary keys).
- **Rich Data Types**: JSON columns include a built-in JSON viewer/formatter. Spatial data displays coordinates.
- **Exporting**: Export the current view to CSV, JSON, or Markdown tables instantly.
- **Copy with Headers**: Highlight cells, right-click, and select "Copy with Headers" to easily paste data into Excel or Google Sheets.
