---
title: "Data Grid"
order: 13
excerpt: "Browse, edit, filter, and export table data with a high-performance virtualized grid."
---

# Data Grid

The **Data Grid** is the primary view for browsing and editing table contents. It opens automatically when you double-click a table in the sidebar. Every table, view, or query result is displayed using a high-performance virtualized renderer — only the visible rows are rendered, so even large result sets feel instant.

## Opening a Table

Double-click any table or view in the sidebar. The data grid opens in a new tab, color-coded by connection. The tab title shows the table name and the connection name in the tab bar.

## Browsing Data

### Pagination

Data is fetched in pages. The default page size is **100 rows**, configurable via `resultPageSize` in [Configuration](/wiki/configuration). Navigation controls at the bottom of the grid let you move forward and backward through pages.

The total row count is shown alongside the pagination controls, fetched via a `COUNT(*)` query when you open the table.

### Column Resizing

Drag a column header border left or right to resize columns. Double-click the border to auto-fit the column to its content width.

### Sorting

Click a column header to sort by that column (ascending). Click again to sort descending. A third click removes the sort. Sorting is applied server-side — a new query is issued with an `ORDER BY` clause so the sort is consistent across all pages.

### Filtering

A filter bar is available at the top of the grid. Type a condition to filter the results. The filter is applied as a `WHERE` clause, so it works across all pages and correctly reflects the total count.

## Inline Editing

Tabularis supports **inline cell editing** for tables. Changes are tracked as pending edits and not immediately committed.

### Editing a Cell

Double-click a cell to enter edit mode. Type the new value and press `Enter` to confirm or `Escape` to cancel. Edited cells are highlighted to distinguish them from unchanged values.

### Adding a Row

Click the **+ Add Row** button at the bottom of the grid. A new empty row appears at the end. Fill in the values for each cell and commit when ready.

### Deleting Rows

Select one or more rows by clicking the row header checkbox, then click **Delete Selected**. A confirmation is shown before the `DELETE` statement is executed.

### Committing Changes

Pending edits (cell modifications, new rows, deleted rows) are shown with a visual indicator. Click **Apply Changes** to generate and execute the corresponding `INSERT`, `UPDATE`, or `DELETE` statements. Click **Discard** to roll back all pending changes without touching the database.

A DDL preview showing the exact SQL that will be executed is available before you confirm.

## Copying Data

Select one or more rows (or cells), then use `Ctrl/Cmd + C` to copy. The selection is placed on the clipboard as tab-separated values, compatible with spreadsheet applications like Excel or LibreOffice Calc.

## Exporting Results

Any query result — whether from a table browse or an SQL editor query — can be exported.

### Export to CSV

Click the **Export** button in the toolbar and choose **CSV**. Tabularis streams the full result set (not just the current page) to a file. A progress indicator tracks the export; you can cancel it at any time.

### Export to JSON

Choose **JSON** from the export menu. The full result set is written as a JSON array of objects, with column names as keys. Same streaming and cancellation support as CSV.

> Exports are always performed on the **complete result set** — all rows that match the current filter, not just the visible page.

## BLOB / Binary Columns

Large binary columns (BLOB, `bytea`, etc.) are truncated in the grid to avoid loading multi-megabyte values into memory. The maximum bytes loaded per cell is controlled by `maxBlobSize` in `config.json` (default: 1 MB). Values exceeding this limit are shown as a truncated hex preview with the full size in bytes.

## Null vs. Empty String

The grid displays `NULL` values with a distinct grey `NULL` badge to differentiate them from empty strings. When editing, leave a cell blank to write an empty string; use the dedicated **Set NULL** option in the cell context menu to write a true `NULL`.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Edit selected cell | `Enter` / `F2` |
| Confirm edit | `Enter` |
| Cancel edit | `Escape` |
| Copy selection | `Ctrl/Cmd + C` |
| Move between cells | Arrow keys |
| Next page | `Ctrl/Cmd + Right` |
| Previous page | `Ctrl/Cmd + Left` |
