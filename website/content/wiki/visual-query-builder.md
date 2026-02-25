---
title: "Visual Query Builder"
order: 5
excerpt: "Construct complex SQL queries visually by dragging tables and drawing JOINs."
---

# Visual Query Builder

Not every query needs to be handwritten. For exploring data, generating reporting views, or learning SQL structures, the **Visual Query Builder** provides an intuitive, drag-and-drop canvas for generating robust SQL statements.

## Workflow: Point, Click, Query

1. **Canvas Setup**: Open a new Query Builder tab. Drag tables from the left sidebar directly onto the infinite canvas.
2. **Define Relationships (JOINs)**: If foreign keys exist, Tabularis automatically draws connecting lines between tables. If not, click and drag a line from one column to another to create a custom `JOIN`. You can click the relationship link to modify the join type (`INNER`, `LEFT`, `RIGHT`, `FULL OUTER`).
3. **Select Columns**: Each table node has a checkbox list of its columns. Check the columns you want to include in the final `SELECT` clause.
4. **Filtering & Sorting**: Use the bottom pane to apply conditions (`WHERE id > 100`) and sorting (`ORDER BY created_at DESC`).
5. **Aggregations**: Easily group data visually. Select a column and apply functions like `COUNT`, `SUM`, `MIN`, or `MAX`. The builder automatically handles the corresponding `GROUP BY` clauses.

## Real-Time Code Generation & AST

Behind the scenes, the Visual Builder constructs an Abstract Syntax Tree (AST) of your visual layout.
As you drag tables and toggle options, this AST is continuously compiled into highly formatted, dialect-specific SQL (e.g., using backticks for MySQL and double-quotes for Postgres).

### Two-Way Synchronization
Currently, the synchronization is **Visual -> SQL**. You build visually, and the SQL updates in real-time in the preview window. 
You can click **"Open in SQL Editor"** at any time. This detaches the query from the visual builder, allowing you to hand-optimize the generated code, add complex CTEs (Common Table Expressions), or utilize database-specific functions that cannot be represented visually.

## Limitations

To maintain a clean and understandable UI, the Visual Query Builder is optimized for standard relational querying. It does not visually support:
- Deeply nested Subqueries (though they can be added as raw SQL fragments in the WHERE clause).
- Complex Window Functions (`OVER (PARTITION BY...)`).
- `UNION` operations between completely disparate data sets.

For these advanced scenarios, the standard **SQL Editor** remains the tool of choice.
