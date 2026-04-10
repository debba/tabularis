---
title: "Visual EXPLAIN: Execution Plans You Can Actually Read"
date: "2026-04-10T21:50:00"
tags:
  [
    "feature",
    "explain",
    "performance",
    "ai",
    "postgresql",
    "mysql",
    "sqlite",
    "preview",
  ]
excerpt: "A preview of Visual EXPLAIN in Tabularis — interactive execution plan graphs, tabular breakdowns, raw JSON output, and AI-powered analysis. Works with PostgreSQL, MySQL, MariaDB, and SQLite. Still in development, with PostgreSQL as the primary focus."
og:
  title: "Visual EXPLAIN:"
  accent: "Execution Plans You Can Actually Read."
  claim: "Interactive plan graphs, cost heatmaps, AI analysis — query performance debugging built into Tabularis."
  image: "/img/posts/tabularis-visual-explain-graph-view-execution-plan.png"
---

# Visual EXPLAIN: Execution Plans You Can Actually Read

A query takes 12 seconds. You know it should take milliseconds. So you do what every database developer has done at least a thousand times: you prepend `EXPLAIN`, hit run, and get back something like this:

```
Nested Loop Left Join  (cost=4.18..1247.32 rows=2400 width=128)
  ->  Hash Join  (cost=3.75..142.56 rows=800 width=72)
        Hash Cond: (p.category_id = c.id)
        ->  Seq Scan on posts p  (cost=0.00..124.00 rows=5000 width=68)
              Filter: (status = 'published')
        ->  Hash  (cost=2.50..2.50 rows=100 width=12)
              ->  Seq Scan on categories c  (cost=0.00..2.50 rows=100 width=12)
  ->  Index Scan using idx_post_id on comments cm  (cost=0.29..1.35 rows=3 width=64)
        Index Cond: (post_id = p.id)
```

Now figure out which node is burning 11 of those 12 seconds. Good luck — because the raw output does not tell you that. The cost numbers are there, buried in a wall of indented text that you have to mentally parse into a tree, cross-reference with the ANALYZE output, and map to actual table sizes. On MySQL you first need to figure out if your server even supports `EXPLAIN FORMAT=JSON` or `EXPLAIN ANALYZE`. On SQLite you get a flat list with parent IDs.

The data is all there. The interface is not. That is what I have been building inside Tabularis: **Visual EXPLAIN**. Click a button, and the execution plan shows up as an interactive graph with color-coded costs, actual vs estimated metrics, and — if you want — AI that reads the plan and tells you what to fix.

