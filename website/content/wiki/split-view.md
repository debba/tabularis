---
title: "Split View"
order: 11
excerpt: "Work with multiple database connections simultaneously in a side-by-side layout."
---

# Split View

**Split View** lets you open two or more database connections side by side in the same window. Each pane has its own SQL editor and data grid. The left sidebar is shared — clicking inside a pane makes that connection the active one in the explorer. This is useful for comparing query results across environments, migrating data, or working on two databases at the same time.

## Activating Split View

1. In the connection list, **select at least two connections** (hold `Ctrl`/`Cmd` and click each one).
2. Right-click one of the selected connections and choose **Open in Split View**, or use the split view button that appears in the toolbar when multiple connections are selected.
3. The workspace divides into panes, each showing one connection.

## Layout Modes

Split View supports two orientations:

| Mode | Description |
|------|-------------|
| **Vertical** | Panes are placed side by side (left / right). Best for wide monitors. |
| **Horizontal** | Panes are stacked (top / bottom). Useful on portrait or narrow screens. |

Switch between modes from the toolbar at the top of the split workspace.

## Working in Split Panes

Each pane behaves exactly like a standalone Tabularis session:

- Browse schemas, tables, views, and routines in the sidebar.
- Open the SQL editor, run queries, and inspect results in the data grid.
- Open the Visual Query Builder or ER Diagram for that connection.
- Execute exports (CSV, JSON) independently per pane.

Tabs are local to each pane — closing a tab in the left pane does not affect the right pane.

## Resizing Panes

Drag the **divider** between the two panes to adjust the relative widths (vertical mode) or heights (horizontal mode). Double-click the divider to reset to an equal 50/50 split.

## Closing Split View

Click the **X** on a pane's header to close that connection and collapse the split. The remaining connection returns to the full-width view. Alternatively, close all but one connection to exit split view automatically.

## Use Cases

**Environment comparison**
Open production and staging databases side by side. Run the same query in both editors and compare results without switching tabs.

**Live data migration**
Browse the source schema in one pane while writing `INSERT` statements in the other. Verify row counts after each batch.

**Cross-database joins (manual)**
Run a query in one pane, copy the result set, and use it as input for a query in the other pane — useful when the databases aren't on the same server and a federated query isn't possible.

**Plugin vs. native driver**
Open the same data in a native MySQL connection on the left and a DuckDB plugin connection on the right to compare results or test a migration.

## Notes

- Split View works with any combination of connection types: native drivers (PostgreSQL, MySQL, SQLite) and plugin drivers can coexist in the same split workspace.
- Each pane maintains its own connection state independently — active schema selection, open transactions, and query history are not shared between panes.
