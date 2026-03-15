---
title: "Stored Procedures & Routines"
order: 6.6
excerpt: "Browse stored procedures and functions, view their definitions and parameters."
category: "Database Objects"
---

# Stored Procedures & Routines

Tabularis can browse stored procedures and functions (collectively called **routines**) from the Explorer sidebar. You can view their definitions, inspect parameters, and copy the SQL for use in your queries.

## Browsing Routines

Routines appear in the sidebar under the **Routines** section for each database or schema. They are grouped by type:

- **Functions** — routines that return a value.
- **Procedures** — routines that perform actions without a direct return value.

Each group is collapsible. The routine name and type icon help distinguish functions from procedures at a glance.

## Viewing Parameters

Expand a routine in the sidebar to see its parameter list. Each parameter shows:

| Field | Description |
| :--- | :--- |
| **Name** | Parameter name |
| **Data type** | The SQL type (e.g., `INTEGER`, `VARCHAR`, `JSONB`) |
| **Mode** | Direction badge: `IN`, `OUT`, or `INOUT` |

Parameters are listed in ordinal order as defined in the routine signature.

## Viewing the Definition

Double-click a routine — or right-click → **View Definition** — to open the full routine SQL in a read-only editor tab. This shows the complete `CREATE FUNCTION` or `CREATE PROCEDURE` statement as stored by the database.

The definition is fetched directly from the database catalog, so it always reflects the current state of the server.

## Context Menu Actions

Right-click any routine in the sidebar:

| Action | Description |
| :--- | :--- |
| **View Definition** | Opens the routine SQL in a read-only tab |
| **Copy Name** | Copies the routine name to the clipboard |

## Driver Support

| Feature | PostgreSQL | MySQL / MariaDB | SQLite |
| :--- | :--- | :--- | :--- |
| List routines | Yes | Yes | Not applicable* |
| View definition | Yes | Yes | Not applicable* |
| View parameters | Yes | Yes | Not applicable* |

*SQLite does not support stored procedures or functions at the SQL level.

## Data Model

Each routine is represented as:

- **RoutineInfo**: name, type (`PROCEDURE` or `FUNCTION`), and optional definition text.
- **RoutineParameter**: name, data type, mode (`IN`/`OUT`/`INOUT`), and ordinal position.

This metadata is queried from `INFORMATION_SCHEMA.ROUTINES` and `INFORMATION_SCHEMA.PARAMETERS` (or the driver-equivalent catalog views).
