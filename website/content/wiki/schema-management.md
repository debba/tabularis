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

## Auto-Generated ER Diagrams

Understanding a new, undocumented database can be daunting. Tabularis includes a powerful ER (Entity-Relationship) Diagram generator that maps out complex databases in seconds.

### The Layout Engine
Tabularis utilizes the **Dagre** layout engine to automatically calculate visually pleasing representations of your schema.
- Tables are rendered as nodes, showing primary keys and column types.
- Foreign keys are rendered as directional edges connecting the exact columns.
- The engine uses a Sugiyama-style hierarchical layout to minimize crossing lines, making the data flow visually obvious.

### Interaction
- **Zoom & Pan**: The canvas is infinite, easily handling schemas with hundreds of tables.
- **Highlighting**: Hover over a specific table to highlight all its incoming and outgoing relationships, fading the rest of the diagram into the background.
- **Export**: Export the generated diagram as a high-resolution SVG or PNG for use in documentation or presentations.
