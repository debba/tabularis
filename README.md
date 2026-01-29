<div align="center">
  <img src="public/logo-sm.png" width="120" height="120" />
</div>

# tabularis

![](https://img.shields.io/github/release/debba/tabularis.svg?style=flat)
![](https://img.shields.io/github/downloads/debba/tabularis/total.svg?style=flat)
![Build & Release](https://github.com/debba/tabularis/workflows/Release/badge.svg)
[![Known Vulnerabilities](https://snyk.io//test/github/debba/tabularis/badge.svg?targetFile=package.json)](https://snyk.io//test/github/debba/tabularis?targetFile=package.json)

A lightweight, developer-focused database management tool, built with Tauri and React.

> 💡 **Origin Story:** This project was born from a **vibe coding** session — an experiment in fluid, agent-assisted development to build a functional tool from scratch in record time.

## Release Download:

<!-- DOWNLOAD_SECTION_START -->
[![Windows](https://img.shields.io/badge/Windows-Download-blue?logo=windows)](https://github.com/debba/tabularis/releases/download/v0.6.0/tabularis_0.6.0_x64-setup.exe) [![macOS](https://img.shields.io/badge/macOS-Download-black?logo=apple)](https://github.com/debba/tabularis/releases/download/v0.6.0/tabularis_0.6.0_x64.dmg) [![Linux](https://img.shields.io/badge/Linux-Download-green?logo=linux)](https://github.com/debba/tabularis/releases/download/v0.6.0/tabularis_0.6.0_amd64.AppImage)
<!-- DOWNLOAD_SECTION_END -->

## Installation

### Arch Linux (AUR)

You can install `tabularis` from the AUR using your favorite AUR helper:

```bash
yay -S tabularis-bin
```

<div align="center">
  <img src="screenshots/overview.png?v" width="80%" alt="Tabularis" />
</div>

## Gallery

<div align="center">
  <img src="screenshots/screenshot-1.png" width="45%" alt="Connection Manager" />
  <img src="screenshots/screenshot-2.png" width="45%" alt="SQL Editor and Data Grid" />
</div>
<div align="center">
  <img src="screenshots/screenshot-3.png" width="45%" alt="Table Wizard" />
  <img src="screenshots/screenshot-4.png" width="45%" alt="New Connection" />
</div>

## [Changelog](./CHANGELOG.md)

## Features

### 🔌 Connection Management

- Support for **PostgreSQL**, **MySQL/MariaDB**, and **SQLite**.
- Save and manage multiple connection profiles with clone/duplicate functionality.
- Secure local persistence of connection settings.
- **Keychain Integration:** Optional secure password storage in system keychain.
- **SSH Tunneling:** Connect to remote databases securely via SSH tunnels with automatic readiness detection.

### 🗄️ Database Explorer

- **Sidebar Navigation:** Quickly browse tables and saved queries.
- **DataGrip-Style Tree View:** Expandable folders for Columns, Keys, Foreign Keys, and Indexes.
- **Context Actions:**
  - Right-click tables to: `Select Top 100`, `Count Rows`, `View Schema`, `Copy Name`, `Add Column`, `Delete Table`.
  - Intelligent context menus with viewport overflow prevention.
- **Schema Metadata:** Parallel fetching for fast schema loading.

### 📝 SQL Editor

- **Monaco Editor:** Industry-standard editor with syntax highlighting.
- **Multiple Tabs:** DataGrip-style tab management with connection isolation.
- **Typed Tabs:** Separate `console` (SQL scripts) and `table` (data view) tabs with smart re-use.
- **Execution:** Run queries with `Ctrl+Enter` or Run button.
- **Partial Execution:** Select specific text to run only that portion.
- **Multi-Statement Support:** Select which query to execute when multiple statements are present.
- **Query Cancellation:** Stop long-running queries with the Stop button.
- **Auto-Detection:** Automatically identifies table queries vs. aggregates for appropriate editing mode.
- **Saved Queries:** Save and organize frequently-used queries with full CRUD support.

### 🎨 Visual Query Builder (Experimental)

- **Drag-and-Drop Interface:** Build queries visually using ReactFlow canvas.
- **Table Nodes:** Drag tables from the sidebar to the canvas.
- **Visual JOINs:** Connect columns between tables to create JOIN relationships.
- **JOIN Types:** Click edge labels to cycle through INNER, LEFT, RIGHT, FULL OUTER, and CROSS joins.
- **Column Selection:** Check columns to include in SELECT, click to configure aggregations and aliases.
- **Aggregate Functions:** Support for COUNT, SUM, AVG, MIN, MAX, COUNT DISTINCT with auto-generated GROUP BY.
- **Advanced Filters:** Build WHERE/HAVING conditions with AND/OR logic.
- **Sorting & Limits:** Configure ORDER BY and LIMIT clauses.
- **Real-time SQL Generation:** See the generated query update as you build.

<div align="center">
  <img src="screenshots/screenshot-5.png" width="80%" alt="Visual Query Builder" />
</div>

### 📊 Data Grid

- **Interactive Results:** Fast rendering of large result sets.
- **Inline Editing:** Double-click any cell to edit data (requires Primary Key).
- **Batch Editing:** DataGrip-style pending changes - modify multiple rows before committing.
- **Row Management:** 
  - Right-click to delete rows.
  - Multi-row selection (Single/Multi/Range) with Ctrl/Shift.
  - Submit/Rollback toolbar for batch operations.
- **Create New Row:** Use "New Row" button to insert data into tables.
- **Export Data:** Export query results to CSV or JSON formats.
- **Smart Context Detection:** Automatically enables editing for table queries, read-only for aggregates (COUNT, SUM, etc.).
- **Loading States:** Visual feedback during query execution with animated spinner.


### 🤖 AI Assistance (Experimental)

- **Natural Language to SQL:** Generate complex SQL queries by describing them in plain English (or Italian).
- **Explain Query:** Get natural language explanations for any SQL query to understand complex logic.
- **Provider Support:** Integration with **OpenAI**, **Anthropic**, and **OpenRouter**.
- **Context-Aware:** The AI is aware of your database schema (table structure) to generate accurate queries.
- **Secure Key Storage:** API Keys are stored securely in the system Keychain, never in plain text files.
- **Customizable Prompts:** Edit system prompts for generation and explanation in Settings to tailor the AI's behavior.

### 🔌 Model Context Protocol (MCP) Server

Tabularis includes a built-in **MCP Server** that exposes your database connections and schemas to AI agents (like Claude or other MCP clients).

- **Standard I/O:** Run `tabularis --mcp` to start the server over stdio.
- **Resources:** Exposes database schemas as resources (`tabularis://{connection_name}/schema`).
- **Tools:** Provides tools to execute SQL queries (`run_query`).
- **Connection Resolution:** Supports referencing connections by **ID** or **Name** (e.g. "MyProductionDB").

### 💾 Configuration Storage

Configuration is stored in the application data directory:

- **Linux:** `~/.config/tabularis/`
- **macOS:** `~/Library/Application Support/tabularis/`
- **Windows:** `%APPDATA%\tabularis\`

Files:
- `connections.json`: Stores connection profiles (passwords can be optionally stored in system Keychain).
- `saved_queries.json` & `.sql` files: Persisted queries.
- `config.json`: General application settings.

#### The `config.json` file

The `config.json` file allows advanced configuration of the application. Here are the available options:

- `theme`: (String, Optional) Application theme preference (e.g., "dark", "light"). *Currently follows system preference.*
- `language`: (String, Optional) Application language. Options: `"auto"` (System), `"en"` (English), `"it"` (Italian).
- `resultPageSize`: (Number, Optional) Default number of rows per page in query results (e.g., `500`).
- `aiEnabled`: (Boolean, Optional) Enable or disable AI features globally.
- `aiProvider`: (String, Optional) Default AI provider. Options: `"openai"`, `"anthropic"`, `"openrouter"`.
- `aiModel`: (String, Optional) Default model identifier to use (e.g., `"gpt-4o"`).
- `aiCustomModels`: (Object, Optional) Override or extend the list of available models for each provider.

#### Custom AI Models override
You can override or add custom models for AI providers by editing `config.json` and adding the `aiCustomModels` object:

```json
{
  "resultPageSize": 1000,
  "language": "en",
  "aiEnabled": true,
  "aiProvider": "openai",
  "aiCustomModels": {
    "openai": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-5-preview"],
    "anthropic": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
    "openrouter": ["google/gemini-pro-1.5", "meta-llama/llama-3-70b-instruct"]
  }
}
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend:** Rust, Tauri v2, SQLx (Async, Type-safe).
- **Build Tool:** Vite.

## Development

### Prerequisites

- Node.js (v18+)
- Rust (Stable) & Cargo
- Linux dependencies (if on Linux): `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`.

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To build a standalone executable/installer:

```bash
npm run tauri build
```

## Roadmap

- [x] Multi-database support
- [x] Schema introspection with advanced metadata (Keys, FKs, Indexes)
- [x] SQL Execution & Results with pagination
- [x] Inline Editing & Batch Editing (DataGrip-style)
- [x] Multi-row selection and deletion
- [x] Create New Row with smart FK selectors
- [x] Data Export (CSV/JSON)
- [x] Saved Queries & Persistence
- [x] Pagination & Result Limiting
- [x] Multiple Tabs support with connection isolation
- [x] Visual Query Builder (Experimental)
- [x] Query cancellation
- [x] Aggregate query detection and smart read-only mode
- [x] Internationalization (English, Italian)
- [x] Keychain integration for secure password storage
- [x] AI Integration (Text-to-SQL, Explain Query)
- [ ] Database Export/Dump
- [ ] Multi-statement execution
- [ ] Query history and autocomplete

## License

Apache License 2.0
