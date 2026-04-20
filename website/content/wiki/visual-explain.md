---
title: "Visual EXPLAIN"
order: 4.8
excerpt: "Inspect execution plans as interactive graphs, tables, and AI-powered analyses. Works with PostgreSQL, MySQL, MariaDB, and SQLite."
category: "Core Features"
---

# Visual EXPLAIN

**Visual EXPLAIN** turns raw execution plans into something you can actually work with. Select a query, click the EXPLAIN button, and Tabularis runs the appropriate `EXPLAIN` syntax for your database, parses the output, and presents it across four views — all without leaving the application.

<video src="/videos/wiki/05-visual-explain.mp4" controls muted playsinline loop autoplay controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture></video>

It works with PostgreSQL, MySQL, MariaDB, and SQLite. Each engine uses different EXPLAIN formats and capabilities, and Tabularis handles the differences automatically.

![Visual EXPLAIN modal with graph view showing execution plan nodes, cost heatmap, and summary bar](/img/posts/tabularis-visual-explain-graph-view-execution-plan.png)

## Opening Visual EXPLAIN

From the **SQL Editor**, select a query and click the **EXPLAIN** button in the toolbar. From a **Notebook** cell, use the EXPLAIN option in the cell action buttons. The Visual EXPLAIN modal opens full-screen with the plan already loaded.

The header shows the connection name, driver icon, database, and schema so you always know which server produced the plan.

## Which Queries Can Be Explained

Visual EXPLAIN accepts DML statements: **SELECT**, **INSERT**, **UPDATE**, **DELETE**, **REPLACE**, **WITH** (CTEs), and **TABLE**.

DDL statements like CREATE, DROP, ALTER, and TRUNCATE are blocked — they are not valid inputs for `EXPLAIN` and would produce confusing errors from the database engine. If you try to explain a DDL statement, Tabularis shows an error message before anything is sent to the server.

SQL comments at the beginning of the query (both `--` line comments and `/* */` block comments) are stripped before validation, so annotated queries work as expected.

## EXPLAIN vs EXPLAIN ANALYZE

A toggle in the modal footer switches between the two modes.

**EXPLAIN** shows the **estimated plan** — what the optimizer expects to happen. You get cost estimates, expected row counts, and the chosen access strategy, but nothing is executed.

**EXPLAIN ANALYZE** actually **runs the query** and reports what happened: actual row counts, actual execution time, loop counts, and (on PostgreSQL) buffer statistics. The difference can be significant — a plan might estimate 100 rows but actually scan 100,000.

The default depends on the query type:

| Query type | Default |
|-----------|---------|
| SELECT, WITH, TABLE | ANALYZE on |
| INSERT, UPDATE, DELETE | ANALYZE off, with a warning |

For data-modifying queries, a warning icon appears next to the toggle. Since `EXPLAIN ANALYZE` executes the statement, you need to enable it explicitly.

## The Four Views

The summary bar at the top provides four tabs. You can switch views without re-running the query.

### Graph View

The default view. Each operation in the plan becomes a node in an interactive directed graph. Seq Scan, Index Scan, Hash Join, Nested Loop, Sort, Aggregate — the full tree is rendered with edges showing the data flow from leaf scans to the final result.

Each node shows:

- **Node type** and **relation** (table or index name)
- **Estimated rows** and **cost** (startup + total)
- **Actual rows, time, and loops** (when ANALYZE is on)
- **Filter and index conditions**
- **Estimate gap warning** when the ratio between actual and estimated rows exceeds 4x

Nodes are **color-coded by relative cost**: green for cheap operations, yellow for moderate, red for expensive. The scale is relative to the most expensive node in the plan, so bottlenecks stand out without comparing raw numbers.

The graph supports zoom, pan, and fit-to-view. For plans with more than 10 nodes, a minimap appears in the corner.

Clicking a node selects it and populates the **detail panel** on the right with all available metrics for that node.

![Execution plan graph with color-coded nodes showing Seq Scan, Hash Join, and Sort operations](/img/posts/tabularis-visual-explain-graph-nodes-cost-heatmap.png)

### Table View

Better when you need exact numbers. The left panel is an expandable tree table with columns for node type, relation, cost, estimated rows, time, estimate gap, and filter. All nodes start expanded.

Selecting a row opens the **detail panel** on the right, which displays every metric available for that node: cost breakdown (startup to total), actual vs estimated rows, loops, buffer hits and reads, index conditions, hash conditions, join types, and any engine-specific fields.

![Table view with hierarchical tree, cost columns, and node detail panel](/img/posts/tabularis-visual-explain-table-view-detail-panel.png)

### Raw Output

The raw view shows the database response in a read-only Monaco editor with syntax highlighting, word wrap, and search. No transformation — exactly what the server returned. JSON output from PostgreSQL or MySQL is detected automatically and highlighted as JSON; text-based output (like MySQL ANALYZE trees) renders as plain text.

