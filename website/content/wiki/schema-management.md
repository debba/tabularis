---
title: "Schema Management & ER Diagrams"
order: 6
excerpt: "Modify your database schema without writing DDL. Create tables, edit columns, and manage indexes."
---

# Schema Management & ER Diagrams

While knowing how to write `ALTER TABLE` statements is essential, Tabularis provides visual tools to manage your schema quickly, safely, and comprehensively.

## Visual Schema Editor

The left sidebar is a fully interactive management suite. Right-click any table to enter the Schema Editor.

### Modifying Structures
- **Columns**: Add, rename, or drop columns. Change data types using engine-specific dropdowns (e.g., selecting `VARCHAR`, `TEXT`, or `JSONB` in Postgres).
- **Constraints**: Visually toggle `NOT NULL`, `UNIQUE`, and `PRIMARY KEY` constraints. Set default values with a simple text input.
- **Indexes**: Manage b-tree, hash, or spatial indexes to optimize query performance.
- **Foreign Keys**: Define relationships. Select the target table and column, and specify cascading rules (`ON DELETE CASCADE`, `ON UPDATE RESTRICT`).

### Safe DDL Generation
When you make visual changes, Tabularis does not apply them blindly. It compiles your actions into a set of precise DDL (`CREATE`, `ALTER`, `DROP`) statements and presents them in a preview window. You can review the exact SQL that will run, copy it for version control migrations, or click "Apply" to execute it.

## ER Diagrams

Right-click any database or schema in the sidebar and choose **Open ER Diagram** to open a live, interactive entity-relationship diagram for that schema. Tables appear as nodes, foreign keys as directed edges. The layout is computed automatically using the **Dagre** engine.

For full details — navigation, layout options, export, and per-driver FK support — see the dedicated [ER Diagram](/wiki/er-diagram) page.
