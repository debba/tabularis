---
title: "ER Diagram"
order: 12
excerpt: "Visualize your database schema as an interactive entity-relationship diagram using the Dagre layout engine."
---

# ER Diagram

The **ER Diagram** viewer generates a live, interactive entity-relationship diagram directly from your database schema. Tables appear as nodes; foreign key relationships appear as edges connecting them. The layout is computed automatically using the [Dagre](https://github.com/dagrejs/dagre) graph layout engine.

## Opening the ER Diagram

Right-click a **database** or **schema** in the sidebar and choose **Open ER Diagram**. The diagram opens in a new window dedicated to that connection and schema.

## Interface

The diagram window has a minimal header with:

- **Connection / Database / Schema** — shown at the top so you always know which schema you're viewing.
- **Refresh** button — re-fetches the schema from the database and redraws the diagram.
- **Fullscreen** toggle — expands the diagram to fill the entire display. Press `Esc` to exit.

### Nodes

Each table is a node showing:
- Table name (header)
- Column list with data types
- Primary key indicator
- Foreign key indicator (columns that participate in a relationship)

### Edges

Foreign key constraints are drawn as directed edges from the referencing column to the referenced table. The direction follows the FK definition — the arrow points from the child (referencing) table to the parent (referenced) table.

### Navigation

| Action | Result |
|--------|--------|
| **Scroll wheel** | Zoom in / out |
| **Click + drag** (on canvas) | Pan the view |
| **Click + drag** (on a node) | Move the node to a custom position |
| **Double-click** (on canvas) | Reset zoom and center the diagram |

## Layout Options

Tabularis supports two Dagre layout directions, configurable in **Settings → General**:

| Setting | Description |
|---------|-------------|
| `TB` (Top-Bottom) | Tables are laid out from top to bottom — works well for tall schemas with many relationships. |
| `LR` (Left-Right) | Tables flow left to right — better for wide schemas with fewer levels. |

The setting is stored as `erDiagramDefaultLayout` in `config.json`. Changing it and reopening the diagram applies the new layout.

## Refreshing the Schema

The ER Diagram reads the schema **at the time you open it**. If you modify tables (add columns, create foreign keys) while the diagram is open, click **Refresh** to reload the schema and redraw the diagram with the latest structure.

## Supported Relationships

| Database | FK Support |
|----------|-----------|
| PostgreSQL | Full — all FK constraints in `information_schema` are shown. Multi-schema FK relationships are included when available. |
| MySQL / MariaDB | Full — FK constraints from `information_schema.KEY_COLUMN_USAGE` and `REFERENTIAL_CONSTRAINTS`. |
| SQLite | Partial — FK constraints are shown only if `PRAGMA foreign_keys` is enabled in the database file. |
| Plugin drivers | Depends on whether the plugin implements the `get_foreign_keys` method in its manifest. |

## Export

The ER Diagram window does not currently offer a dedicated export button. To save a snapshot:
- **macOS**: Use `Cmd + Shift + 4` to take a screenshot of the window.
- **Windows**: Use `Win + Shift + S` (Snipping Tool).
- **Linux**: Use your desktop environment's screenshot tool.

Alternatively, use the **Fullscreen** mode before screenshotting for a larger, cleaner capture.

## Notes

- The ER Diagram opens in a **separate window**. You can keep it open alongside the main Tabularis window while working in the SQL editor.
- For very large schemas (100+ tables), the initial layout may take a moment to compute. Dragging nodes manually after the initial render is a good way to organize dense clusters.
- Node positions are **not persisted** — each time you open the diagram, Dagre recalculates the layout from scratch.
