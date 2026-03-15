---
title: "View Management"
order: 6.3
excerpt: "Create, edit, and drop database views with a visual editor and live SQL preview."
category: "Database Objects"
---

# View Management

Tabularis provides full CRUD support for database views — `CREATE VIEW`, `ALTER VIEW`, and `DROP VIEW` — through a dedicated visual editor. Views appear alongside tables in the Explorer sidebar, grouped under their own section.

## Browsing Views

When you connect to a database, views are listed in the sidebar under the **Views** section for each database or schema. Each view entry is expandable: click the arrow to reveal its columns, just like a table.

Double-click a view to open its data in the Data Grid. The grid works identically to table browsing — pagination, sorting, filtering, and export all apply.

## Creating a View

1. Right-click the **Views** section header in the sidebar and choose **Create View**.
2. The **View Editor Modal** opens with two fields:
   - **Name** — the view name (e.g., `active_users`).
   - **Definition** — the `SELECT` statement that defines the view. A syntax-highlighted Monaco editor is provided.
3. Click **Preview** to test-run the SELECT statement and verify it returns the expected results.
4. Click **Create** to execute `CREATE VIEW <name> AS <definition>`.

The sidebar refreshes automatically after creation.

## Editing a View

Right-click an existing view in the sidebar and choose **Edit View**. The View Editor Modal opens pre-populated with the view name (read-only) and the current `SELECT` definition.

Modify the definition and click **Save**. Tabularis executes an `ALTER VIEW` (or `CREATE OR REPLACE VIEW`, depending on the driver) to update the view in place.

## Dropping a View

Right-click a view → **Drop View**. A confirmation dialog is shown before the `DROP VIEW` statement is executed. This action is irreversible.

## Viewing the Definition

Right-click a view → **View Definition** to see the full `CREATE VIEW` SQL in a read-only editor tab. This is useful for copying the definition into migration files.

## View Columns

Expand a view in the sidebar to see its output columns. Each column shows:

- Column name
- Data type

This information is fetched via the driver's `get_view_columns` command, which queries `INFORMATION_SCHEMA.COLUMNS` (or the driver-equivalent catalog).

## Driver Support

| Feature | PostgreSQL | MySQL / MariaDB | SQLite |
| :--- | :--- | :--- | :--- |
| List views | Yes | Yes | Yes |
| View definition | Yes | Yes | Yes |
| View columns | Yes | Yes | Yes |
| Create view | Yes | Yes | Yes |
| Alter view | Yes | Yes | Yes |
| Drop view | Yes | Yes | Yes |
