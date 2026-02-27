---
title: "Getting Started"
order: 1.8
excerpt: "Connect to your first database, explore the schema, and run your first query."
---

# Getting Started

This guide walks you through the first things to do after installing Tabularis.

## 1. Create a connection

Click the **`+`** button in the left sidebar to open the New Connection form.

Fill in the required fields:

| Field | Notes |
| :--- | :--- |
| **Name** | A display label for the sidebar |
| **Driver** | Select `postgres`, `mysql`, or `sqlite` |
| **Host** | Hostname or IP address |
| **Port** | Pre-filled from the driver default (5432 for PostgreSQL, 3306 for MySQL) |
| **Database** | The database name |
| **Username** | Database user |
| **Password** | Stored in the OS keychain — never written to disk |

For SQLite, select the **sqlite** driver and use the file picker to choose your `.db` or `.sqlite` file. There is no host, port, or authentication.

### Test before saving

Click **Test** to verify the connection before saving. Tabularis makes a real connection attempt and returns the exact error message from the database engine if it fails. Click **Save** once the test succeeds.

### SSH tunnel

If your database is in a private network, enable the **SSH** tab before saving. Create an SSH profile (host, port, user, and either a password or a key file) and associate it with the connection. See [Connection Management](/wiki/connections) for details.

## 2. Explore the schema

Once connected, the sidebar tree expands to show all schemas, tables, views, and routines for that connection. Expand any node to browse its children.

- **Double-click a table** to open it in the Data Grid and load the first page of rows.
- **Right-click a table** for schema actions: modify columns, add indexes, add foreign keys, view the ER diagram, dump, or generate SQL.

For PostgreSQL connections with multiple schemas, use the schema selector in the sidebar header to control which schemas are visible. Your selection is persisted per connection.

## 3. Run a query

Click the **SQL Editor** tab or open a new editor tab. Type your SQL, then execute it with:

| Action | macOS | Windows / Linux |
| :--- | :--- | :--- |
| Execute (editor) | `Cmd + Enter` | `Ctrl + Enter` |
| Execute (global) | `Cmd + F5` | `Ctrl + F5` |

If you have multiple statements in the editor and no text is selected, Tabularis prompts you to choose which statement to run. Select text first to execute only that portion.

Results stream into the Data Grid below the editor. Use the page controls to navigate large result sets. The page size defaults to 500 rows and can be changed via `resultPageSize` in [Configuration](/wiki/configuration).

## 4. Edit data

Double-click any cell in the Data Grid to edit it inline. Modified cells are highlighted. When you are ready, click **Commit** to generate and execute the `UPDATE` statements using the table's primary key. Click **Discard** to revert all pending changes.

## 5. Export results

Right-click on the Data Grid result to export the current result set to **CSV** or **JSON**. Large exports are streamed and can be cancelled.

## Next steps

| Topic | What you will learn |
| :--- | :--- |
| [Connection Management](/wiki/connections) | SSH tunnels, read-only mode, connection groups |
| [SQL Editor](/wiki/editor) | Autocomplete, query history, the Monaco command palette |
| [Visual Query Builder](/wiki/visual-query-builder) | Build `JOIN` queries without writing SQL |
| [Schema Management & ER Diagrams](/wiki/schema-management) | Alter tables, manage indexes and foreign keys, visualise relations |
| [AI Assistant](/wiki/ai-assistant) | Generate SQL from natural language using OpenAI, Anthropic, Ollama, or any compatible endpoint |
| [Configuration](/wiki/configuration) | Themes, font, page size, AI provider settings |