![Raw EXPLAIN JSON output in Monaco editor with syntax highlighting](/img/posts/tabularis-visual-explain-raw-json-output-monaco.png)

### AI Analysis

The AI tab sends the query and the raw EXPLAIN output to the configured AI provider and returns a structured analysis: what the query is doing, where the bottlenecks are, which indexes might help, and which rewrites are worth testing.

The analysis is generated in the language configured in Tabularis (English, Italian, Spanish, or Chinese), so you do not need to reason about plans in English if that is not your working language.

This tab requires an AI provider to be configured in **Settings > AI**. If none is set up, a warning is shown. It works with all supported providers: OpenAI, Anthropic, Ollama, OpenRouter, MiniMax, and custom OpenAI-compatible endpoints.

The system prompt used for plan analysis can be customized in **Settings > AI > Explain Plan Analysis Prompt**.

![AI analysis view with structured performance recommendations and optimization suggestions](/img/posts/tabularis-visual-explain-ai-analysis-recommendations.png)

## Overview Bar

Below the summary bar, a collapsible **Overview** panel highlights the most relevant findings from the plan:

| Finding | What it shows |
|---------|--------------|
| **Highest Cost** | The node with the largest total cost in the plan |
| **Slowest Step** | The node with the highest actual execution time (only with ANALYZE) |
| **Largest Estimate Gap** | The node where the optimizer's row estimate was furthest from reality |
| **Sequential Scans** | Count of full table scans in the plan |
| **Temp Operations** | Count of sort, filesort, or temporary table operations |

Each finding is a clickable card — click it to select the corresponding node in the graph or table view and jump to its details. Below the findings, **Driver Notes** explain engine-specific context (e.g., what data is available with PostgreSQL ANALYZE vs MySQL EXPLAIN FORMAT=JSON).

## Node Detail Panel

The detail panel appears on the right side of both the graph and table views. It shows three sections for the selected node:

- **General** — node type, relation, cost (startup to total), estimated rows, filter, index condition, join type, hash condition
- **Analyze Data** — actual rows, actual time, loops, buffers hit, buffers read (only when ANALYZE was used)
- **Extra Details** — any additional fields from the engine that don't fit the standard categories (e.g., MariaDB's `r_filtered`, MySQL's `using_temporary_table`)

## Database Support

Visual EXPLAIN adapts to each database engine. The differences between engines are handled automatically — you don't need to configure anything.

### PostgreSQL

The most complete implementation. Tabularis runs `EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS)` and parses the structured JSON output. Available metrics include planning time, execution time, buffer hit/read statistics, and the full node tree with both estimated and actual values.

If you are connected to a specific schema, `search_path` is set before running EXPLAIN so the plan reflects the correct schema context.

### MySQL

MySQL support depends on the server version. Tabularis runs `SELECT VERSION()` and picks the best available format:

| Version | What Tabularis uses | Actual data? |
|---------|-------------------|--------------|
| MySQL 8.0.18+ | `EXPLAIN ANALYZE` (text tree) | Yes |
| MySQL 5.6+ | `EXPLAIN FORMAT=JSON` | No (estimates only) |
| Older versions | Tabular `EXPLAIN` | No |

Version detection is automatic.

### MariaDB

MariaDB is detected from the version string and uses its own syntax:

| Version | What Tabularis uses | Actual data? |
|---------|-------------------|--------------|
| MariaDB 10.1+ | `ANALYZE FORMAT=JSON` | Yes (with `r_*` fields) |
| MariaDB 10.1+ | `EXPLAIN FORMAT=JSON` (fallback) | No |

MariaDB's JSON format includes additional fields like subquery cache status, filesort details, and query optimization time. These appear in the **Extra Details** section of the node detail panel.

### SQLite

SQLite uses `EXPLAIN QUERY PLAN`, which returns a flat list of operations. Tabularis reconstructs the tree structure from the parent-child relationships in the output.

SQLite does not expose execution metrics — there is no ANALYZE equivalent for query plans. The plan structure is shown (scan types, index usage, join order), but timing and row count data are not available. The ANALYZE toggle is accepted but has no effect.

## Re-running a Plan

Click the **Re-run** button in the footer to execute the EXPLAIN again with the current settings (same query, same ANALYZE toggle state). This is useful after you've made changes — created an index, rewritten a join, or adjusted server configuration — and want to compare the new plan.

## Notes

- The modal remembers your view mode selection while it's open. Switching between Graph, Table, Raw, and AI does not re-run the query.
- Plans from `EXPLAIN ANALYZE` on PostgreSQL include buffer statistics (shared hits and reads), which help distinguish between cached and disk I/O operations.
- For large plans with many nodes, the graph view may need zooming. Use the fit-to-view control in the bottom-left corner to see the full tree.
- The AI analysis is a second-pass interpretation of the plan. It is not a replacement for understanding the execution plan yourself, but it can point you toward issues that are not immediately obvious in a large or unfamiliar plan.
