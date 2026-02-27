---
title: "Dump & Import"
order: 6.5
excerpt: "Export a full database snapshot to SQL and restore it — with progress tracking and cancellation support."
---

# Dump & Import

Tabularis lets you dump a database to a `.sql` file and import an existing `.sql` file back into any connection — right from the sidebar, without leaving the app.

## Dump a Database

Right-click a database in the sidebar and choose **Dump Database**. A modal opens with the following options:

| Option | Description |
| :--- | :--- |
| **Include Structure** | Exports `CREATE TABLE`, `CREATE INDEX`, and other DDL statements. |
| **Include Data** | Exports `INSERT INTO` statements for all rows. |
| **Table selection** | Choose which tables to include. Use **Select All** / **Deselect All** for convenience. |

At least one of _Include Structure_ or _Include Data_ must be selected, and at least one table must be chosen before starting.

Click **Export** to open the OS file save dialog. The default filename is `<database>_dump_<date>.sql`. Tabularis streams the dump to disk as it runs — you can see the elapsed time in real time. Click **Cancel** at any time to abort the operation.

## Import a Database

Right-click a database in the sidebar and choose **Import Database**, then select a `.sql` file using the file picker. The import starts immediately and shows:

- A progress bar with the number of statements executed and a percentage (when the total is known in advance).
- An indeterminate progress bar for files where the total statement count cannot be pre-calculated.
- The elapsed time.

The import can be cancelled at any time. Tabularis will close the modal automatically after a successful import.

> **Note**: Import executes the SQL statements in your file sequentially. If a statement fails, execution stops and the error is displayed. Tabularis does not wrap the import in a transaction automatically — if you want atomicity, ensure your dump file contains `BEGIN;` and `COMMIT;` statements.

## How to Access

Both actions are available by **right-clicking a database** node in the left sidebar. They work with all native drivers (PostgreSQL, MySQL, SQLite) and with plugin drivers that implement the relevant commands.