Still in active development on the [`feat/visual-explain-analyze`](https://github.com/debba/tabularis/tree/feat/visual-explain-analyze) branch. Already works across PostgreSQL, MySQL, MariaDB, and SQLite.

---

## How It Works

Select a query, hit the EXPLAIN button. Tabularis opens a full-screen modal with the execution plan. It figures out the right `EXPLAIN` syntax for your database, runs it, parses the output, and gives you four views:

- **Graph** — interactive node tree (ReactFlow + Dagre layout)
- **Table** — hierarchical tree table with a detail panel
- **Raw** — the original JSON/text output in Monaco
- **AI Analysis** — AI reads the plan and tells you what to fix

Summary bar at the top: planning time, execution time, total cost. One click to switch views.

![Visual EXPLAIN modal with graph view showing execution plan nodes, cost heatmap, and summary bar](/img/posts/tabularis-visual-explain-graph-view-execution-plan.png)

---

## The Graph View

This is the default and the one you will use the most.

Every operation in the plan becomes a node. Seq Scan, Index Scan, Hash Join, Nested Loop, Sort, Aggregate — they are all there, connected by animated edges that show data flow from the leaf scans up to the final result. Dagre computes the layout, so even a 15-node plan with multiple branches arranges itself into something readable.

Each node shows:

- **Node type** and **relation** (which table or index)
- **Estimated rows** and **cost** (startup + total)
- **Actual rows, time, and loops** (when ANALYZE is on)
- **Filter and index conditions**

Nodes are **color-coded by relative cost**: green border and header tint for cheap operations, yellow for moderate, red for expensive. The scale is relative to the most expensive node in the plan. So a Range Scan on a small indexed column stays green, while a Filesort on an unindexed table with 5000 rows lights up red. You see the bottleneck immediately.

Zoom, pan, fit-to-view. If the plan has more than 10 nodes, a minimap shows up in the corner.

![Execution plan graph with color-coded nodes showing Seq Scan, Hash Join, and Sort operations](/img/posts/tabularis-visual-explain-graph-nodes-cost-heatmap.png)

---

## The Table View

The graph shows the shape. The table gives you every number.

Left side: expandable tree with columns for node type, relation, cost, estimated rows, time, filter. Click a row, and the right side shows a **detail panel** with all the metrics for that node — cost breakdown, actual vs estimated rows, loops, buffer hits and reads, index conditions, hash conditions, and whatever extra properties the engine reported.

If you have used the EXPLAIN views in pgAdmin or DBeaver, the layout will feel familiar. The difference is the detail panel and the fact that it works the same way across PostgreSQL, MySQL, MariaDB, and SQLite.

![Table view with hierarchical tree, cost columns, and node detail panel](/img/posts/tabularis-visual-explain-table-view-detail-panel.png)

---

## Raw Output

Sometimes you want the JSON. Maybe you need to paste it somewhere, maybe you know exactly what to look for and the graph is just in the way.

The raw view shows the original EXPLAIN output in a read-only Monaco editor. Syntax highlighting, word wrap, search. What the database returned, nothing more.

![Raw EXPLAIN JSON output in Monaco editor with syntax highlighting](/img/posts/tabularis-visual-explain-raw-json-output-monaco.png)

---

## AI Analysis

Click the AI tab, and Tabularis sends the query and the raw EXPLAIN output to your AI provider. Back comes a structured analysis: what the query is doing step by step, where the performance problems are, which indexes might help, what rewrites could reduce execution time.

Works with OpenAI, Anthropic, Ollama, or any custom OpenAI-compatible endpoint. The analysis is generated in your configured language — English, Italian, Spanish, Chinese — so you do not have to mentally translate "Nested Loop Anti Join with materialized subquery" into something that makes sense.

Not a replacement for knowing how to read execution plans. But a genuinely useful second opinion, especially on a 6-table join where you are not sure whether the problem is the missing index or the correlated subquery.

![AI analysis view with structured performance recommendations and optimization suggestions](/img/posts/tabularis-visual-explain-ai-analysis-recommendations.png)

---

## EXPLAIN vs EXPLAIN ANALYZE

Toggle in the footer. **EXPLAIN** gives you the estimated plan — what the planner thinks will happen. **EXPLAIN ANALYZE** actually executes the query and reports what really happened: actual rows, actual time, loop counts, buffer statistics.

The difference matters. A plan might estimate 100 rows and actually scan 100,000. You only see that with ANALYZE.

ANALYZE is on by default, except for **data-modifying queries**. If you are explaining an INSERT, UPDATE, or DELETE, the checkbox is off and a warning appears. Because EXPLAIN ANALYZE _runs_ the query — and you probably do not want to accidentally delete rows while debugging performance.

DDL statements (CREATE, DROP, ALTER, TRUNCATE) are blocked entirely. EXPLAIN does not support them, and Tabularis tells you why instead of forwarding a confusing database error.

---

## Multi-Database Support

Visual EXPLAIN adapts to each engine. The differences are significant.

### PostgreSQL

The primary focus. Tabularis uses `EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS)` — the richest output PostgreSQL offers. Structured JSON with planning time, execution time, buffer hit/read statistics, and the full node tree. Every metric the graph and table views can display comes from this.

This is the reference implementation. If you use PostgreSQL, you get everything.

### MySQL

MySQL complicates things because EXPLAIN capabilities depend on the server version. Tabularis queries `SELECT VERSION()`, parses the result, and picks the best available format:

- **MySQL 8.0.18+** — `EXPLAIN ANALYZE` (text tree with actual execution data)
- **MySQL 5.6+** — `EXPLAIN FORMAT=JSON` (structured plan, estimates only)
- **Older versions** — tabular EXPLAIN fallback

You do not configure anything. Tabularis detects the version and does the right thing.

### MariaDB

MariaDB has its own dialect. Tabularis detects the MariaDB version string and uses:

- **MariaDB 10.1+** — `ANALYZE FORMAT=JSON` (executes the query, returns JSON with both estimated and actual `r_*` fields)
- **MariaDB 10.1+** — `EXPLAIN FORMAT=JSON` (estimates only)

### SQLite

`EXPLAIN QUERY PLAN` returns a flat list of operations with parent IDs. Tabularis parses the parent-child relationships and builds a tree. No execution metrics (SQLite does not support ANALYZE-style output), but the plan structure and scan types are there.

---

## What Is Still Cooking

This feature is actively being developed. Honest status:

- **PostgreSQL is the most complete** — full JSON parsing, all metrics, ANALYZE with buffers. This is where I am focusing first.
- **MySQL and MariaDB work well** — version detection, multiple format fallbacks, JSON and text tree parsing. Edge cases across the many server versions in the wild are the main gap.
- **SQLite is basic** — plan tree is there, execution metrics are not.
- **Node interaction** — clicking a graph node does not open the detail panel yet. Table view has it, but the two views are not linked.
- **Cost bar visualization** — proportional cost bars inside graph nodes, not just border colors.
- **Plan comparison** — EXPLAIN before and after adding an index, side by side. On the roadmap, not implemented.
- **Plugin drivers** — community database drivers can implement `explain_query` in the driver trait and get Visual EXPLAIN for free.

---

## Contributions Welcome

This is open source, and this feature has clear areas where help would make a real difference.

If you know PostgreSQL internals well, the plan parser can be extended to surface more node-specific details — parallel workers, CTE scans, materialization hints. If you work with MySQL or MariaDB daily and hit parsing edge cases, a bug report with the raw EXPLAIN output is incredibly valuable. If you have ideas about plan visualization — better layouts, cost distribution charts, timeline views — open an issue.

The driver trait defines a standard `explain_query` interface. Any community plugin that implements it gets Visual EXPLAIN automatically.

Development happens on the [`feat/visual-explain-analyze`](https://github.com/debba/tabularis/tree/feat/visual-explain-analyze) branch. Check it out, open an issue or a PR on the [GitHub repository](https://github.com/debba/tabularis).

---

## Why This Matters

Every database has EXPLAIN. Almost no database client makes it usable.

You get raw text, or a table with cryptic column names, or maybe a static tree you cannot zoom or filter. The information is all there — buried under an interface that was never designed for humans to read.

The result is that most developers avoid EXPLAIN until something is already on fire. And when they do use it, they spend more time deciphering the output than actually fixing the query.

Visual EXPLAIN puts execution plan analysis where it belongs — inside the database client, presented visually, with AI to bridge the gap when you are not sure what you are looking at. Write a query, see the plan, spot the bottleneck, fix it. No context switches, no copy-pasting into web visualizers, no separate tools.

This is landing soon. Follow the progress on [`feat/visual-explain-analyze`](https://github.com/debba/tabularis/tree/feat/visual-explain-analyze).

---

## Try It Yourself

If you want to test Visual EXPLAIN on MySQL or MariaDB with queries that produce diverse and interesting execution plans, I put together a demo database and a Tabularis notebook with 25+ queries covering table scans, index access patterns, joins, subqueries, CTEs, aggregation, UNIONs, and intentionally expensive worst-case scenarios.

- [`explain-demo-database.sql`](/docs/explain-demo-database.sql) — MySQL/MariaDB schema with ~15k rows across 8 tables, a mix of indexed and unindexed columns
- [`explain-showcase.tabularis-notebook`](/docs/explain-showcase.tabularis-notebook) — importable notebook with annotated queries, one per optimizer strategy

Run the SQL file on your server, import the notebook into Tabularis, and click Explain on any cell.
